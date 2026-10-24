import type {TechniqueEvidence} from './electronic-technique-evidence.js';

export interface SignatureAudit {
 readonly status:'ready_for_listening'|'retry_recommended'|'needs_manual_review';
 readonly missing:readonly string[];
 readonly unevaluable:readonly string[];
 readonly observed:readonly string[];
 readonly guidance:string;
}
/** Do not interpret a heuristic MIDI metric as proof of musical quality. */
export function auditSignatureTechniques(evidence:readonly TechniqueEvidence[]):SignatureAudit{
 if(!Array.isArray(evidence)||evidence.some(e=>!e||
  !['signature','supporting','optional'].includes(e.priority)||
  !['observed','not_observed','not_evaluable'].includes(e.state)||
  typeof e.id!=='string'||e.advisory!==true))throw Error('invalid_signature_evidence');
 const signatures=evidence.filter(e=>e.priority==='signature');
 const missing=signatures.filter(e=>e.state==='not_observed').map(e=>e.id);
 const unevaluable=signatures.filter(e=>e.state==='not_evaluable').map(e=>e.id);
 const observed=signatures.filter(e=>e.state==='observed').map(e=>e.id);
 return {
  status:missing.length?'retry_recommended':unevaluable.length?'needs_manual_review':'ready_for_listening',
  missing,unevaluable,observed,
  guidance:missing.length?
   'Core style technique was not detected in MIDI; consider regenerating this role within existing user permission and preview the difference.':
   unevaluable.length?
    'One or more signature techniques are beyond the current MIDI evidence capability. Do not claim they were realized.':
    'MIDI heuristics found signature cues. Auditory verification and human approval are still required.'
 };
}
