import type {HarmonyPlan,ArrangementRole,ChordEvent,DiatonicDegree} from '@ai-composer/composition';
import {ARRANGEMENT_ROLES} from '@ai-composer/composition';
import type {PlanConstraint} from '@ai-composer/composition';

export interface HarmonyPlanDraft{
 readonly enabled:boolean;
 readonly tonic:number;
 readonly mode:'major'|'minor';
 readonly progression:string;
 readonly timelineEnabled:boolean;
 readonly timeline:readonly ChordEvent[];
 readonly passingTones:'none'|'stepwise';
 readonly registers:HarmonyPlan['registers'];
 readonly enforcement:HarmonyPlan['enforcement'];
}
interface Props{
 readonly value:HarmonyPlanDraft;
 readonly barCount:number;
 readonly onChange:(next:HarmonyPlanDraft)=>void;
}
const notes=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'] as const;
const roles:Readonly<Record<ArrangementRole,string>>={harmony:'和声',bass:'低音',accompaniment:'伴奏'};
const types:Readonly<Record<keyof HarmonyPlan['enforcement'],string>>={scale:'调内音',chords:'每小节和弦音',registers:'声部音域',inversions:'低音转位'};
export function timelineFromDegrees(text:string,barCount:number):ChordEvent[]{
 const degrees=text.split(',').map(x=>Number(x.trim()));
 return Array.from({length:barCount},(_,i)=>({startBeat:i*4,durationBeats:4,degree:(degrees[i]??1) as DiatonicDegree,seventh:false,inversion:0}));
}
export function HarmonyPlanEditor({value:v,barCount,onChange}:Props){
 const set=(fields:Partial<HarmonyPlanDraft>)=>onChange({...v,...fields});
 const edit=(index:number,changes:Partial<ChordEvent>)=>set({timeline:v.timeline.map((ev,i)=>i===index?{...ev,...changes}:ev)});
 const split=(index:number)=>{
  const ev=v.timeline[index];if(!ev||ev.durationBeats<2)return;
  const left=Math.floor(ev.durationBeats/2);
  set({timeline:v.timeline.flatMap((e,i)=>i===index?[{...ev,durationBeats:left},{...ev,startBeat:ev.startBeat+left,durationBeats:ev.durationBeats-left}]:[e])});
 };
 const merge=(index:number)=>{
  const a=v.timeline[index],b=v.timeline[index+1];if(!a||!b)return;
  set({timeline:v.timeline.flatMap((e,i)=>i===index?[{...a,durationBeats:a.durationBeats+b.durationBeats}]:i===index+1?[]:[e])});
 };
 return <fieldset className="harmonic-plan" aria-label="和声规划">
  <legend>编配和声规划</legend>
  <label className="plan-enable"><input type="checkbox" checked={v.enabled} onChange={e=>set({enabled:e.target.checked})}/>启用可控和声规划</label>
  {v.enabled&&<>
   <p>当前 {barCount} 小节。可选择传统逐小节三和弦，或按拍点编辑和弦时间轴。</p>
   <label>主音 <select aria-label="规划主音" value={v.tonic} onChange={e=>set({tonic:Number(e.target.value)})}>
    {notes.map((n,i)=><option key={i} value={i}>{n}</option>)}
   </select></label>
   <label>调式 <select aria-label="规划调式" value={v.mode} onChange={e=>set({mode:e.target.value as HarmonyPlanDraft['mode']})}>
    <option value="major">大调</option><option value="minor">自然小调</option>
   </select></label>
   <label className="plan-enable"><input type="checkbox" checked={v.timelineEnabled} onChange={e=>set({timelineEnabled:e.target.checked,timeline:e.target.checked?timelineFromDegrees(v.progression,barCount):v.timeline})}/>启用小节内和弦时间轴</label>
   {!v.timelineEnabled&&<label>和弦级数 <input aria-label="逐小节和弦级数" type="text" value={v.progression} onChange={e=>set({progression:e.target.value})} placeholder="1,4,5,1"/></label>}
   {v.timelineEnabled&&<div className="chord-timeline" role="group" aria-label="和弦时间轴">
    <p>按四分音符拍点拆分和弦，允许小节内变化；七和弦按所选音阶隔音叠置。转位指定低音在每段的首个起音。</p>
    {v.timeline.map((ev,index)=><div className="chord-event" key={ev.startBeat}>
     <strong>第 {Math.floor(ev.startBeat/4)+1} 小节 · 起点第 {ev.startBeat%4+1} 拍 · 持续 {ev.durationBeats} 拍</strong>
     <label>级数 <select aria-label={`时间轴第${index+1}段级数`} value={ev.degree}
      onChange={e=>edit(index,{degree:Number(e.target.value) as DiatonicDegree})}>
      {[1,2,3,4,5,6,7].map(d=><option key={d} value={d}>{d}</option>)}
     </select></label>
     <label><input type="checkbox" aria-label={`时间轴第${index+1}段七和弦`} checked={ev.seventh}
      onChange={e=>edit(index,{seventh:e.target.checked,inversion:!e.target.checked&&ev.inversion===3?0:ev.inversion})}/>七和弦</label>
     <label>转位 <select aria-label={`时间轴第${index+1}段转位`} value={ev.inversion}
      onChange={e=>edit(index,{inversion:Number(e.target.value) as ChordEvent['inversion']})}>
      {Array.from({length:ev.seventh?4:3},(_,i)=><option key={i} value={i}>{i===0?'原位':`第${i}转位`}</option>)}
     </select></label>
     <button type="button" disabled={ev.durationBeats<2||v.timeline.length>=barCount*4} onClick={()=>split(index)}>拆分</button>
     <button type="button" disabled={index===v.timeline.length-1} onClick={()=>merge(index)}>合并下一段</button>
    </div>)}
   </div>}
   <label>和弦外级进经过音 <select aria-label="经过音策略" value={v.passingTones} onChange={e=>set({passingTones:e.target.value as HarmonyPlanDraft['passingTones']})}>
    <option value="none">禁止例外</option><option value="stepwise">允许严格级进经过音</option>
   </select></label>
   <div className="plan-policies">
    {(Object.keys(types) as (keyof HarmonyPlan['enforcement'])[]).map(kind=><label key={kind}>{types[kind]}
     <select aria-label={`${types[kind]}约束`} value={v.enforcement[kind]??'soft'} onChange={e=>set({enforcement:{...v.enforcement,[kind]:e.target.value as PlanConstraint}})}>
      <option value="hard">硬约束（不满足就拒绝）</option><option value="soft">风格偏好（报告提醒）</option>
     </select></label>)}
   </div>
   <div className="plan-registers">
    {ARRANGEMENT_ROLES.map(role=><div key={role}>
     <strong>{roles[role]}音域（MIDI）</strong>
     <label>最低 <input aria-label={`${roles[role]}最低音`} type="number" min={0} max={127} value={v.registers[role].minPitch}
      onChange={e=>set({registers:{...v.registers,[role]:{...v.registers[role],minPitch:Number(e.target.value)}}})}/></label>
     <label>最高 <input aria-label={`${roles[role]}最高音`} type="number" min={0} max={127} value={v.registers[role].maxPitch}
      onChange={e=>set({registers:{...v.registers,[role]:{...v.registers[role],maxPitch:Number(e.target.value)}}})}/></label>
    </div>)}
   </div>
   <p>硬约束由服务端和客户端确定性检查；原始主旋律不受规划限制。风格偏好不会自动改写模型结果。</p>
  </>}
 </fieldset>;
}
