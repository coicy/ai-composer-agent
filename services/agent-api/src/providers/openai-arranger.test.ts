import {describe,it,expect,vi} from 'vitest';
import type {ArrangementContext} from '@ai-composer/composition';
import {createOpenAIArranger} from './openai-arranger.js';
const context:ArrangementContext={
 sourceTrackId:'main',ppq:480,startTick:0,endTick:1920,instruction:'Compose accompanying strings',seed:19501,
 sourceNotes:[{noteId:'locked-source',pitch:64,startTick:0,durationTicks:480,velocity:90,locked:true}],neighborNotes:[],
 tonalProfile:{status:'ambiguous',noteCount:5,pitchClasses:[0,2,4,7],hypotheses:[{tonic:0,mode:'major',name:'C 大调',coverage:1,score:1.05}]},
 chordSuggestions:[{startTick:0,endTick:1920,name:'C',confidence:'tentative',pitchClasses:[0,4,7]}]
};
const note={pitch:48,startTick:0,durationTicks:480,velocity:80};
const raw={tracks:['harmony','bass','accompaniment'].map(role=>({role,notes:[note]}))};
const response={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]};
describe('OpenAI arrangement API adapter',()=>{
 it('sends read-only melody and strict three-track schema without leaking source IDs',async()=>{
  const request=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   const body=JSON.parse(String(init?.body));
   expect(body.store).toBe(false);
   expect(body.text.format.strict).toBe(true);
   expect(body.text.format.schema.properties.tracks.items.properties.role.enum).toEqual(['harmony','bass','accompaniment']);
   const input=JSON.parse(body.input);
   expect(input.sourceMelody).toEqual([{pitch:64,startTick:0,durationTicks:480,velocity:90}]);
   expect(input.variationSeed).toBe(19501);
   expect(input.tonalProfile.status).toBe('ambiguous');
   expect(input.chordSuggestions[0].name).toBe('C');
   expect(JSON.stringify(input)).not.toContain('locked-source');
   expect((init?.headers as Record<string,string>).authorization).toBe('Bearer fake-key');
   return new Response(JSON.stringify(response),{status:200});
  });
  const provider=createOpenAIArranger({apiKey:'fake-key',model:'test-model',fetcher:request as typeof fetch});
  expect(await provider.generate(context)).toEqual(raw);
  expect(request).toHaveBeenCalledOnce();
 });
 it('sends automatically prioritized electronic techniques and meaningful seeded variation to the general LLM',async()=>{
  const {recommendElectronicTechniques}=await import('@ai-composer/composition');
  const plan=recommendElectronicTechniques({style:'house',seed:19501});
  const request=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   const body=JSON.parse(String(init?.body));
   const input=JSON.parse(body.input);
   expect(input.electronicTechniquePlan).toEqual(plan);
   expect(input.electronicTechniquePlan.choices.some((c:{id:string})=>c.id==='four_floor')).toBe(true);
   expect(input.electronicTechniquePlan.choices.some((c:{id:string})=>c.id==='offbeat_bass')).toBe(true);
   expect(body.instructions).toContain('ELECTRONIC TECHNIQUES');
   expect(body.instructions).toContain('does NOT include a dedicated drums role');
   expect(JSON.stringify(input)).not.toContain('locked-source');
   return new Response(JSON.stringify(response),{status:200});
  });
  const provider=createOpenAIArranger({apiKey:'fake-key',model:'test-model',fetcher:request as typeof fetch});
  expect(await provider.generate({...context,techniquePlan:plan})).toEqual(raw);
  expect(request).toHaveBeenCalledOnce();
 });
 it('forwards a bounded motif / energy section without claiming the browser project was changed',async()=>{
  const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   const body=JSON.parse(String(init?.body));
   const input=JSON.parse(body.input);
   expect(input.compositionSection).toMatchObject({kind:'return',motifId:'A',energy:78});
   expect(body.instructions).toContain('STRUCTURE:');
   expect(body.instructions).toContain('coherent transition');
   return new Response(JSON.stringify(response),{status:200});
  });
  const provider=createOpenAIArranger({apiKey:'fake-key',model:'test-model',fetcher:fetcher as typeof fetch});
  expect(await provider.generate({...context,sectionGuidance:{
   kind:'return',motifId:'A',motifAction:'reprise',energy:78,
   instruction:'Reprise the recognizable phrase with a small variation.',
   startTick:0,endTick:1920
  }})).toEqual(raw);
 });
 it('passes protected neighbor notes without note IDs or writable track metadata',async()=>{
  const responseBody={status:'completed',output:[{type:'message',content:[{type:'output_text',
   text:JSON.stringify({role:'harmony',notes:[note]})}]}]};
  let observed:unknown;
  const fetcher=async(_url:string|URL|Request,init?:RequestInit)=>{
   const body=JSON.parse(String(init?.body));
   observed=JSON.parse(body.input);
   expect(body.text.format.name).toBe('midi_role_v1');
   expect(body.text.format.schema.required).toEqual(['role','notes']);
   expect(body.text.format.schema.properties.tracks).toBeUndefined();
   expect(body.text.format.schema.properties.role.enum).toEqual(['harmony','bass','accompaniment']);
   expect(body.instructions).toContain('ONE scoped MIDI part');
   expect(body.max_output_tokens).toBe(2500);
   return new Response(JSON.stringify(responseBody),{status:200});
  };
  const provider=createOpenAIArranger({apiKey:'fake-key',model:'test-model',fetcher:fetcher as typeof fetch});
  const near={noteId:'SECRET_TARGET_NEIGHBOR',pitch:64,startTick:0,durationTicks:480,velocity:85};
  const protectedNote={noteId:'SECRET_OTHER_TRACK',pitch:40,startTick:0,durationTicks:480,velocity:70};
  expect(await provider.generate({...context,editing:{
   targetTrackId:'SECRET_TARGET_TRACK',targetRole:'harmony',protectedNoteIds:['SECRET_PROTECTED_ID'],before:[near],
   original:[{...near,noteId:'SECRET_PROTECTED_ID'}],after:[],protectedParts:[{trackIndex:2,notes:[protectedNote]}]
  }})).toEqual({role:'harmony',notes:[note]});
  const input=observed as {editingScope?:{targetRole:string;targetBefore:unknown[];protectedParts:unknown[];protectedOriginalIndices:number[]}};
  expect(input.editingScope?.targetRole).toBe('harmony');
  expect(input.editingScope?.protectedOriginalIndices).toEqual([0]);
  expect(input.editingScope?.targetBefore).toEqual([{pitch:64,startTick:0,durationTicks:480,velocity:85}]);
  expect(input.editingScope?.protectedParts).toEqual([{trackIndex:2,notes:[{
   pitch:40,startTick:0,durationTicks:480,velocity:70
  }]}]);
  const serialized=JSON.stringify(input);
  expect(serialized).not.toContain('SECRET_TARGET_NEIGHBOR');
  expect(serialized).not.toContain('SECRET_OTHER_TRACK');
  expect(serialized).not.toContain('SECRET_TARGET_TRACK');
  expect(serialized).not.toContain('SECRET_PROTECTED_ID');
 });
 it('rejects malformed responses without forwarding body',async()=>{
  const provider=createOpenAIArranger({apiKey:'fake',model:'test',fetcher:(async()=>new Response('sensitive',{status:400})) as typeof fetch});
  await expect(provider.generate(context)).rejects.toThrow('model_http_400');
 });
});
