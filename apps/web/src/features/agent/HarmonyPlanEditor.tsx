import type {HarmonyPlan,ArrangementRole} from '@ai-composer/composition';
import {ARRANGEMENT_ROLES} from '@ai-composer/composition';
import type {PlanConstraint} from '@ai-composer/composition';

export interface HarmonyPlanDraft{
 readonly enabled:boolean;
 readonly tonic:number;
 readonly mode:'major'|'minor';
 readonly progression:string;
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
const types:Readonly<Record<keyof HarmonyPlan['enforcement'],string>>={scale:'调内音',chords:'每小节和弦音',registers:'声部音域'};
export function HarmonyPlanEditor({value:v,barCount,onChange}:Props){
 const set=(fields:Partial<HarmonyPlanDraft>)=>onChange({...v,...fields});
 return <fieldset className="harmonic-plan" aria-label="和声规划">
  <legend>编配和声规划</legend>
  <label className="plan-enable"><input type="checkbox" checked={v.enabled} onChange={e=>set({enabled:e.target.checked})}/>启用可控和声规划</label>
  {v.enabled&&<>
   <p>逐小节输入 1–7 级（当前 {barCount} 小节）。例如 1,4,5,1 表示 I–IV–V–I；小调按自然小调音阶构成三和弦。</p>
   <label>主音 <select aria-label="规划主音" value={v.tonic} onChange={e=>set({tonic:Number(e.target.value)})}>
    {notes.map((n,i)=><option key={i} value={i}>{n}</option>)}
   </select></label>
   <label>调式 <select aria-label="规划调式" value={v.mode} onChange={e=>set({mode:e.target.value as HarmonyPlanDraft['mode']})}>
    <option value="major">大调</option><option value="minor">自然小调</option>
   </select></label>
   <label>和弦级数 <input aria-label="逐小节和弦级数" type="text" value={v.progression} onChange={e=>set({progression:e.target.value})} placeholder="1,4,5,1"/></label>
   <div className="plan-policies">
    {(Object.keys(types) as (keyof HarmonyPlan['enforcement'])[]).map(kind=><label key={kind}>{types[kind]}
     <select aria-label={`${types[kind]}约束`} value={v.enforcement[kind]} onChange={e=>set({enforcement:{...v.enforcement,[kind]:e.target.value as PlanConstraint}})}>
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
