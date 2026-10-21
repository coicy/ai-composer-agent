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
 it('rejects malformed responses without forwarding body',async()=>{
  const provider=createOpenAIArranger({apiKey:'fake',model:'test',fetcher:(async()=>new Response('sensitive',{status:400})) as typeof fetch});
  await expect(provider.generate(context)).rejects.toThrow('model_http_400');
 });
});
