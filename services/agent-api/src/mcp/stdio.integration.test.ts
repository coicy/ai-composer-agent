import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import type {MusicProject} from '@ai-composer/music-core';

// An actual child process speaks newline-delimited JSON-RPC over stdio.
// Do not import the MCP implementation under test into this test process.
type RpcResponse={
 jsonrpc:string;
 id:string|number|null;
 result?:{content?:{type:string;text:string}[];isError?:boolean;[key:string]:unknown};
 error?:{code:number;message:string};
};
type Pending={resolve:(value:RpcResponse)=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>};
const sourceNote={noteId:'source-1',pitch:60,startTick:0,durationTicks:480,velocity:90};
const project:MusicProject={
 projectId:'stdio-e2e',revision:7,ppq:480,tracks:[
  {trackId:'melody',name:'Melody',locked:false,notes:[sourceNote]},
  {trackId:'locked',name:'Protected',locked:true,notes:[]}
 ]
};
const submitted=[{pitch:67,startTick:480,durationTicks:480,velocity:83}];
let child:ChildProcessWithoutNullStreams;
let nextId=0;
let stderr='';
let openedSession='';
const pending=new Map<number,Pending>();
const transcript:{direction:'request'|'response'|'notification';payload:unknown}[]=[];
const protocolErrors:string[]=[];
const successes:string[]=[];

function record(direction:'request'|'response'|'notification',payload:unknown){
 transcript.push({direction,payload});
}
function request(method:string,params?:unknown):Promise<RpcResponse>{
 const id=++nextId;
 const payload={jsonrpc:'2.0',id,method,...(params===undefined?{}:{params})};
 record('request',payload);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP RPC timeout for '+method+'; stderr: '+stderr.slice(-1200)));},12000);
  pending.set(id,{resolve,reject,timer});
  child.stdin.write(JSON.stringify(payload)+'\n');
 });
}
function notify(method:string,params?:unknown){
 const payload={jsonrpc:'2.0',method,...(params===undefined?{}:{params})};
 record('notification',payload);
 child.stdin.write(JSON.stringify(payload)+'\n');
}
function raw(line:string){
 record('request',line);
 child.stdin.write(line+'\n');
}
async function tool(name:string,args:Record<string,unknown>):Promise<RpcResponse>{
 return request('tools/call',{name,arguments:args});
}
function value(response:RpcResponse):Record<string,unknown>{
 expect(response.error).toBeUndefined();
 expect(response.result?.isError).not.toBe(true);
 const content=response.result?.content;
 expect(content).toHaveLength(1);
 expect(content?.[0]?.type).toBe('text');
 return JSON.parse(content![0]!.text) as Record<string,unknown>;
}
function toolError(response:RpcResponse):string{
 expect(response.error).toBeUndefined();
 expect(response.result?.isError).toBe(true);
 return response.result?.content?.[0]?.text??'';
}
async function open(input:MusicProject=project){
 const v=value(await tool('music.open_snapshot',{project:input}));
 expect(v.projectId).toBe(input.projectId);
 expect(v.revision).toBe(input.revision);
 expect(typeof v.sessionId).toBe('string');
 return v.sessionId as string;
}
function passed(name:string){
 successes.push(name);
 console.log('[MCP STDIO E2E] PASS '+name);
}

