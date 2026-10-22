export interface FeedbackInterpretation {
 readonly pitchOnly:boolean;
 readonly protectedPrefixCount:number|null;
 readonly maxLeapSemitones:number|null;
 readonly explanation:string;
 readonly unresolved:readonly string[];
}
const NUMBER='[0-9零〇一二三四五六七八九十两]{1,4}';
const maxLength=500;
function readNumber(raw:string):number|null {
 if(/^\\d+$/.test(raw)){const n=Number(raw);return Number.isSafeInteger(n)?n:null;}
 const digits:Record<string,number>={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 if(raw==='十')return 10;
 const index=raw.indexOf('十');
 if(index>=0){
  const tens=index===0?1:digits[raw.slice(0,index)];
  const ones=index===raw.length-1?0:digits[raw.slice(index+1)];
  return tens!==undefined&&ones!==undefined?tens*10+ones:null;
 }
 return digits[raw]??null;
}
export function validateFeedbackInput(value:unknown,noteCount:unknown):{feedback:string;noteCount:number}{
 if(typeof value!=='string'||value.trim().length===0||value.length>maxLength)
  throw new Error('invalid_feedback_text');
 if(!Number.isSafeInteger(noteCount)||typeof noteCount!=='number'||noteCount<1||noteCount>32)
  throw new Error('invalid_feedback_note_count');
 return {feedback:value.trim(),noteCount};
}
const object=(v:unknown):v is Record<string,unknown>=>
 typeof v==='object'&&v!==null&&!Array.isArray(v);
/** Untrusted model output: reject unknown fields, inaccurate ranges, oversize explanations. */
export function validateFeedbackInterpretation(value:unknown,noteCount:number):FeedbackInterpretation{
 if(!Number.isSafeInteger(noteCount)||noteCount<1||noteCount>32)throw new Error('invalid_feedback_note_count');
 if(!object(value)||Object.keys(value).some(k=>!['pitchOnly','protectedPrefixCount','maxLeapSemitones','explanation','unresolved'].includes(k))||
  typeof value.pitchOnly!=='boolean'||typeof value.explanation!=='string'||!value.explanation.trim()||
  value.explanation.length>400||!Array.isArray(value.unresolved)||value.unresolved.length>6||
  value.unresolved.some(s=>typeof s!=='string'||!s.trim()||s.length>180))
  throw new Error('invalid_feedback_interpretation');
 const prefix=value.protectedPrefixCount,leap=value.maxLeapSemitones;
 if(prefix!==null&&(typeof prefix!=='number'||!Number.isSafeInteger(prefix)||prefix<1||
  prefix>16||prefix>=noteCount))throw new Error('invalid_feedback_interpretation');
 if(leap!==null&&(typeof leap!=='number'||!Number.isSafeInteger(leap)||leap<1||leap>24))
  throw new Error('invalid_feedback_interpretation');
 if(!value.pitchOnly&&(prefix!==null||leap!==null))throw new Error('invalid_feedback_interpretation');
 return {pitchOnly:value.pitchOnly,protectedPrefixCount:prefix as number|null,
  maxLeapSemitones:leap as number|null,explanation:value.explanation,
  unresolved:[...(value.unresolved as string[])]};
}
export function hasActionableFeedback(value:FeedbackInterpretation):boolean{
 return value.pitchOnly;
}
/**
 * Conservative offline interpretation: explicit numerical statements only.
 * It never infers numbers from subjective words such as "more dramatic".
 */
export function interpretFeedbackRules(input:string,noteCount:number):FeedbackInterpretation{
 const {feedback}=validateFeedbackInput(input,noteCount);
 const prefixMatches=[
  ...feedback.matchAll(new RegExp(`(?:保留|固定|保持|不要(?:改|动)|不改|不动)\\s*(?:乐句)?(?:开头|前)\\s*(${NUMBER})\\s*(?:个)?\\s*(?:音符|音)`,'g')),
  ...feedback.matchAll(new RegExp(`(?:乐句)?(?:开头|前)\\s*(${NUMBER})\\s*(?:个)?\\s*(?:音符|音)\\s*(?:不动|不改|保留|固定)`,'g'))
 ];
 const leaps=[...feedback.matchAll(new RegExp(`(?:最大|相邻)?\\s*(?:音高)?跳进\\s*(?:不超过|不得超过|至多|最多|小于等于|限制(?:在|为|到)|≤|<=)\\s*(${NUMBER})\\s*(?:个)?\\s*半音`,'g'))];
 const reasons:string[]=[];
 const resolve=(matches:RegExpMatchArray[],max:number,label:string)=>{
  if(matches.length===0)return null;
  const nums=matches.map(m=>readNumber(m[1]??''));
  if(nums.some(n=>n===null||n<1||n>max)||new Set(nums).size!==1){
   reasons.push(`${label}的数值有冲突或超出允许范围，需要手动确认。`);
   return null;
  }
  const n=nums[0]!;
  if(label==='保留开头音符'&&n>=noteCount){reasons.push('必须至少保留一个可以修改的音符，不能保护整个片段。');return null;}
  return n;
 };
 const prefix=resolve(prefixMatches,16,'保留开头音符');
 const leap=resolve(leaps,24,'最大跳进');
 const rhythm=/节奏(?:不变|保持|不要变|不改)|(?:保持|保留|不(?:要)?改变)\s*(?:原有|当前)?\s*(?:节奏|时值|力度)|仅(?:改变|修改|重写|调整)\s*音高|只(?:改变|修改|重写|调整)\s*音高/.test(feedback);
 const pitchOnly=prefix!==null||leap!==null||rhythm;
 if(!pitchOnly&&reasons.length===0)reasons.push('没有识别出可执行的数值约束；风格和情绪描述仍需人工判断。');
 if(pitchOnly&&/(更有张力|更丰富|太平|更流畅|更抒情|更激昂|更加戏剧化)/.test(feedback))
  reasons.push('情绪、张力等描述保留在原始指令中，尚未转换成强制音乐规则。');
 return validateFeedbackInterpretation({
  pitchOnly,protectedPrefixCount:prefix,maxLeapSemitones:leap,
  explanation:pitchOnly?
   `建议开启仅改音高${prefix===null?'':`；保留开头 ${prefix} 个音符`}${leap===null?'':`；跳进不超过 ${leap} 半音`}。需用户确认后才会更新编辑设置。`:
   '未能从反馈中提取明确、可执行的音高编辑约束。',
  unresolved:reasons
 },noteCount);
}
