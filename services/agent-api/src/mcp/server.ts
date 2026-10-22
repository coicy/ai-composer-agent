import {createInterface} from 'node:readline';
import {stdin,stdout} from 'node:process';
import {randomUUID} from 'node:crypto';
import {validateProject} from '@ai-composer/music-core';

import type {MusicProject} from '@ai-composer/music-core';

type Request={jsonrpc:'2.0';id?:string|number;method:string;params?:unknown};
type Session={project:MusicProject;expires:number};
const sessions=new Map<string,Session>();
const MAX_LINE=512*1024;
const MAX_SESSIONS=8;
const TTL=30*60*1000;
const tools=[
 {name:'music.open_snapshot',description:'Load an explicitly supplied MusicProject snapshot into an isolated MCP session. Does not access the browser editor.',inputSchema:{type:'object',properties:{project:{type:'object'}},required:['project'],additionalProperties:false}},
 {name:'music.list_tracks',description:'Read track summaries from a previously opened snapshot.',inputSchema:{type:'object',properties:{sessionId:{type:'string'}},required:['sessionId'],additionalProperties:false}},
 {name:'music.inspect_notes',description:'Read bounded notes from an authorized snapshot track and tick range.',inputSchema:{type:'object',properties:{sessionId:{type:'string'},trackId:{type:'string'},startTick:{type:'integer'},endTick:{type:'integer'}},required:['sessionId','trackId','startTick','endTick'],additionalProperties:false}},
 {name:'music.propose_midi',description:'Create a deterministic, validated MIDI proposal for the selected snapshot region. Never commits. Does not use an internal LLM key.',inputSchema:{type:'object',properties:{sessionId:{type:'string'},trackId:{type:'string'},startTick:{type:'integer'},endTick:{type:'integer'},instruction:{type:'string'},mode:{type:'string',enum:['append','replace']}},required:['sessionId','trackId','startTick','endTick','instruction'],additionalProperties:false}},
 {name:'music.close_snapshot',description:'Revoke an MCP snapshot session.',inputSchema:{type:'object',properties:{sessionId:{type:'string'}},required:['sessionId'],additionalProperties:false}}
] as const;
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_arguments');return value as Record<string,unknown>;}
function string(v:unknown):string{if(typeof v!=='string'||!v||v.length>2048)throw Error('invalid_string');return v;}
function integer(v:unknown):number{if(!Number.isSafeInteger(v)||Number(v)<0)throw Error('invalid_integer');return Number(v);}
function session(args:Record<string,unknown>):Session{const id=string(args.sessionId);const found=sessions.get(id);if(!found||found.expires<Date.now()){sessions.delete(id);throw Error('session_not_found');}return found;}
function content(value:unknown){return {content:[{type:'text',text:JSON.stringify(value)}]};}
async function invoke(name:string,args:Record<string,unknown>){
 if(name==='music.open_snapshot'){
  if(!validateProject(args.project as MusicProject))throw Error('invalid_project');
  if(sessions.size>=MAX_SESSIONS)throw Error('session_limit');
  const project=structuredClone(args.project as MusicProject);
  const sessionId=randomUUID();sessions.set(sessionId,{project,expires:Date.now()+TTL});
  return content({sessionId,projectId:project.projectId,revision:project.revision,expiresInSeconds:TTL/1000,warning:'Snapshot only; no live browser synchronization or commit capability'});
 }
 if(name==='music.close_snapshot'){const id=string(args.sessionId);return content({closed:sessions.delete(id)});}
 const {project}=session(args);
 if(name==='music.list_tracks')return content({projectId:project.projectId,revision:project.revision,tracks:project.tracks.map(t=>({trackId:t.trackId,name:t.name,locked:t.locked,noteCount:t.notes.length}))});
 const trackId=string(args.trackId),track=project.tracks.find(t=>t.trackId===trackId);if(!track)throw Error('track_not_found');
 const startTick=integer(args.startTick),endTick=integer(args.endTick);if(endTick<=startTick||endTick-startTick>project.ppq*4*16)throw Error('invalid_scope');
 if(name==='music.inspect_notes')return content({projectId:project.projectId,revision:project.revision,trackId,notes:track.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick).slice(0,256),truncated:track.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick).length>256});
 if(name==='music.propose_midi'){
  const instruction=string(args.instruction);if(instruction.length>2000)throw Error('invalid_instruction');
  const mode=args.mode===undefined?'append':args.mode;if(mode!=='append'&&mode!=='replace')throw Error('invalid_mode');
  return content({projectId:project.projectId,baseRevision:project.revision,trackId,startTick,endTick,instruction,mode,notes:[],warning:'No LLM is called by MCP. External Agent must supply proposed MIDI notes in a separate validated tool. No changes applied.'});
 }
 throw Error('unknown_tool');
}
export function startMcpStdio(){
 const rl=createInterface({input:stdin,crlfDelay:Infinity,terminal:false});
 rl.on('line',line=>{void (async()=>{
  let req:Request|undefined;
  try{
   if(Buffer.byteLength(line)>MAX_LINE)throw Error('request_too_large');
   req=JSON.parse(line) as Request;
   if(!req||req.jsonrpc!=='2.0'||typeof req.method!=='string')throw Error('invalid_request');
   if(req.id===undefined)return;
   let result:unknown;
   if(req.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'ai-composer-mcp',version:'0.1.0'}};
   else if(req.method==='ping')result={};
   else if(req.method==='tools/list')result={tools};
   else if(req.method==='tools/call'){const p=record(req.params);result=await invoke(string(p.name),record(p.arguments??{}));}
   else {stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,error:{code:-32601,message:'Method not found'}})+'\n');return;}
   stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\n');
  }catch(e){const message=e instanceof Error?e.message:'internal_error';if(req?.id!==undefined)stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result:{isError:true,content:[{type:'text',text:message}]}})+'\n');}
 })();});
}
