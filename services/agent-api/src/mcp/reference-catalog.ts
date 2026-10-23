import {createHash} from 'node:crypto';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {env} from 'node:process';

type JsonObject=Record<string,unknown>;
type SourceRights={
 license_id:string;
 license_url:string|null;
 license_evidence_url:string;
 credit:string;
 original_bytes_unchanged:boolean;
};
type Reference={
 title:string;file:string;sha256:string;source_page:string;
 license:string;style:string;rights:SourceRights;
 metadata:JsonObject;
 facets:{
  labels:{source_collection:string;source_style_label:string|null;
   game_usage:string|null;verified_mode:string|null;verified_groove:string|null};
  meter:{values:string[];source:string};
  pitch_language:{pitched_notes:number;percussion_notes:number;
   pitch_classes_c_to_b:number[]|null};
  tempo:{bpm_values:number[];source:string};
  rhythm:{quarter_note_phase_16_bins:number[]};
  performance:{velocity_standard_deviation:number;velocity_variation_observed:boolean};
  instrumentation:{programs:unknown[];drum_channel_10_observed:boolean};
 };
};
type Catalog={items:Reference[];total_files:number};
type Filters={
 meter?:string;sourceStyle?:string;usage?:string;pitched?:boolean;
 verifiedMode?:string;verifiedGroove?:string;limit?:number;offset?:number
};
const CATALOG_LIMIT_BYTES=2_000_000;
const MIDI_LIMIT_BYTES=2_000_000;
const MAX_REFERENCES=512;
const LICENSES=new Set(['CC BY 4.0','CC0-1.0','Public Domain']);
const DEFAULT_CATALOG=fileURLToPath(new URL('../../../../references/catalog/manifest.json',import.meta.url));
let cached:Catalog|undefined;