describe('real MCP stdio JSON-RPC subprocess',()=>{
 beforeAll(()=>{
  child=spawn(process.execPath,[
   '--import','tsx',
   fileURLToPath(new URL('./index.ts',import.meta.url))
  ],{cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:['pipe','pipe','pipe']});
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',(data:string)=>{stderr+=data;});
  child.on('error',error=>{
   protocolErrors.push('child error: '+error.message);
   for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}
   pending.clear();
  });
  child.on('exit',(code,signal)=>{
   if(code!==0&&signal!=='SIGTERM')protocolErrors.push('unexpected process exit '+code+' '+signal+' stderr '+stderr.slice(-1000));
   for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('MCP child exited'));}
   pending.clear();
  });
  const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
  lines.on('line',line=>{
   try{
    const response=JSON.parse(line) as RpcResponse;
    record('response',response);
    if(response.jsonrpc!=='2.0'||(response.result===undefined&&response.error===undefined)){
     protocolErrors.push('invalid JSON-RPC response shape: '+line);
    }
    const id=response.id;
    if(typeof id==='number'){
     const found=pending.get(id);
     if(found){clearTimeout(found.timer);pending.delete(id);found.resolve(response);}
     else protocolErrors.push('unmatched response ID '+id);
    }else if(id!==null)protocolErrors.push('unexpected ID '+String(id));
   }catch(e){protocolErrors.push('non-JSON stdout: '+line+' '+String(e));}
  });
 });
 afterAll(()=>{
  if(child&&!child.killed)child.kill('SIGTERM');
  const result={
   format:'mcp-stdio-e2e-v1',
   source:'real Node.js subprocess / newline-delimited JSON-RPC',
   testcaseCount:successes.length,
   passingAssertions:successes,
   protocolErrors,
   stderr,
   transcript
  };
  mkdirSync('test-results',{recursive:true});
  writeFileSync('test-results/mcp-stdio-transcript.json',JSON.stringify(result,null,2)+'\n');
  expect(protocolErrors).toEqual([]);
  expect(stderr).toBe('');
 });
 it('negotiates protocol and discovers the actual tool schemas',async()=>{
  const initialized=await request('initialize',{
   protocolVersion:'2025-03-26',
   capabilities:{},
   clientInfo:{name:'mcp-stdio-e2e',version:'1.0.0'}
  });
  expect(initialized.result?.protocolVersion).toBe('2025-03-26');
  expect(initialized.result?.serverInfo).toMatchObject({name:'ai-composer-mcp'});
  notify('notifications/initialized');
  expect((await request('ping')).result).toEqual({});
  const list=await request('tools/list');
  const declared=list.result?.tools as {name:string;inputSchema:{type:string}}[];
  expect(declared.map(t=>t.name)).toEqual([
   'music.open_snapshot','music.list_tracks','music.inspect_notes',
   'music.propose_midi','music.submit_candidate','music.close_snapshot',
   'music.search_references','music.get_reference','music.reference_coverage',
   'music.prepare_composition_brief','music.evaluate_composition_candidate'
  ]);
  expect(declared.every(t=>t.inputSchema.type==='object')).toBe(true);
  passed('initialize / initialized / ping / tools/list');
 });
 it('reads a project snapshot without mutating its source',async()=>{
  openedSession=await open();
  const tracks=value(await tool('music.list_tracks',{sessionId:openedSession}));
  expect(tracks).toMatchObject({projectId:'stdio-e2e',revision:7});
  expect(tracks.tracks).toEqual([
   {trackId:'melody',name:'Melody',locked:false,noteCount:1},
   {trackId:'locked',name:'Protected',locked:true,noteCount:0}
  ]);
  const inspected=value(await tool('music.inspect_notes',{
   sessionId:openedSession,trackId:'melody',startTick:0,endTick:960
  }));
  expect(inspected.notes).toEqual([sourceNote]);
  expect(inspected.truncated).toBe(false);
  expect(project.tracks[0]?.notes).toEqual([sourceNote]);
  passed('open snapshot / list tracks / inspect source notes');
 });
 it('accepts an external LLM MIDI candidate only as a Music Core dry-run',async()=>{
  const proposal=value(await tool('music.propose_midi',{
   sessionId:openedSession,trackId:'melody',startTick:0,endTick:1920,
   instruction:'continue this melody',mode:'append'
  }));
  expect(proposal.notes).toEqual([]);
  const candidate=value(await tool('music.submit_candidate',{
   sessionId:openedSession,trackId:'melody',baseRevision:7,notes:submitted
  }));
  expect(candidate).toMatchObject({
   projectId:'stdio-e2e',baseRevision:7,trackId:'melody',
   previewRevision:8,approved:false,applied:false
  });
  expect(candidate.notes).toEqual([{noteId:'mcp-preview-0',...submitted[0]}]);
  const reread=value(await tool('music.inspect_notes',{
   sessionId:openedSession,trackId:'melody',startTick:0,endTick:1920
  }));
  expect(reread.notes).toEqual([sourceNote]);
  expect(value(await tool('music.list_tracks',{sessionId:openedSession}))).toMatchObject({revision:7});
  passed('LLM candidate / Music Core dry-run / no unapproved write');
 });

 it('validates a four-note C-major melody continuation without changing the snapshot',async()=>{
  // Synthetic "external Agent" JSON. No LLM invocation occurs inside the MCP server.
  // PPQ=480: source C4 E4 G4 E4; proposed continuation D4 F4 A4 G4.
  const source=[60,64,67,64].map((pitch,i)=>({
   noteId:'original-'+i,pitch,startTick:i*480,durationTicks:480,velocity:84+i
  }));
  const continuation=[62,65,69,67].map((pitch,i)=>({
   pitch,startTick:1920+i*480,durationTicks:480,velocity:88+i
  }));
  const input:MusicProject={
   projectId:'candidate-melody-c-major',revision:14,ppq:480,
   tracks:[
    {trackId:'lead',name:'C-major melody',locked:false,notes:source},
    {trackId:'do-not-edit',name:'Locked harmony',locked:true,notes:[{
     noteId:'protected',pitch:48,startTick:0,durationTicks:1920,velocity:75,locked:true
    }]}
   ]
  };
  const id=await open(input);
  const base={sessionId:id,trackId:'lead',baseRevision:14,notes:continuation};
  const context=value(await tool('music.inspect_notes',{
   sessionId:id,trackId:'lead',startTick:0,endTick:1920
  }));
  expect(context.notes).toEqual(source);
  const instruction=value(await tool('music.propose_midi',{
   sessionId:id,trackId:'lead',startTick:1920,endTick:3840,
   instruction:'Use a general-purpose LLM to continue the C-major motif for four beats',
   mode:'append'
  }));
  expect(instruction).toMatchObject({
   baseRevision:14,trackId:'lead',startTick:1920,endTick:3840,
   mode:'append',notes:[]
  });
  const accepted=value(await tool('music.submit_candidate',base));
  expect(accepted).toMatchObject({
   projectId:'candidate-melody-c-major',baseRevision:14,trackId:'lead',
   previewRevision:15,approved:false,applied:false
  });
  expect(accepted.notes).toEqual(continuation.map((note,i)=>({noteId:'mcp-preview-'+i,...note})));
  expect((accepted.notes as {pitch:number;startTick:number;durationTicks:number}[]).map(n=>n.pitch)).toEqual([62,65,69,67]);
  const repeated=value(await tool('music.submit_candidate',base));
  expect(repeated.notes).toEqual(accepted.notes);
  expect(repeated.applied).toBe(false);
  const unchanged=value(await tool('music.inspect_notes',{
   sessionId:id,trackId:'lead',startTick:0,endTick:3840
  }));
  expect(unchanged.notes).toEqual(source);
  const locked=value(await tool('music.inspect_notes',{
   sessionId:id,trackId:'do-not-edit',startTick:0,endTick:3840
  }));
  expect(locked.notes).toEqual(input.tracks[1]?.notes);
  expect(value(await tool('music.list_tracks',{sessionId:id}))).toMatchObject({
   revision:14,tracks:[
    {trackId:'lead',locked:false,noteCount:4},
    {trackId:'do-not-edit',locked:true,noteCount:1}
   ]
  });
  expect(input.revision).toBe(14);
  expect(input.tracks[0]?.notes).toEqual(source);
  expect(value(await tool('music.close_snapshot',{sessionId:id}))).toEqual({closed:true});
  passed('4-note C-major continuation / repeated dry-run / source and locked harmony intact');
 });
 it('returns explicit rejection errors for illegal externally supplied MIDI notes',async()=>{
  const id=await open({...project,projectId:'midi-negative-matrix',revision:22});
  const base={sessionId:id,trackId:'melody',baseRevision:22};
  const good={pitch:60,startTick:480,durationTicks:480,velocity:90};
  const badCases:{name:string;notes:unknown;expected:string}[]=[
   {name:'negative pitch',notes:[{...good,pitch:-1}],expected:'invalid_integer'},
   {name:'pitch above 127',notes:[{...good,pitch:128}],expected:'invalid_note'},
   {name:'fractional pitch',notes:[{...good,pitch:60.5}],expected:'invalid_integer'},
   {name:'negative start tick',notes:[{...good,startTick:-10}],expected:'invalid_integer'},
   {name:'fractional start tick',notes:[{...good,startTick:480.5}],expected:'invalid_integer'},
   {name:'zero duration',notes:[{...good,durationTicks:0}],expected:'invalid_note'},
   {name:'negative duration',notes:[{...good,durationTicks:-480}],expected:'invalid_integer'},
   {name:'zero velocity',notes:[{...good,velocity:0}],expected:'invalid_note'},
   {name:'velocity above 127',notes:[{...good,velocity:128}],expected:'invalid_note'},
   {name:'missing velocity',notes:[{pitch:60,startTick:480,durationTicks:480}],expected:'invalid_integer'},
   {name:'unexpected locked field',notes:[{...good,locked:true}],expected:'unexpected_note_field'},
   {name:'note after 256-bar safety window',notes:[{...good,startTick:480*4*256}],expected:'invalid_note'},
   {name:'empty candidate',notes:[],expected:'empty_candidate'},
   {name:'more than 64 notes',notes:Array.from({length:65},(_,i)=>({...good,startTick:480+i*480})),expected:'invalid_notes'}
  ];
  for(const item of badCases){
   const returned=toolError(await tool('music.submit_candidate',{...base,notes:item.notes}));
   expect(returned,item.name).toBe(item.expected);
  }
  const max64=Array.from({length:64},(_,i)=>({...good,startTick:480+i*480}));
  const accepted=value(await tool('music.submit_candidate',{...base,notes:max64}));
  expect((accepted.notes as unknown[])).toHaveLength(64);
  expect(accepted).toMatchObject({baseRevision:22,previewRevision:23,approved:false,applied:false});
  expect(value(await tool('music.list_tracks',{sessionId:id}))).toMatchObject({revision:22});
  expect(value(await tool('music.inspect_notes',{
   sessionId:id,trackId:'melody',startTick:0,endTick:1920
  })).notes).toEqual([sourceNote]);
  expect(value(await tool('music.close_snapshot',{sessionId:id}))).toEqual({closed:true});
  passed('14 malformed MIDI cases rejected / maximum 64-note candidate dry-run / revision unchanged');
 });
 it('denies locked-track, wrong-revision and revoked-session candidate submissions',async()=>{
  const id=await open({...project,projectId:'candidate-authorization',revision:31});
  const note={pitch:72,startTick:480,durationTicks:480,velocity:80};
  const args={sessionId:id,trackId:'melody',baseRevision:31,notes:[note]};
  expect(toolError(await tool('music.submit_candidate',{...args,trackId:'locked'}))).toBe('locked_track');
  expect(toolError(await tool('music.submit_candidate',{...args,baseRevision:30}))).toBe('stale_revision');
  expect(toolError(await tool('music.submit_candidate',{...args,baseRevision:32}))).toBe('stale_revision');
  expect(toolError(await tool('music.submit_candidate',{...args,trackId:'absent'}))).toBe('track_not_found');
  const unrelated=await open({...project,projectId:'different-project',revision:99});
  expect(toolError(await tool('music.submit_candidate',{...args,sessionId:unrelated}))).toBe('stale_revision');
  const okay=value(await tool('music.submit_candidate',args));
  expect(okay).toMatchObject({baseRevision:31,previewRevision:32,approved:false,applied:false});
  expect(value(await tool('music.list_tracks',{sessionId:id}))).toMatchObject({revision:31});
  expect(value(await tool('music.close_snapshot',{sessionId:id}))).toEqual({closed:true});
  expect(toolError(await tool('music.submit_candidate',args))).toBe('session_not_found');
  expect(value(await tool('music.close_snapshot',{sessionId:unrelated}))).toEqual({closed:true});
  passed('locked track / stale revisions / wrong project session / revoked session');
 });
 it('rejects locked tracks, stale revisions, malformed MIDI and invalid scope',async()=>{
  const base={sessionId:openedSession,trackId:'melody',baseRevision:7,notes:submitted};
  expect(toolError(await tool('music.submit_candidate',{...base,baseRevision:8}))).toBe('stale_revision');
  expect(toolError(await tool('music.submit_candidate',{...base,trackId:'locked'}))).toBe('locked_track');
  expect(toolError(await tool('music.submit_candidate',{...base,notes:[{...submitted[0],pitch:128}]}))).toBe('invalid_note');
  expect(toolError(await tool('music.submit_candidate',{...base,notes:[{...submitted[0],velocity:0}]}))).toBe('invalid_note');
  expect(toolError(await tool('music.submit_candidate',{...base,notes:[{...submitted[0],durationTicks:0}]}))).toBe('invalid_note');
  expect(toolError(await tool('music.submit_candidate',{...base,notes:[{...submitted[0],locked:true}]}))).toBe('unexpected_note_field');
  expect(toolError(await tool('music.submit_candidate',{...base,notes:[]}))).toBe('empty_candidate');
  expect(toolError(await tool('music.inspect_notes',{
   sessionId:openedSession,trackId:'melody',startTick:1920,endTick:0
  }))).toBe('invalid_scope');
  expect(toolError(await tool('music.inspect_notes',{
   sessionId:openedSession,trackId:'missing',startTick:0,endTick:480
  }))).toBe('track_not_found');
  expect(toolError(await tool('music.open_snapshot',{
   project:{...project,tracks:[{...project.tracks[0],notes:[{...sourceNote,pitch:500}]}]}
  }))).toBe('invalid_project');
  passed('lock / revision / MIDI bounds / field whitelist / scope / invalid project');
 });
 it('isolates two sessions and revokes access after close',async()=>{
  const other=await open({...project,projectId:'isolated',revision:3});
  expect(other).not.toBe(openedSession);
  expect(value(await tool('music.list_tracks',{sessionId:other}))).toMatchObject({projectId:'isolated',revision:3});
  expect(value(await tool('music.list_tracks',{sessionId:openedSession}))).toMatchObject({projectId:'stdio-e2e',revision:7});
  expect(value(await tool('music.close_snapshot',{sessionId:openedSession}))).toEqual({closed:true});
  expect(toolError(await tool('music.list_tracks',{sessionId:openedSession}))).toBe('session_not_found');
  expect(value(await tool('music.close_snapshot',{sessionId:other}))).toEqual({closed:true});
  passed('multiple session isolation / explicit close / revoked read');
 });
 it('searches the pinned real 44-file corpus over stdio and keeps the music project unchanged',async()=>{
  if(!process.env.AI_COMPOSER_MIDI_CATALOG_PATH){
   expect(toolError(await tool('music.reference_coverage',{}))).toBe('reference_catalog_unavailable');
   passed('missing corpus fails explicitly (no fabricated references)');
   return;
  }
  const coverage=value(await tool('music.reference_coverage',{}));
  expect(coverage).toMatchObject({
   totalReferences:44,pitchedReferences:16,drumOnlyReferences:28,
   expertVerifiedModeReferences:0,expertVerifiedGrooveReferences:0,
   licenseCounts:{'CC BY 4.0':28,'CC0-1.0':8,'Public Domain':8}
  });
  const meters=coverage.meters as Record<string,number>;
  expect(meters['6/8']).toBe(3);
  expect(meters['5/4']).toBe(1);
  expect(meters['5/8']).toBe(1);
  expect(meters['7/8']).toBeUndefined();
  const compound=value(await tool('music.search_references',{meter:'6/8',pitched:false,limit:10}));
  expect(compound).toMatchObject({matchCount:3,returnedCount:3});
  const hits=compound.results as {id:string;license:string;credit:string;sourceUrl:string;meter:{source:string}}[];
  for(const hit of hits){
   expect(hit.id).toMatch(/^[0-9a-f]{64}$/);
   expect(hit.license).toBe('CC BY 4.0');
   expect(hit.credit).toContain('Google LLC');
   expect(hit.sourceUrl.startsWith('https://')).toBe(true);
   expect(hit.meter.source).toMatch(/^(midi_event|source_annotation)$/);
  }
  const detail=value(await tool('music.get_reference',{id:hits[0]!.id}));
  expect(detail).toMatchObject({
   id:hits[0]!.id,license:'CC BY 4.0',
   provenance:'Source MIDI bytes SHA-256 verified at catalog load; original files never sent over MCP.'
  });
  expect(JSON.stringify(detail)).not.toContain('note_on');
  const battle=value(await tool('music.search_references',{usage:'battle',pitched:true,limit:10}));
  expect(battle.matchCount).toBe(2);
  expect((battle.results as {license:string}[]).every(x=>x.license==='CC0-1.0')).toBe(true);
  const dance=value(await tool('music.search_references',{sourceStyle:'dance/disco',pitched:false}));
  expect(dance.matchCount).toBeGreaterThanOrEqual(1);
  const noMode=value(await tool('music.search_references',{verifiedMode:'dorian'}));
  const noSwing=value(await tool('music.search_references',{verifiedGroove:'swing'}));
  expect(noMode.matchCount).toBe(0);
  expect(noSwing.matchCount).toBe(0);
  const slice=value(await tool('music.search_references',{meter:'6/8',offset:2,limit:1}));
  expect(slice).toMatchObject({matchCount:3,returnedCount:1,offset:2});
  expect(toolError(await tool('music.search_references',{limit:99}))).toBe('invalid_reference_filter');
  expect(toolError(await tool('music.get_reference',{id:'../../config.json'}))).toBe('invalid_reference_id');
  expect(toolError(await tool('music.get_reference',{id:'0'.repeat(64)}))).toBe('reference_not_found');
  // Public catalog lookup is unrelated to any project snapshot, and never commits.
  const reviewSession=await open();
  const unchanged=value(await tool('music.inspect_notes',{
   sessionId:reviewSession,trackId:'melody',startTick:0,endTick:960
  }));
  expect(unchanged.notes).toEqual([sourceNote]);
  expect(value(await tool('music.close_snapshot',{sessionId:reviewSession}))).toEqual({closed:true});
  passed('real CC-licensed 44-file MIDI corpus search / grounded read-only detail / unknown mode rejected');
 });
 it('gives an external general-purpose LLM a licensed Shuffle brief, then rejects off-scale MIDI without writes',async()=>{
  if(!process.env.AI_COMPOSER_MIDI_CATALOG_PATH){
   expect(toolError(await tool('music.prepare_composition_brief',{
    sessionId:openedSession,trackId:'melody',startTick:0,endTick:1920,
    tonic:2,mode:'dorian',meter:'4/4',groove:'shuffle',
    instruction:'Continue a D Dorian melody with an offbeat shuffle'
   }))).toBe('reference_catalog_unavailable');
   passed('composition brief reports absent reference corpus');
   return;
  }
  const input={sessionId:openedSession,trackId:'melody',baseRevision:7,
   startTick:0,endTick:1920,tonic:2,mode:'dorian',meter:'4/4',groove:'shuffle'};
  const brief=value(await tool('music.prepare_composition_brief',{
   sessionId:openedSession,trackId:'melody',startTick:0,endTick:1920,
   tonic:2,mode:'dorian',meter:'4/4',groove:'shuffle',instruction:'Compose D Dorian, include the characteristic natural B, 2:1 offbeats',
   sourceStyle:'blues/shuffle',pitched:false
  }));
  expect(brief).toMatchObject({
   projectId:'stdio-e2e',baseRevision:7,trackId:'melody',
   generator:'external_general_purpose_llm_only',referenceMatchCount:2,
   constraints:{mode:'dorian',groove:'shuffle',meter:'4/4',
    proposedOffbeatPositionWithinQuarterTicks:320}
  });
  const references=brief.references as {
   license:string;credit:string;sourceStyle:string;
   modeProof:string;grooveProof:string;rightsEvidenceUrl:string
  }[];
  expect(references).toHaveLength(2);
  for(const reference of references){
   expect(reference).toMatchObject({license:'CC BY 4.0',sourceStyle:'blues/shuffle',
    modeProof:'not_verified',grooveProof:'not_verified'});
   expect(reference.credit.includes('Google LLC')).toBe(true);
   expect(reference.rightsEvidenceUrl.startsWith('https://')).toBe(true);
  }
  const notes=[
   {pitch:62,startTick:0,durationTicks:320,velocity:88},
   {pitch:65,startTick:320,durationTicks:160,velocity:73},
   {pitch:71,startTick:480,durationTicks:320,velocity:90},
   {pitch:69,startTick:800,durationTicks:160,velocity:77}
  ];
  // Notes in this example are constructed by the current general-purpose LLM,
  // not generated by a specialized music model inside the MCP server.
  const assessed=value(await tool('music.evaluate_composition_candidate',{...input,notes}));
  expect(assessed).toMatchObject({
   passed:true,previewRevision:8,approved:false,applied:false,
   modeEvidence:{scaleCompliant:true,status:'candidate_pitch_class_check_only'},
   grooveEvidence:{status:'matches_requested_eighth_offbeat_target',
    observedOffbeats:2,matchedOffbeats:2}
  });
  const diagnostics=assessed.diagnostics as {code:string}[];
  expect(diagnostics.some(d=>d.code==='shuffle_requires_phrase_evidence')).toBe(true);
  const outOfScale=value(await tool('music.evaluate_composition_candidate',{
   ...input,notes:[...notes,{pitch:70,startTick:960,durationTicks:120,velocity:87}]
  }));
  expect(outOfScale).toMatchObject({passed:false,previewRevision:null,applied:false});
  expect((outOfScale.diagnostics as {code:string}[]).some(d=>d.code==='out_of_scale_pitch')).toBe(true);
  const outOfScope=value(await tool('music.evaluate_composition_candidate',{
   ...input,notes:[{pitch:62,startTick:1800,durationTicks:320,velocity:85}]
  }));
  expect(outOfScope.passed).toBe(false);
  expect((outOfScope.diagnostics as {code:string}[]).some(d=>d.code==='note_outside_requested_scope')).toBe(true);
  const sparse=value(await tool('music.evaluate_composition_candidate',{
   ...input,notes:[{pitch:62,startTick:0,durationTicks:480,velocity:85}]
  }));
  expect(sparse).toMatchObject({
   passed:true,grooveEvidence:{status:'insufficient_evidence'}
  });
  expect(toolError(await tool('music.evaluate_composition_candidate',{
   ...input,baseRevision:8,notes
  }))).toBe('stale_revision');
  expect(toolError(await tool('music.evaluate_composition_candidate',{
   ...input,trackId:'locked',notes
  }))).toBe('locked_track');
  expect(toolError(await tool('music.prepare_composition_brief',{
   ...input,trackId:'melody',instruction:'test',
   sourceStyle:'blues/shuffle',meter:'17/8'
  }))).toBe('invalid_meter');
  const again=value(await tool('music.inspect_notes',{
   sessionId:openedSession,trackId:'melody',startTick:0,endTick:1920
  }));
  expect(again.notes).toEqual([sourceNote]);
  expect(value(await tool('music.list_tracks',{sessionId:openedSession}))).toMatchObject({revision:7});
  passed('Dorian + source-labeled Shuffle brief / scoped Music Core dry-run / no unapproved writes');
 });
 it('handles unknown methods, unknown tools and malformed JSON-RPC',async()=>{
  expect((await request('method/does_not_exist')).error).toMatchObject({code:-32601,message:'Method not found'});
  const unknownSession=await open();
  expect(toolError(await tool('music.unknown_tool',{sessionId:unknownSession,trackId:'melody',startTick:0,endTick:480}))).toBe('unknown_tool');
  expect(value(await tool('music.close_snapshot',{sessionId:unknownSession}))).toEqual({closed:true});
  const id=nextId+1;
  // For malformed payloads with no usable request ID, JSON-RPC requires id:null.
  raw('{not-json');
  // Observe the parse-error response using an explicit sentinel request.
  const response=await request('ping');
  expect(response.id).toBe(id);
  expect(response.result).toEqual({});
  const parseError=transcript.find(item=>item.direction==='response'&&
   (item.payload as RpcResponse).id===null&&
   (item.payload as RpcResponse).error?.code===-32700);
  expect(parseError).toBeDefined();
  const invalid=await request('tools/call',{name:1,arguments:{}});
  expect(invalid.result?.isError).toBe(true);
  passed('unknown method / malformed input / server remains responsive');
 });
});
