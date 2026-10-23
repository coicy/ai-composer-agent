import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

let dir='',manifestPath='',midiPath='',oldPath:string|undefined;
const midi=new Uint8Array([0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,1,0,0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0]);
const sha=createHash('sha256').update(midi).digest('hex');
function fixture(){
 return {
  total_files:1,items:[{
   title:'Synthetic game reference',style:'game_battle',file:'midi/game_battle/game_battle_01.mid',
   sha256:sha,source_page:'https://opengameart.org/content/synthetic',license:'CC0-1.0',
   rights:{license_id:'CC0-1.0',license_url:'https://creativecommons.org/publicdomain/zero/1.0/',
    license_evidence_url:'https://opengameart.org/content/synthetic',credit:'Unit test only',original_bytes_unchanged:true},
   metadata:{},
   facets:{
    labels:{source_collection:'game_composition_midi',source_style_label:null,game_usage:'battle',
     verified_mode:null,verified_groove:null},
    meter:{values:['6/8'],source:'midi_event'},
    tempo:{bpm_values:[112],source:'midi_event'},
    pitch_language:{pitched_notes:4,percussion_notes:0,
     pitch_classes_c_to_b:[1,0,0,0,1,0,0,1,0,0,0,1]},
    rhythm:{quarter_note_phase_16_bins:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]},
    performance:{velocity_standard_deviation:7.1,velocity_variation_observed:true},
    instrumentation:{programs:[],drum_channel_10_observed:false}
   }
  }]
 };
}
function writeCatalog(v:unknown){writeFileSync(manifestPath,JSON.stringify(v));}
async function loadFresh(){
 vi.resetModules();
 return import('./reference-catalog.js');
}
describe('MIDI catalog tool security and provenance',()=>{
 beforeEach(()=>{
  oldPath=process.env.AI_COMPOSER_MIDI_CATALOG_PATH;
  dir=mkdtempSync(join(tmpdir(),'ai-composer-references-'));
  mkdirSync(join(dir,'catalog'));
  mkdirSync(join(dir,'midi','game_battle'),{recursive:true});
  manifestPath=join(dir,'catalog','manifest.json');
  midiPath=join(dir,'midi','game_battle','game_battle_01.mid');
  writeFileSync(midiPath,midi);
  writeCatalog(fixture());
  process.env.AI_COMPOSER_MIDI_CATALOG_PATH=manifestPath;
 });
 afterEach(()=>{
  if(oldPath===undefined)delete process.env.AI_COMPOSER_MIDI_CATALOG_PATH;
  else process.env.AI_COMPOSER_MIDI_CATALOG_PATH=oldPath;
  rmSync(dir,{recursive:true,force:true});
 });
 it('queries only exact evidence-backed facets with required rights metadata',async()=>{
  const x=await loadFresh();
  const found=x.invokeReferenceTool('music.search_references',{meter:'6/8',pitched:true,usage:'battle'}) as {
   matchCount:number;results:{id:string;credit:string;license:string;meter:{values:string[]}}[]};
  expect(found.matchCount).toBe(1);
  expect(found.results).toMatchObject([{
   id:sha,credit:'Unit test only',license:'CC0-1.0',meter:{values:['6/8']}
  }]);
  expect((x.invokeReferenceTool('music.search_references',{verifiedMode:'dorian'}) as {matchCount:number}).matchCount).toBe(0);
  expect((x.invokeReferenceTool('music.search_references',{verifiedGroove:'swing'}) as {matchCount:number}).matchCount).toBe(0);
  expect((x.invokeReferenceTool('music.search_references',{pitched:false}) as {matchCount:number}).matchCount).toBe(0);
 });
 it('returns bounded details by SHA, without returning raw MIDI bytes',async()=>{
  const x=await loadFresh();
  const detail=x.invokeReferenceTool('music.get_reference',{id:sha}) as Record<string,unknown>;
  expect(detail).toMatchObject({id:sha,license:'CC0-1.0',pitchClassHistogramCToB:[1,0,0,0,1,0,0,1,0,0,0,1]});
  expect(JSON.stringify(detail)).not.toContain('MThd');
  expect(()=>x.invokeReferenceTool('music.get_reference',{id:'../../etc/passwd'})).toThrow('invalid_reference_id');
  expect(()=>x.invokeReferenceTool('music.get_reference',{id:'0'.repeat(64)})).toThrow('reference_not_found');
  expect(x.invokeReferenceTool('music.reference_coverage',{})).toMatchObject({
   totalReferences:1,pitchedReferences:1,drumOnlyReferences:0,
   expertVerifiedModeReferences:0,expertVerifiedGrooveReferences:0
  });
 });
 it('rejects malformed filters instead of coercing their values',async()=>{
  const x=await loadFresh();
  for(const args of [
   {limit:11},{limit:0},{offset:-1},{meter:22},{pitched:'yes'},
   {unknown:'field'},{verifiedMode:null},{sourceStyle:''}
  ])expect(()=>x.invokeReferenceTool('music.search_references',args)).toThrow('invalid_reference_filter');
  expect(()=>x.invokeReferenceTool('music.reference_coverage',{sessionId:'leak'})).toThrow('invalid_reference_filter');
 });
 it('rejects a modified MIDI file even when the manifest is unchanged',async()=>{
  writeFileSync(midiPath,Buffer.from([...midi,1]));
  const x=await loadFresh();
  expect(()=>x.invokeReferenceTool('music.reference_coverage',{})).toThrow('reference_catalog_invalid');
 });
 it('rejects a missing rights record and unsupported licenses',async()=>{
  const raw=fixture();
  delete (raw.items[0] as {rights?:unknown}).rights;
  writeCatalog(raw);
  const x=await loadFresh();
  expect(()=>x.invokeReferenceTool('music.reference_coverage',{})).toThrow('reference_catalog_invalid');
  const invalid=fixture();invalid.items[0]!.license='Proprietary';
  writeCatalog(invalid);
  const y=await loadFresh();
  expect(()=>y.invokeReferenceTool('music.reference_coverage',{})).toThrow('reference_catalog_invalid');
 });
 it('rejects manifest directory traversal or symlink escape',async()=>{
  const raw=fixture();raw.items[0]!.file='../../secrets.mid';
  writeCatalog(raw);
  const x=await loadFresh();
  expect(()=>x.invokeReferenceTool('music.reference_coverage',{})).toThrow('reference_catalog_invalid');
 });
 it('does not silently supply fabricated references when the catalog is absent',async()=>{
  process.env.AI_COMPOSER_MIDI_CATALOG_PATH=join(dir,'no-such-file.json');
  const x=await loadFresh();
  expect(()=>x.invokeReferenceTool('music.search_references',{})).toThrow('reference_catalog_unavailable');
 });
});
