import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {validateProject} from '@ai-composer/music-core';
import {proposeWithProvider,proposeArrangement,proposeRegionRegeneration,ARRANGEMENT_ROLES} from '@ai-composer/composition';
import type {CompositionRequest,ArrangementRequest} from '@ai-composer/composition';
import {validateHarmonyPlan,validateFeedbackInput,reconcileFeedbackInterpretation,recommendElectronicTechniques} from '@ai-composer/composition';
import type {ElectronicStyle,TechniqueId} from '@ai-composer/composition';
import {createOpenAIProvider} from '../providers/openai.js';
import {createOpenAIArranger} from '../providers/openai-arranger.js';
import {createOpenAIFeedbackInterpreter} from '../providers/openai-feedback.js';
import type {FeedbackProvider} from '../providers/openai-feedback.js';
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
 if(body.editConstraint!==undefined&&body.editConstraint!=='pitch_only')throw new Error('invalid_edit_constraint');
 if(body.targetNoteIds!==undefined&&(!Array.isArray(body.targetNoteIds)||body.targetNoteIds.length>64||body.targetNoteIds.length===0||body.targetNoteIds.some(x=>typeof x!=='string'||!x)))throw new Error('invalid_note_selection');
 return {project:body.project as CompositionRequest['project'],trackId:body.trackId,startTick:body.startTick as number,endTick:body.endTick as number,instruction:body.instruction,mode:body.mode as 'append'|'replace'|undefined,editConstraint:body.editConstraint as 'pitch_only'|undefined,targetNoteIds:body.targetNoteIds as string[]|undefined,maxNotes:64};
}
function parseArrangementRequest(value:unknown):ArrangementRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_request');
 const body=value as Record<string,unknown>;
 if(!body.project||typeof body.project!=='object'||Array.isArray(body.project)||!validateProject(body.project as ArrangementRequest['project']))throw new Error('invalid_project');
 if(typeof body.sourceTrackId!=='string'||typeof body.instruction!=='string'||!Number.isSafeInteger(body.startTick)||!Number.isSafeInteger(body.endTick))throw new Error('invalid_request');
 if(body.instruction.length>2000)throw new Error('invalid_instruction');
 const project=body.project as ArrangementRequest['project'];
 const startTick=body.startTick as number,endTick=body.endTick as number;
 const barTicks=project.ppq*4;
 if(body.plan!==undefined&&(startTick%barTicks!==0||endTick%barTicks!==0||endTick<=startTick||endTick-startTick>barTicks*4))throw new Error('plan_requires_whole_bars');
 if(body.seed!==undefined&&(!Number.isSafeInteger(body.seed)||(body.seed as number)<0||(body.seed as number)>0xffffffff))throw new Error('invalid_arrangement_seed');
 const allowedStyles=['house','synthwave','techno','trance','drum_and_bass','ambient','chiptune'];
 if(body.electronicStyle!==undefined&&!allowedStyles.includes(body.electronicStyle as string))
  throw new Error('invalid_electronic_style');
 if(body.electronicStyle===undefined&&(body.disabledTechniques!==undefined||body.forcedTechniques!==undefined))
  throw new Error('electronic_style_required');
 if(body.electronicStyle!==undefined){
  recommendElectronicTechniques({
   style:body.electronicStyle as ElectronicStyle,seed:body.seed as number??19501,
   disabled:body.disabledTechniques as TechniqueId[]|undefined,
   forced:body.forcedTechniques as TechniqueId[]|undefined
  });
 }
 const barCount=Math.ceil((endTick-startTick)/barTicks);
 const plan=body.plan===undefined?undefined:validateHarmonyPlan(body.plan,barCount);
 let editing:ArrangementRequest['editing'];
 if(body.editing!==undefined){
  if(!body.editing||typeof body.editing!=='object'||Array.isArray(body.editing))throw new Error('invalid_arrangement_editing');
  const value=body.editing as Record<string,unknown>;
  if(Object.keys(value).some(k=>k!=='targetTrackId'&&k!=='targetRole'&&k!=='editConstraint'&&k!=='protectedPrefixCount'&&k!=='protectedNoteIds'&&k!=='maxLeapSemitones')||
   typeof value.targetTrackId!=='string'||!['harmony','bass','accompaniment'].includes(value.targetRole as string)||
   (value.editConstraint!==undefined&&value.editConstraint!=='pitch_only')||
   (value.protectedPrefixCount!==undefined&&(!Number.isSafeInteger(value.protectedPrefixCount)||
    (value.protectedPrefixCount as number)<0||(value.protectedPrefixCount as number)>16))||
   (value.protectedNoteIds!==undefined&&(!Array.isArray(value.protectedNoteIds)||
    value.protectedNoteIds.length<1||value.protectedNoteIds.length>32||
    value.protectedNoteIds.some(x=>typeof x!=='string'||!x||x.length>180)||
    new Set(value.protectedNoteIds).size!==value.protectedNoteIds.length))||
   (value.maxLeapSemitones!==undefined&&(!Number.isSafeInteger(value.maxLeapSemitones)||
    (value.maxLeapSemitones as number)<1||(value.maxLeapSemitones as number)>24))||
   (value.editConstraint!=='pitch_only'&&(value.protectedPrefixCount!==undefined||
    value.protectedNoteIds!==undefined||value.maxLeapSemitones!==undefined)))
   throw new Error('invalid_arrangement_editing');
  editing={targetTrackId:value.targetTrackId,targetRole:value.targetRole as 'harmony'|'bass'|'accompaniment',
   ...(value.editConstraint?{editConstraint:'pitch_only' as const}:{}),
   ...(value.protectedPrefixCount!==undefined?{protectedPrefixCount:value.protectedPrefixCount as number}:{}),
   ...(value.protectedNoteIds!==undefined?{protectedNoteIds:value.protectedNoteIds as string[]}:{}),
   ...(value.maxLeapSemitones!==undefined?{maxLeapSemitones:value.maxLeapSemitones as number}:{})};
 }
 return {project,sourceTrackId:body.sourceTrackId,startTick,endTick,instruction:body.instruction,
  plan,seed:body.seed as number|undefined,editing,
  electronicStyle:body.electronicStyle as ElectronicStyle|undefined,
  disabledTechniques:body.disabledTechniques as TechniqueId[]|undefined,
  forcedTechniques:body.forcedTechniques as TechniqueId[]|undefined};
}
type ProviderFactory=typeof createOpenAIProvider;
type ArrangerFactory=typeof createOpenAIArranger;
type FeedbackFactory=(options:Parameters<typeof createOpenAIFeedbackInterpreter>[0])=>FeedbackProvider;
export interface ServerOptions {apiKey?:string;model?:string;allowedOrigin?:string;providerFactory?:ProviderFactory;arrangerFactory?:ArrangerFactory;feedbackFactory?:FeedbackFactory}
export function createAgentServer(options:ServerOptions={}){
 const allowedOrigin=options.allowedOrigin??'http://localhost:5173';
 const rates=new Map<string,{window:number,count:number}>();
 return createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origin!==allowedOrigin&&origin!=='http://127.0.0.1:5173'){reply(res,403,{error:'forbidden_origin'});return;}
  if(req.method==='GET'&&req.url==='/health'){reply(res,200,{ok:true,modelConfigured:!!options.apiKey});return;}
  if(req.method!=='POST'||(req.url!=='/api/compose'&&req.url!=='/api/arrange'&&req.url!=='/api/feedback')){reply(res,404,{error:'not_found'});return;}
  if(!options.apiKey){reply(res,503,{error:'api_key_not_configured'});return;}
  const address=req.socket.remoteAddress??'local',now=Date.now(),prior=rates.get(address);
  const entry=(!prior||now-prior.window>60000)?{window:now,count:0}:prior;
  entry.count++;rates.set(address,entry);
  if(entry.count>10){reply(res,429,{error:'rate_limited'});return;}
  const controller=new AbortController();
  res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
   const body=await readBody(req);
   if(req.url==='/api/feedback'){
    if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('invalid_request');
    const params=body as Record<string,unknown>;
    if(Object.keys(params).some(k=>k!=='feedback'&&k!=='noteCount'))throw new Error('invalid_request');
    const input=validateFeedbackInput(params.feedback,params.noteCount);
    const provider=(options.feedbackFactory??createOpenAIFeedbackInterpreter)(
     {apiKey:options.apiKey,model:options.model??'gpt-4.1-mini'});
    const proposed=await provider.interpret(input.feedback,input.noteCount,controller.signal);
    const interpretation=reconcileFeedbackInterpretation(input.feedback,input.noteCount,proposed);
    reply(res,200,interpretation);
   }else if(req.url==='/api/arrange'){
    const request=parseArrangementRequest(body);
    const provider=(options.arrangerFactory??createOpenAIArranger)({apiKey:options.apiKey,model:options.model??'gpt-4.1-mini'});
    if(request.editing){
     const candidate=await proposeRegionRegeneration(provider,{
      ...request,targetTrackId:request.editing.targetTrackId,targetRole:request.editing.targetRole,
      editConstraint:request.editing.editConstraint,
      protectedPrefixCount:request.editing.protectedPrefixCount,protectedNoteIds:request.editing.protectedNoteIds,
      maxLeapSemitones:request.editing.maxLeapSemitones
     },controller.signal);
     reply(res,200,{role:candidate.targetRole,notes:candidate.notes.map(({pitch,startTick,durationTicks,velocity})=>({pitch,startTick,durationTicks,velocity}))});
    }else{
     const candidate=await proposeArrangement(provider,request,controller.signal);
     const tracks=candidate.tracks.map((t,i)=>({role:ARRANGEMENT_ROLES[i],notes:t.notes.map(({pitch,startTick,durationTicks,velocity})=>({pitch,startTick,durationTicks,velocity}))}));
     reply(res,200,{tracks});
    }
   }else{
    const request=parseRequest(body);
    const provider=(options.providerFactory??createOpenAIProvider)({apiKey:options.apiKey,model:options.model??'gpt-4.1-mini'});
    const candidate=await proposeWithProvider(provider,request,controller.signal);
    reply(res,200,{notes:candidate.notes.map(({pitch,startTick,durationTicks,velocity})=>({pitch,startTick,durationTicks,velocity}))});
   }
  }catch(e){
   if(res.destroyed)return;
   const reason=e instanceof Error?e.message:'internal_error';
   const clientError=['invalid_request','invalid_feedback_text','invalid_feedback_note_count','invalid_project','invalid_json','request_too_large','invalid_instruction','invalid_scope','track_not_found','track_locked','scope_not_empty','locked_note_in_range','cross_boundary_note','invalid_mode','invalid_note_limit','invalid_note_selection','selected_note_not_found','invalid_edit_constraint','pitch_only_requires_selection','pitch_only_requires_notes','pitch_only_region_too_dense','invalid_protected_prefix','invalid_protected_notes','protected_note_outside_scope',
   'all_target_notes_protected','ambiguous_protected_note','invalid_leap_constraint','feedback_requires_pitch_only','rhythm_constraint_violated','no_pitch_changes','invalid_arrangement_scope','invalid_arrangement_seed','invalid_arrangement_role','invalid_arrangement_editing','source_track_is_target','target_track_not_found','source_track_not_found','empty_source_range','source_range_too_dense','invalid_harmony_plan','invalid_plan_key','invalid_plan_progression','invalid_plan_register','invalid_plan_enforcement','invalid_plan_timeline','invalid_plan_passing_tones','plan_requires_whole_bars','invalid_electronic_style','electronic_style_required','invalid_technique_seed','invalid_technique_capacity','invalid_technique_override','conflicting_technique_override','conflicting_technique_slots'].includes(reason) || /^plan_(scale|chords|registers|inversions)_violation:(harmony|bass|accompaniment)$/.test(reason);
   reply(res,clientError?422:502,{error:clientError?reason:'generation_failed'});
  }
 });
}