function object(x:unknown):JsonObject{
 if(x===null||typeof x!=='object'||Array.isArray(x))throw Error('reference_catalog_invalid');
 return x as JsonObject;
}
function nonempty(x:unknown):string{
 if(typeof x!=='string'||x.length<1||x.length>2048)throw Error('reference_catalog_invalid');
 return x;
}
function arr(x:unknown):unknown[]{
 if(!Array.isArray(x))throw Error('reference_catalog_invalid');
 return x;
}
function positiveInt(x:unknown):number{
 if(typeof x!=='number'||!Number.isSafeInteger(x)||x<0)throw Error('reference_catalog_invalid');
 return x;
}
function safeUrl(x:unknown):string{
 const text=nonempty(x);
 try{
  const url=new URL(text);
  if(url.protocol==='https:'&&url.username===''&&url.password===''&&url.hostname) return text;
 }catch{/* Reject invalid protocol or syntax. */}
 throw Error('reference_catalog_invalid');
}
function allowedFile(x:unknown):string{
 const text=nonempty(x);
 if(!/^midi\/[a-z0-9_]+\/[a-z0-9_]+\.mid$/.test(text))throw Error('reference_catalog_invalid');
 return text;
}
function isSha(x:unknown):x is string{return typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);}
function normalize(ref:unknown):Reference{
 const r=object(ref),right=object(r.rights),facets=object(r.facets);
 const labels=object(facets.labels),meter=object(facets.meter),pitch=object(facets.pitch_language);
 const tempo=object(facets.tempo),rhythm=object(facets.rhythm),
  performance=object(facets.performance),instrumentation=object(facets.instrumentation);
 const license=nonempty(r.license);
 if(!LICENSES.has(license)||right.license_id!==license||right.original_bytes_unchanged!==true)throw Error('reference_catalog_invalid');
 if(!isSha(r.sha256))throw Error('reference_catalog_invalid');
 const source=nonempty(labels.source_collection);
 if(!['human_drum_performance','score_derived_midi','game_composition_midi'].includes(source))throw Error('reference_catalog_invalid');
 const sourceStyle=labels.source_style_label===null?null:nonempty(labels.source_style_label);
 const usage=labels.game_usage===null?null:nonempty(labels.game_usage);
 // Current catalog has no independently verified mode/groove entries. Future
 // labels require explicit review provenance before becoming queryable.
 const verifiedMode=labels.verified_mode===null?null:nonempty(labels.verified_mode);
 const verifiedGroove=labels.verified_groove===null?null:nonempty(labels.verified_groove);
 if(verifiedMode!==null||verifiedGroove!==null){
  const review=object(r.expert_review);
  safeUrl(review.evidence_url);
  nonempty(review.reviewer);
 }
 const pitches=pitch.pitch_classes_c_to_b===null?null:arr(pitch.pitch_classes_c_to_b).map(positiveInt);
 if(pitches!==null&&pitches.length!==12)throw Error('reference_catalog_invalid');
 const meters=arr(meter.values).map(nonempty);
 const tempos=arr(tempo.bpm_values).map(x=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<=0)throw Error('reference_catalog_invalid');
  return x;
 });
 const phases=arr(rhythm.quarter_note_phase_16_bins).map(positiveInt);
 if(phases.length!==16)throw Error('reference_catalog_invalid');
 const velocitySd=performance.velocity_standard_deviation;
 if(typeof velocitySd!=='number'||!Number.isFinite(velocitySd)||velocitySd<0)throw Error('reference_catalog_invalid');
 if(typeof performance.velocity_variation_observed!=='boolean'||typeof instrumentation.drum_channel_10_observed!=='boolean')throw Error('reference_catalog_invalid');
 const rights:SourceRights={
  license_id:license,
  license_url:right.license_url===null?null:safeUrl(right.license_url),
  license_evidence_url:safeUrl(right.license_evidence_url),
  credit:nonempty(right.credit),original_bytes_unchanged:true
 };
 const expectedUrl=license==='CC BY 4.0'?'https://creativecommons.org/licenses/by/4.0/':
  license==='CC0-1.0'?'https://creativecommons.org/publicdomain/zero/1.0/':null;
 if(rights.license_url!==expectedUrl)throw Error('reference_catalog_invalid');
 if(license==='Public Domain'&&!rights.license_evidence_url.includes('mutopiaproject.org/cgibin/piece-info.cgi?id='))throw Error('reference_catalog_invalid');
 const metadata=object(r.metadata);
 return {
  title:nonempty(r.title),file:allowedFile(r.file),sha256:r.sha256,
  source_page:safeUrl(r.source_page),license,style:nonempty(r.style),rights,metadata,
  facets:{
   labels:{source_collection:source,source_style_label:sourceStyle,
    game_usage:usage,verified_mode:verifiedMode,verified_groove:verifiedGroove},
   meter:{values:meters,source:nonempty(meter.source)},
   pitch_language:{pitched_notes:positiveInt(pitch.pitched_notes),
    percussion_notes:positiveInt(pitch.percussion_notes),pitch_classes_c_to_b:pitches},
   tempo:{bpm_values:tempos,source:nonempty(tempo.source)},
   rhythm:{quarter_note_phase_16_bins:phases},
   performance:{velocity_standard_deviation:velocitySd,
    velocity_variation_observed:performance.velocity_variation_observed},
   instrumentation:{programs:arr(instrumentation.programs),
    drum_channel_10_observed:instrumentation.drum_channel_10_observed}
  }
 };
}
function loadCatalog():Catalog{
 if(cached)return cached;
 const path=resolve(env.AI_COMPOSER_MIDI_CATALOG_PATH||DEFAULT_CATALOG);
 let data:Buffer;
 try{
  if(statSync(path).size>CATALOG_LIMIT_BYTES)throw Error('reference_catalog_invalid');
  data=readFileSync(path);
 }catch(error){
  if(error instanceof Error&&error.message==='reference_catalog_invalid')throw error;
  throw Error('reference_catalog_unavailable');
 }
 if(data.byteLength>CATALOG_LIMIT_BYTES)throw Error('reference_catalog_invalid');
 let parsed:JsonObject;
 try{parsed=object(JSON.parse(data.toString('utf8')));}catch{throw Error('reference_catalog_invalid');}
 const raw=arr(parsed.items);
 if(raw.length===0||raw.length>MAX_REFERENCES||positiveInt(parsed.total_files)!==raw.length)throw Error('reference_catalog_invalid');
 const root=realpathSync(resolve(dirname(path),'..'));
 const seen=new Set<string>(),ids=new Set<string>(),items:Reference[]=[];
 for(const row of raw){
  const item=normalize(row);
  if(seen.has(item.file)||ids.has(item.sha256))throw Error('reference_catalog_invalid');
  seen.add(item.file);ids.add(item.sha256);
  const file=resolve(root,item.file);
  try{
   const actualPath=realpathSync(file);
   if(!actualPath.startsWith(root+sep)||statSync(actualPath).size>MIDI_LIMIT_BYTES)throw Error('reference_catalog_invalid');
   const body=readFileSync(actualPath);
   if(body.byteLength>MIDI_LIMIT_BYTES||body.subarray(0,4).toString()!=='MThd'||
    createHash('sha256').update(body).digest('hex')!==item.sha256)throw Error('reference_catalog_invalid');
  }catch{throw Error('reference_catalog_invalid');}
  items.push(item);
 }
 cached={items,total_files:items.length};
 return cached;
}
function queryArgs(raw:JsonObject):Filters{
 const allowed=new Set(['meter','sourceStyle','usage','pitched','verifiedMode','verifiedGroove','limit','offset']);
 for(const name of Object.keys(raw))if(!allowed.has(name))throw Error('invalid_reference_filter');
 const clean:Filters={};
 for(const name of ['meter','sourceStyle','usage','verifiedMode','verifiedGroove'] as const){
  const value=raw[name];
  if(value===undefined)continue;
  if(typeof value!=='string'||value.length<1||value.length>120)throw Error('invalid_reference_filter');
  clean[name]=value;
 }
 if(raw.pitched!==undefined){
  if(typeof raw.pitched!=='boolean')throw Error('invalid_reference_filter');
  clean.pitched=raw.pitched;
 }
 for(const name of ['limit','offset'] as const){
  if(raw[name]===undefined)continue;
  const value=raw[name];
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||
   (name==='limit'&&(value<1||value>10))||(name==='offset'&&value>500))throw Error('invalid_reference_filter');
  clean[name]=value;
 }
 return clean;
}
function compact(ref:Reference){
 return {id:ref.sha256,title:ref.title,file:ref.file,
  sourceCollection:ref.facets.labels.source_collection,
  sourceStyle:ref.facets.labels.source_style_label,
  usage:ref.facets.labels.game_usage,
  meter:ref.facets.meter,
  tempo:ref.facets.tempo,
  pitchedNoteCount:ref.facets.pitch_language.pitched_notes,
  drumNoteCount:ref.facets.pitch_language.percussion_notes,
  verifiedMode:ref.facets.labels.verified_mode,
  verifiedGroove:ref.facets.labels.verified_groove,
  license:ref.rights.license_id,
  credit:ref.rights.credit,
  licenseUrl:ref.rights.license_url,
  rightsEvidenceUrl:ref.rights.license_evidence_url,
  sourceUrl:ref.source_page,
  sha256:ref.sha256};
}
export const referenceTools=[
 {name:'music.search_references',description:'Search a locally available, licensed MIDI catalog using independently evidenced meter, source style, game usage, pitched/drum-only material, or expert-verified mode/groove. Returns credits and license evidence. Read only; no MIDI bytes or user data are exposed.',inputSchema:{type:'object',properties:{
  meter:{type:'string'},sourceStyle:{type:'string'},usage:{type:'string',enum:['town','battle','dungeon','narrative']},
  pitched:{type:'boolean'},verifiedMode:{type:'string'},verifiedGroove:{type:'string'},
  limit:{type:'integer',minimum:1,maximum:10},offset:{type:'integer',minimum:0,maximum:500}
 },additionalProperties:false}},
 {name:'music.get_reference',description:'Inspect one reference by its exact SHA-256 identifier. Returns evidence, rhythm/pitch statistics and attribution, but not copyright MIDI note events. Read only.',inputSchema:{type:'object',properties:{id:{type:'string',pattern:'^[0-9a-f]{64}$'}},required:['id'],additionalProperties:false}},
 {name:'music.reference_coverage',description:'Report actual observed meter and pitch coverage with available source tags, unknown verified modes and grooves, and licensing totals. Read only.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
] as const;

export function isReferenceTool(name:string):boolean{
 return referenceTools.some(t=>t.name===name);
}
export function invokeReferenceTool(name:string,args:JsonObject):unknown{
 const catalog=loadCatalog();
 if(name==='music.search_references'){
  const f=queryArgs(args);
  const selected=catalog.items.filter(ref=>
   (f.meter===undefined||ref.facets.meter.values.includes(f.meter))&&
   (f.sourceStyle===undefined||ref.facets.labels.source_style_label===f.sourceStyle)&&
   (f.usage===undefined||ref.facets.labels.game_usage===f.usage)&&
   (f.pitched===undefined||(ref.facets.pitch_language.pitched_notes>0)===f.pitched)&&
   (f.verifiedMode===undefined||ref.facets.labels.verified_mode===f.verifiedMode)&&
   (f.verifiedGroove===undefined||ref.facets.labels.verified_groove===f.verifiedGroove)
  );
  const limit=f.limit??3,offset=f.offset??0;
  return {matchCount:selected.length,returnedCount:Math.max(0,Math.min(limit,selected.length-offset)),
   offset,results:selected.slice(offset,offset+limit).map(compact),
   caution:'Source-style labels are not expert-verified genres. No expert-verified mode or groove labels are currently available. MIDI groove timing histograms are not Swing classifications. Results are read-only and do not alter the music project.'};
 }
 if(name==='music.get_reference'){
  if(Object.keys(args).length!==1||!isSha(args.id))throw Error('invalid_reference_id');
  const ref=catalog.items.find(r=>r.sha256===args.id);
  if(!ref)throw Error('reference_not_found');
  return {...compact(ref),
   notePhaseHistogram16:ref.facets.rhythm.quarter_note_phase_16_bins,
   pitchClassHistogramCToB:ref.facets.pitch_language.pitch_classes_c_to_b,
   velocityStandardDeviation:ref.facets.performance.velocity_standard_deviation,
   velocityVariationObserved:ref.facets.performance.velocity_variation_observed,
   instrumentPrograms:ref.facets.instrumentation.programs,
   midiChannel10DrumsObserved:ref.facets.instrumentation.drum_channel_10_observed,
   provenance:'Source MIDI bytes SHA-256 verified at catalog load; original files never sent over MCP.',
   note:'The histogram is observational; no tonal center, scale, or swing has been inferred.'};
 }
 if(name==='music.reference_coverage'){
  if(Object.keys(args).length!==0)throw Error('invalid_reference_filter');
  const meters:Record<string,number>={},licenses:Record<string,number>={};
  const sourceStyles=new Set<string>(),usages=new Set<string>();
  let pitched=0,drumOnly=0,verifiedMode=0,verifiedGroove=0;
  for(const ref of catalog.items){
   for(const meter of ref.facets.meter.values)meters[meter]=(meters[meter]??0)+1;
   licenses[ref.license]=(licenses[ref.license]??0)+1;
   if(ref.facets.pitch_language.pitched_notes>0)pitched++;else drumOnly++;
   if(ref.facets.labels.verified_mode!==null)verifiedMode++;
   if(ref.facets.labels.verified_groove!==null)verifiedGroove++;
   if(ref.facets.labels.source_style_label)sourceStyles.add(ref.facets.labels.source_style_label);
   if(ref.facets.labels.game_usage)usages.add(ref.facets.labels.game_usage);
  }
  return {totalReferences:catalog.total_files,meters,licenseCounts:licenses,
   pitchedReferences:pitched,drumOnlyReferences:drumOnly,expertVerifiedModeReferences:verifiedMode,
   expertVerifiedGrooveReferences:verifiedGroove,
   sourceStyleLabels:[...sourceStyles].sort(),gameUsageLabels:[...usages].sort(),
   absentPriorityMeters:['6/8','9/8','12/8','5/4','5/8','7/8'].filter(m=>(meters[m]??0)===0),
   limitations:['23 original drum patterns plus meter probes give 28 drum-only references in this catalog.',
    '6/8 examples may come from only one drummer; sample counts do not establish representativeness.',
    'Mode, swing, harmony and form remain unverified until independently annotated.',
    'These reference licenses apply to their MIDI files, not the application source code.']};
 }
 throw Error('unknown_reference_tool');
}
