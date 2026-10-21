import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {validateProject} from '@ai-composer/music-core';
import {proposeWithProvider} from '@ai-composer/composition';
import type {CompositionRequest} from '@ai-composer/composition';
import {createOpenAIProvider} from '../providers/openai.js';
const MAX_BODY=128*1024;
function reply(res:ServerResponse,status:number,data:unknown){
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(JSON.stringify(data));
}
async function readBody(req:IncomingMessage):Promise<unknown>{
 const chunks:Buffer[]=[];let size=0;
 for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part as string);size+=chunk.length;if(size>MAX_BODY)throw new Error('request_too_large');chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new Error('invalid_json');}
}
function parseRequest(value:unknown):CompositionRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_request');
 const body=value as Record<string,unknown>;
 if(!body.project||typeof body.project!=='object'||Array.isArray(body.project)||!validateProject(body.project as CompositionRequest['project']))throw new Error('invalid_project');
 if(typeof body.trackId!=='string'||typeof body.instruction!=='string'||!Number.isSafeInteger(body.startTick)||!Number.isSafeInteger(body.endTick))throw new Error('invalid_request');
 if(body.instruction.length>2000)throw new Error('invalid_instruction');
 if(body.mode!==undefined&&body.mode!=='append'&&body.mode!=='replace')throw new Error('invalid_mode');
 return {project:body.project as CompositionRequest['project'],trackId:body.trackId,startTick:body.startTick as number,endTick:body.endTick as number,instruction:body.instruction,mode:body.mode as 'append'|'replace'|undefined,maxNotes:64};
}
type ProviderFactory=typeof createOpenAIProvider;
export interface ServerOptions {apiKey?:string;model?:string;allowedOrigin?:string;providerFactory?:ProviderFactory}
export function createAgentServer(options:ServerOptions={}){
 const allowedOrigin=options.allowedOrigin??'http://localhost:5173';
 const rates=new Map<string,{window:number,count:number}>();
 return createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origin!==allowedOrigin&&origin!=='http://127.0.0.1:5173'){reply(res,403,{error:'forbidden_origin'});return;}
  if(req.method==='GET'&&req.url==='/health'){reply(res,200,{ok:true,modelConfigured:!!options.apiKey});return;}
  if(req.method!=='POST'||req.url!=='/api/compose'){reply(res,404,{error:'not_found'});return;}
  if(!options.apiKey){reply(res,503,{error:'api_key_not_configured'});return;}
  const address=req.socket.remoteAddress??'local',now=Date.now(),prior=rates.get(address);
  const entry=(!prior||now-prior.window>60000)?{window:now,count:0}:prior;
  entry.count++;rates.set(address,entry);
  if(entry.count>10){reply(res,429,{error:'rate_limited'});return;}
  const controller=new AbortController();
  res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
   const request=parseRequest(await readBody(req));
   const provider=(options.providerFactory??createOpenAIProvider)({apiKey:options.apiKey,model:options.model??'gpt-4.1-mini'});
   const candidate=await proposeWithProvider(provider,request,controller.signal);
   reply(res,200,{notes:candidate.notes.map(({pitch,startTick,durationTicks,velocity})=>({pitch,startTick,durationTicks,velocity}))});
  }catch(e){
   if(res.destroyed)return;
   const reason=e instanceof Error?e.message:'internal_error';
   const clientError=['invalid_request','invalid_project','invalid_json','request_too_large','invalid_instruction','invalid_scope','track_not_found','track_locked','scope_not_empty','locked_note_in_range','cross_boundary_note','invalid_mode','invalid_note_limit'].includes(reason);
   reply(res,clientError?422:502,{error:clientError?reason:'generation_failed'});
  }
 });
}
