import type {MusicProject} from '@ai-composer/music-core';
import {compareRegionCandidate} from '@ai-composer/composition';
import type {RegionRegenerationCandidate} from '@ai-composer/composition';
interface Props {
 readonly project:MusicProject;
 readonly candidate:RegionRegenerationCandidate;
 readonly compact?:boolean;
}
const format=(value:number|null)=>value===null?'无可比音符':String(value);
export function RegionCandidateMetrics({project,candidate,compact=false}:Props){
 const m=compareRegionCandidate(project,candidate);
 if(compact)return <span className="region-variant-metrics">
  {candidate.editConstraint==='pitch_only'?<>改变音高 {m.changedPitchCount} 处</>:
   <>新增 {m.addedNoteCount} · 删除 {m.removedNoteCount}</>}
  {' · '}最大连续跳进 {format(m.maxSequentialLeapAfter)} 半音
 </span>;
 return <section className="region-candidate-metrics" role="region" aria-label="局部候选客观差异">
  <strong>客观音符差异（当前候选与批准前工程）</strong>
  <dl>
   <div><dt>选区音符</dt><dd>{m.originalNoteCount} → {m.proposedNoteCount}</dd></div>
   <div><dt>新增 / 删除</dt><dd>{m.addedNoteCount} / {m.removedNoteCount}</dd></div>
   <div><dt>原 ID 的音高改变</dt><dd>{m.changedPitchCount} 处（保留 ID {m.preservedNoteCount} 个）</dd></div>
   <div><dt>平均绝对音高变化</dt><dd>{m.meanAbsPitchShift===null?'不可按原 ID 对比':m.meanAbsPitchShift+' 半音'}</dd></div>
   <div><dt>最大绝对音高变化</dt><dd>{m.maxAbsPitchShift===null?'不可按原 ID 对比':m.maxAbsPitchShift+' 半音'}</dd></div>
   <div><dt>最大连续跳进（前 → 后）</dt><dd>{format(m.maxSequentialLeapBefore)} → {format(m.maxSequentialLeapAfter)} 半音</dd></div>
  </dl>
  <p>跳进仅比较选区内相邻且不重叠的音符；新增、删除时不猜测音符配对。这是可核对的数据摘要，不是音乐质量评分。</p>
 </section>;
}
