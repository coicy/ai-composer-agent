/** Reproducible, musically contextual *ideas*, never an AI note-generation engine. */
export type Axis='rhythm'|'motif'|'harmony'|'texture'|'form'|'expression';
export type Level='subtle'|'balanced'|'adventurous';
export type Mode='ionian'|'aeolian'|'dorian'|'mixolydian'|'phrygian'|'lydian'|'locrian'|'major_pentatonic'|'minor_pentatonic';
export type Groove='straight'|'swing'|'shuffle';
export interface InspirationInput {
 readonly seed:number;readonly level:Level;readonly ppq:number;
 readonly meter:string;readonly mode:Mode;readonly groove:Groove;
 readonly startTick:number;readonly endTick:number;
 readonly focus?:readonly Axis[];readonly editableOtherTracks?:number;
}
export interface InspirationCard {
 readonly id:string;readonly axis:Axis;readonly title:string;readonly instruction:string;
 readonly intensity:'low'|'medium'|'high';
}
export interface InspirationPack {
 readonly algorithm:'musical-inspiration-v1';
 readonly seed:number;readonly level:Level;
 readonly target:{meter:string;mode:Mode;groove:Groove;scopeBars:number};
 readonly cards:readonly InspirationCard[];readonly briefLines:readonly string[];
 readonly warnings:readonly string[];
}
interface Card extends InspirationCard {
 readonly minBars?:number;readonly grooves?:readonly Groove[];
 readonly meterFamily?:'compound'|'triple';
 readonly otherTracks?:boolean;readonly density?:'sparse'|'dense';
}
const AXES:readonly Axis[]=['rhythm','motif','harmony','texture','form','expression'];
const MODES:readonly string[]=['ionian','aeolian','dorian','mixolydian','phrygian','lydian','locrian','major_pentatonic','minor_pentatonic'];
const LEVELS:Record<Level,number>={subtle:0,balanced:1,adventurous:2};
/** Original directives; not copies of third-party creativity decks. */
const LIBRARY:readonly Card[]=[
 {id:'r_breath',axis:'rhythm',title:'节奏留白',intensity:'low',density:'sparse',
  instruction:'Leave a deliberate rest before one important arrival; preserve the clear underlying beat.'},
 {id:'r_answer',axis:'rhythm',title:'错拍回答',intensity:'medium',
  instruction:'Let a short response begin on an offbeat while the original phrase retains its metric anchor.'},
 {id:'r_syncopation',axis:'rhythm',title:'切分动机',intensity:'high',density:'dense',minBars:2,
  instruction:'Repeat one syncopated rhythmic fragment and return to a stable downbeat at the cadence.'},
 {id:'r_compound',axis:'rhythm',title:'复拍交织',intensity:'medium',meterFamily:'compound',minBars:2,
  instruction:'Contrast internal subdivisions within the existing compound meter; do not change the beat grouping.'},
 {id:'r_shuffle_pickup',axis:'rhythm',title:'摇摆弱起',intensity:'medium',grooves:['swing','shuffle'],minBars:2,
  instruction:'Use a rare shuffled or swung pickup near a phrase boundary, avoiding a uniform triplet grid.'},
 {id:'m_echo',axis:'motif',title:'短动机回声',intensity:'low',
  instruction:'Reprise a recognizable permitted interval contour once with an altered articulation or rhythm.'},
 {id:'m_question',axis:'motif',title:'问答乐句',intensity:'medium',minBars:4,
  instruction:'Pose a short melodic question and answer it with a related, rhythmically contrasting phrase.'},
 {id:'m_fragment',axis:'motif',title:'动机碎片重组',intensity:'high',minBars:4,
  instruction:'Fragment one motif, change its order for one phrase, then restore the identifiable original contour.'},
 {id:'h_pedal',axis:'harmony',title:'音阶内持续音',intensity:'low',
  instruction:'Sustain one in-mode pedal pitch under the melodic motion; keep the declared tonic stable.'},
 {id:'h_color',axis:'harmony',title:'调式色彩',intensity:'medium',
  instruction:'Highlight one distinctive scale tone of the requested mode without borrowing forbidden pitches.'},
 {id:'h_suspension',axis:'harmony',title:'悬置解决',intensity:'high',minBars:2,
  instruction:'Shape a local suspension and release within the explicitly allowed pitch classes.'},
 {id:'t_register',axis:'texture',title:'音域反差',intensity:'low',
  instruction:'Give the selected editable part a short response in a contrasting register, avoiding voice collision.'},
 {id:'t_reply',axis:'texture',title:'声部接力',intensity:'medium',otherTracks:true,
  instruction:'Let the selected track answer a phrase played by another existing part; do not edit that other track.'},
 {id:'t_subtract',axis:'texture',title:'减法配器',intensity:'high',otherTracks:true,density:'sparse',
  instruction:'Thin the selected track for one phrase while another track maintains the pulse; preserve locked material.'},
 {id:'f_pause',axis:'form',title:'段落呼吸',intensity:'low',minBars:2,density:'sparse',
  instruction:'Reduce density before the next phrase, then return to the previous thematic shape.'},
 {id:'f_three_one',axis:'form',title:'三加一变化',intensity:'medium',minBars:4,
  instruction:'Establish a recognizable idea across three measures, then alter one feature in measure four.'},
 {id:'f_reprise',axis:'form',title:'意外再现',intensity:'high',minBars:4,
  instruction:'Reintroduce a shortened version of the main motif earlier than expected, before the planned cadence.'},
 {id:'e_arc',axis:'expression',title:'力度弧线',intensity:'low',
  instruction:'Use a purposeful phrase-wide velocity rise and fall rather than independent random velocity changes.'},
 {id:'e_breath',axis:'expression',title:'句末呼吸',intensity:'medium',
  instruction:'Create articulation contrast by leaving small gaps at an appropriate phrase boundary.'},
 {id:'e_surprise',axis:'expression',title:'单次力度反差',intensity:'high',minBars:2,
  instruction:'Add one carefully placed phrase-level dynamic contrast, then recover the earlier energy.'}
];
function u32(v:unknown):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff;}
/** Same (seed, card) yields the same score regardless of catalog array ordering. */
function score(seed:number,key:string):number{
 let n=(2166136261^seed)>>>0;
 for(let i=0;i<key.length;i++)n=Math.imul(n^key.charCodeAt(i),16777619)>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;
 return (n^(n>>>16))>>>0;
}
function inspect(input:InspirationInput):{bars:number;axes:readonly Axis[];family:string}{
 if(!u32(input.seed))throw Error('invalid_inspiration_seed');
 if(!Object.hasOwn(LEVELS,input.level))throw Error('invalid_inspiration_level');
 if(!Number.isSafeInteger(input.ppq)||input.ppq<24||input.ppq>9600)throw Error('invalid_inspiration_ppq');
 if(!/^(?:[2-9]|1[0-2])\/(?:2|4|8|16)$/.test(input.meter))throw Error('invalid_inspiration_meter');
 const [numerator,denominator]=input.meter.split('/').map(Number);
 const barTicks=input.ppq*numerator!*4/denominator!;
 if(!Number.isSafeInteger(barTicks))throw Error('unsupported_inspiration_meter_ppq');
 if(!MODES.includes(input.mode))throw Error('invalid_inspiration_mode');
 if(!['straight','swing','shuffle'].includes(input.groove))throw Error('invalid_inspiration_groove');
 if(!Number.isSafeInteger(input.startTick)||!Number.isSafeInteger(input.endTick)||
  input.startTick<0||input.endTick<=input.startTick||
  input.endTick-input.startTick>input.ppq*4*16)throw Error('invalid_inspiration_scope');
 if(input.editableOtherTracks!==undefined&&(!Number.isSafeInteger(input.editableOtherTracks)||
  input.editableOtherTracks<0||input.editableOtherTracks>128))throw Error('invalid_inspiration_tracks');
 if(input.focus!==undefined&&(!Array.isArray(input.focus)||input.focus.length<1||
  input.focus.length>AXES.length||input.focus.some(a=>typeof a!=='string'||!AXES.includes(a))||
  new Set(input.focus).size!==input.focus.length))throw Error('invalid_inspiration_focus');
 return {bars:(input.endTick-input.startTick)/barTicks,axes:input.focus??AXES,
  family:denominator===8&&numerator!>=6&&numerator!%3===0?'compound':numerator===3&&denominator===4?'triple':'other'};
}
export function drawMusicalInspiration(input:InspirationInput):InspirationPack{
 const {bars,axes,family}=inspect(input);
 const ranked=axes.map(axis=>{
  const pool=LIBRARY.filter(card=>card.axis===axis&&
   LEVELS[input.level]>=({low:0,medium:1,high:2} as const)[card.intensity]&&
   (card.minBars===undefined||bars>=card.minBars)&&
   (card.otherTracks!==true||(input.editableOtherTracks??0)>0)&&
   (card.grooves===undefined||card.grooves.includes(input.groove))&&
   (card.meterFamily===undefined||card.meterFamily===family))
   .map(card=>({card,rank:score(input.seed,'card/'+card.id)}))
   .sort((a,b)=>a.rank-b.rank||a.card.id.localeCompare(b.card.id));
  return {axis,pool,rank:score(input.seed,'axis/'+axis)};
 }).filter(x=>x.pool.length).sort((a,b)=>a.rank-b.rank||a.axis.localeCompare(b.axis));
 const target=Math.min(input.level==='subtle'?2:input.level==='balanced'?3:4,ranked.length);
 const selected:Card[]=[];
 for(const group of ranked){
  if(selected.length>=target)break;
  const next=group.pool.find(({card})=>!selected.some(old=>
   old.density&&card.density&&old.density!==card.density));
  if(next)selected.push(next.card);
 }
 if(selected.length===0)throw Error('inspiration_no_compatible_cards');
 const cards=selected.map(({id,axis,title,instruction,intensity})=>({id,axis,title,instruction,intensity}));
 return {
  algorithm:'musical-inspiration-v1',seed:input.seed,level:input.level,
  target:{meter:input.meter,mode:input.mode,groove:input.groove,scopeBars:Number(bars.toFixed(3))},
  cards,
  briefLines:cards.map((c,i)=>String(i+1)+'. ['+c.axis+'/'+c.id+'] '+c.instruction),
  warnings:[
   'Optional inspiration directions only, not generated MIDI, not a trained music model.',
   'Preserve all user hard constraints, locked tracks, revision and authorized scope.',
   'The same seed reproduces these cards for algorithm v1, NOT remote LLM music.',
   'No selected card or probability indicates higher musical quality.'
  ]
 };
}
