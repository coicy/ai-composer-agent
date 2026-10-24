import type {ElectronicStyle} from './electronic-techniques.js';

/** Preview-only automation envelope: the renderer must opt in to consume these points. */
export type AutomationLane='gain'|'filter_hz';
export type AutomationRole='bass'|'harmony'|'accompaniment'|'drums';
export interface AutomationPoint { readonly tick:number;readonly value:number; }
export interface AutomationCurve {readonly role:AutomationRole;readonly lane:AutomationLane;readonly points:readonly AutomationPoint[];readonly reason:string;}
export interface AutomationRequest {
 readonly style:ElectronicStyle;readonly seed:number;readonly ppq:number;
 readonly startTick:number;readonly bars:number;readonly beatsPerBar?:number;
 readonly availableRoles:readonly AutomationRole[];
 readonly disabled?:readonly AutomationLane[];
 readonly intensity?:'subtle'|'standard';
}
export interface AutomationPlan {
 readonly version:'phrase-automation-v1';
 readonly curves:readonly AutomationCurve[];
 readonly caveats:readonly string[];
}
const STYLES:readonly ElectronicStyle[]=['house','synthwave','techno','trance','drum_and_bass','ambient','chiptune'];
const ROLES:readonly AutomationRole[]=['bass','harmony','accompaniment','drums'];
const LANES:readonly AutomationLane[]=['gain','filter_hz'];
function u32(n:number){return Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;}
function hash(seed:number,s:string){let h=seed>>>0;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h;}
function bounds(curve:AutomationCurve,endTick:number){
 if(curve.points.length<2||curve.points.length>64)throw Error('invalid_automation_point_count');
 let last=-1;
 for(const p of curve.points){
  if(!Number.isSafeInteger(p.tick)||p.tick<=last||p.tick>endTick||p.tick<0)throw Error('invalid_automation_tick');
  if(!Number.isFinite(p.value)||(curve.lane==='gain'?(p.value<0||p.value>1):(p.value<100||p.value>16000)))throw Error('invalid_automation_value');
  last=p.tick;
 }
}
/** Deterministic, section-relative suggestions. Does not assert an audible result or persist MIDI. */
export function planPhraseAutomation(r:AutomationRequest):AutomationPlan{
 if(!STYLES.includes(r.style)||!u32(r.seed)||!Number.isSafeInteger(r.ppq)||r.ppq<24||r.ppq>9600||
  !Number.isSafeInteger(r.startTick)||r.startTick<0||!Number.isSafeInteger(r.bars)||r.bars<1||r.bars>32||
  !Number.isSafeInteger(r.beatsPerBar??4)||(r.beatsPerBar??4)<2||(r.beatsPerBar??4)>12||
  !Array.isArray(r.availableRoles)||new Set(r.availableRoles).size!==r.availableRoles.length||
  r.availableRoles.some(x=>!ROLES.includes(x))||
  (r.disabled!==undefined&&(!Array.isArray(r.disabled)||new Set(r.disabled).size!==r.disabled.length||r.disabled.some(x=>!LANES.includes(x))))||
  (r.intensity!==undefined&&r.intensity!=='subtle'&&r.intensity!=='standard'))throw Error('invalid_automation_request');
 const beatTicks=r.ppq,barTicks=beatTicks*(r.beatsPerBar??4);
 const end=r.startTick+r.bars*barTicks;
 if(!Number.isSafeInteger(end)||end>Number.MAX_SAFE_INTEGER-1)throw Error('invalid_automation_range');
 const disabled=new Set(r.disabled??[]);
 const curves:AutomationCurve[]=[];
 const unit=r.intensity==='subtle'?0.045:0.105;
 for(const role of r.availableRoles){
  if(!disabled.has('gain')){
   const points:AutomationPoint[]=[{tick:r.startTick,value:1}];
   // Keep the structural core intact; only the final phrase bar subtly lifts or drops.
   const penultimate=r.startTick+Math.max(0,r.bars-1)*barTicks;
   if(penultimate>r.startTick)points.push({tick:penultimate,value:1});
   const dip=(hash(r.seed,r.style+'/'+role)%2===0);
   const boundary=Math.max(penultimate+1,end-Math.max(1,Math.floor(beatTicks/2)));
   points.push({tick:boundary,value:Number((1+(dip?-unit:unit)).toFixed(3))});
   points.push({tick:end,value:1});
   const unique=points.filter((p,i)=>i===0||p.tick>points[i-1]!.tick);
   if(unique.length>=2){const curve:AutomationCurve={role,lane:'gain',points:unique,reason:'phrase-end energy contour with return'};bounds(curve,end);curves.push(curve);}
  }
  // No invented acoustic requirement: ambient/synthwave pads and trance arps benefit from optional filter motion.
  if(!disabled.has('filter_hz')&&(role==='harmony'||role==='accompaniment')&&['ambient','synthwave','trance'].includes(r.style)){
   const low=r.intensity==='subtle'?2400:1400;
   const high=r.intensity==='subtle'?3600:5200;
   const curve:AutomationCurve={role,lane:'filter_hz',points:[
    {tick:r.startTick,value:low},{tick:r.startTick+Math.max(1,Math.floor((end-r.startTick)/2)),value:high},{tick:end,value:low}
   ],reason:'optional phrase-scale spectral movement'};
   bounds(curve,end);curves.push(curve);
  }
 }
 return {version:'phrase-automation-v1',curves,caveats:[
  'Automation is a non-destructive suggestion; it is not rendered or persisted until a playback integration explicitly applies it.',
  'No drums are synthesized from this plan; missing arrangement roles are never invented.',
  'Style defaults are heuristic, and explicit disabled lanes always win.'
 ]};
}
