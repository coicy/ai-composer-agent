import type {ArrangementAssessment} from '@ai-composer/composition';
interface Props {assessment:ArrangementAssessment;}
export function ArrangementDiagnostics({assessment}:Props){
 const {tonalProfile,chordSuggestions,metrics,findings,disclaimer}=assessment;
 const tonalText=tonalProfile.status==='insufficient'
  ?'证据不足，暂不判断调性'
  :tonalProfile.status==='ambiguous'
   ?'存在多种可能调性（不确定）'
   :`可能倾向 ${tonalProfile.hypotheses[0]?.name??'未知调式'}（仅启发式）`;
 return <section className="arrangement-diagnostics" role="region" aria-label="编配结构诊断">
  <strong>编配结构诊断 · 启发式建议</strong>
  <p>主旋律调性：{tonalText}</p>
  {tonalProfile.hypotheses.length>0&&<p>参考候选：{tonalProfile.hypotheses.map(h=>h.name).join(' / ')}</p>}
  <p>小节和弦假设：{chordSuggestions.map((ch,i)=>`第 ${i+1} 段 ${ch.name?`${ch.name}（待核听）`:'信息不足'}`).join('；')}</p>
  <p>结构统计：同时发声的旋律–和声音程 {metrics.simultaneousMelodyHarmony} 对；
   紧张音程 {metrics.dissonantMelodyHarmony} 对；低音高于旋律 {metrics.bassAboveMelody} 处；相邻声部跳进超过八度 {metrics.largeVoiceLeaps} 处。</p>
  {findings.length===0?<p>未发现当前规则定义的结构性提醒；这不代表音乐质量合格。</p>:
   <ul>{findings.map(f=><li key={f.code}><strong>{f.count} 处：</strong>{f.message}</li>)}</ul>}
  <p className="diagnostic-disclaimer">{disclaimer}</p>
 </section>;
}
