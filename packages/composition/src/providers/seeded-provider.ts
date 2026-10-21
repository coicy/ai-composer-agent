import type {CompositionProvider,ProviderContext} from '../contracts/provider.js';
/** Development-only provider, no model or external API; demonstrates the provider contract. */
export class SeededProvider implements CompositionProvider {
 readonly id='seeded-dev';
 constructor(private readonly seed:number=19501){}
 async generate(context:ProviderContext):Promise<unknown>{
  let state=this.seed>>>0;
  const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const step=context.ppq/2;
  if(!Number.isSafeInteger(step))throw new Error('unsupported_ppq');
  const count=Math.min(32,Math.floor((context.endTick-context.startTick)/step));
  const notes=[];
  let pitch=67;
  for(let i=0;i<count;i++){
   pitch=Math.min(79,Math.max(60,pitch+(next()>.5?2:-2)));
   notes.push({pitch,startTick:context.startTick+i*step,durationTicks:step,velocity:80+Math.floor(next()*20)});
  }
  return {notes};
 }
}
