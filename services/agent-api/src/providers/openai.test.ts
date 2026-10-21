import {describe,it,expect,vi} from 'vitest';
import {createOpenAIProvider} from './openai.js';
import type {ProviderContext} from '@ai-composer/composition';
const context:ProviderContext={trackId:'melody',startTick:1920,endTick:3840,ppq:480,instruction:'gentle fantasy melody',existingNotes:[]};
const output={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({notes:[{pitch:67,startTick:1920,durationTicks:240,velocity:90}]})}]}]};
describe('OpenAI provider adapter',()=>{
 it('uses structured output and store false',async()=>{
  const mock=vi.fn(async (_url:string|URL|Request,init?:RequestInit)=>{
   expect(init?.method).toBe('POST');expect((init?.headers as Record<string,string>).authorization).toBe('Bearer test-key');
   const body=JSON.parse(String(init?.body));
   expect(body.store).toBe(false);expect(body.text.format.type).toBe('json_schema');
   return new Response(JSON.stringify(output),{status:200});
  });
  const provider=createOpenAIProvider({apiKey:'test-key',model:'test-model',fetcher:mock as typeof fetch});
  expect(await provider.generate(context)).toEqual({notes:[{pitch:67,startTick:1920,durationTicks:240,velocity:90}]});
  expect(mock).toHaveBeenCalledOnce();
 });
 it('sanitizes failed response and rejects empty output',async()=>{
  const bad=createOpenAIProvider({apiKey:'test-key',model:'test',fetcher:(async()=>new Response('secret',{status:401})) as typeof fetch});
  await expect(bad.generate(context)).rejects.toThrow('model_http_401');
  const missing=createOpenAIProvider({apiKey:'test-key',model:'test',fetcher:(async()=>new Response(JSON.stringify({status:'completed',output:[]}))) as typeof fetch});
  await expect(missing.generate(context)).rejects.toThrow('model_output_missing');
 });
});
