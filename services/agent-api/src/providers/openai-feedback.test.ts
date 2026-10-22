import {describe,it,expect,vi} from 'vitest';
import {createOpenAIFeedbackInterpreter} from './openai-feedback.js';
import {validateFeedbackInterpretation} from '@ai-composer/composition';
const suggested={pitchOnly:true,protectedPrefixCount:2,maxLeapSemitones:5,
 explanation:'建议保留前两音并限制跳进',unresolved:[]};
const response=(value:unknown)=>({status:'completed',output:[{type:'message',content:[
 {type:'output_text',text:JSON.stringify(value)}
]}]});
describe('OpenAI feedback suggestion only',()=>{
 it('requests strict schema without sending project score or allowing writes',async()=>{
  const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   const body=JSON.parse(String(init?.body));
   expect(body.store).toBe(false);
   expect(body.text.format.name).toBe('scoped_feedback_v1');
   expect(body.text.format.strict).toBe(true);
   expect(body.text.format.schema.additionalProperties).toBe(false);
   expect(body.input).toBe(JSON.stringify({feedback:'保留前两个音，跳进不超过五个半音',noteCount:3}));
   expect(JSON.stringify(body)).not.toContain('noteId');
   expect(body.instructions).toContain('No action may be performed without user approval');
   return new Response(JSON.stringify(response(suggested)),{status:200});
  });
  const interpreter=createOpenAIFeedbackInterpreter({apiKey:'test-key',model:'test-model',fetcher:fetcher as typeof fetch});
  const value=await interpreter.interpret('保留前两个音，跳进不超过五个半音',3);
  expect(validateFeedbackInterpretation(value,3)).toEqual(suggested);
  expect(fetcher).toHaveBeenCalledOnce();
 });
 it('refuses network responses without passing their bodies into user-facing errors',async()=>{
  const interpreter=createOpenAIFeedbackInterpreter({apiKey:'key',model:'test',
   fetcher:(async()=>new Response('private token',{status:400})) as typeof fetch});
  await expect(interpreter.interpret('valid',3)).rejects.toThrow('model_http_400');
 });
});
