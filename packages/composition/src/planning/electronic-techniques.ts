/**
 * Style-conditioned arrangement technique planner.
 * It recommends ORIGINAL musical instructions, not MIDI, preset sounds or an AI model.
 * A high-priority style anchor stays the default; users can explicitly remove or replace it.
 * Deliberately versioned: only the exact planner version + full arguments reproduce suggestions.
 */
export type ElectronicStyle='house'|'synthwave'|'techno'|'trance'|'drum_and_bass'|'ambient'|'chiptune';
export type TechniqueSlot='drums'|'bass'|'harmony_motion'|'harmony_sustain'|'transition';
export type TechniqueId=
 'four_floor'|'retro_backbeat'|'breakbeat_two_step'|'sparse_pulse'|
 'offbeat_bass'|'octave_bass'|'rolling_bass'|'reese_bass'|'sub_drone'|
 'arpeggio_pingpong'|'arpeggio_ascending'|'chord_stabs'|'ostinato'|'alberti'|
 'pad_chords'|'pedal_tone'|'short_fill'|'phrase_break';
export type VariationGesture='vary_accents'|'motif_answer'|'register_shift'|'reduce_density'|'late_fill'|'alternate_arpeggio_direction';
export interface TechniqueSpec{
 readonly id:TechniqueId;readonly slot:TechniqueSlot;readonly instruction:string;
 readonly roles:readonly string[];readonly risk?:string;
}
export interface TechniqueChoice{
 readonly id:TechniqueId;readonly slot:TechniqueSlot;readonly priority:'signature'|'supporting'|'optional';
 readonly weight:number;readonly evidence:'genre_design_heuristic';
 readonly instruction:string;
 readonly canDisable:true;
}
export interface TechniquePlan{
 readonly version:'electronic-technique-plan-v1';
 readonly style:ElectronicStyle;readonly seed:number;readonly variant:number;
 readonly choices:readonly TechniqueChoice[];
 readonly gestures:readonly VariationGesture[];
 readonly guidelines:readonly string[];
 readonly caveats:readonly string[];
}
export interface TechniqueRequest{
 readonly style:ElectronicStyle;readonly seed:number;readonly variant?:number;
 readonly disabled?:readonly TechniqueId[];
 readonly forced?:readonly TechniqueId[];
 readonly maxActiveSlots?:number;
}
const SPECS:readonly TechniqueSpec[]=[
 {id:'four_floor',slot:'drums',instruction:'Place four deliberate kick beats in every 4/4 bar; add selected snare/clap and hats as separate lanes. Use phrase-dependent accent/variation, not identical copying.',roles:['kick','clap','hats']},
 {id:'retro_backbeat',slot:'drums',instruction:'Use a coherent retro kick/snare backbeat with an occasional hat variation at phrase boundaries.',roles:['kick','snare','hats']},
 {id:'breakbeat_two_step',slot:'drums',instruction:'Use a fast two-step/broken-beat kick/snare skeleton, hats on subdivided grids and sparse fills without destroying the backbeat.',roles:['kick','snare','hats']},
 {id:'sparse_pulse',slot:'drums',instruction:'Use sparse restrained pulses or silence where appropriate; do not impose dance drums on an ambient scene.',roles:['percussion']},
 {id:'offbeat_bass',slot:'bass',instruction:'Create short bass notes on selected offbeats that complement the kick; retain chord/root identity and explicit bass range.',roles:['bass']},
 {id:'octave_bass',slot:'bass',instruction:'Alternate tonic/root and its octave in a memorable repeating bass figure with controlled gate.',roles:['bass']},
 {id:'rolling_bass',slot:'bass',instruction:'Sustain a consistent note-cycle with chord-aware changes and deliberate accents; check interaction with kick.',roles:['bass']},
 {id:'reese_bass',slot:'bass',instruction:'Write an independent syncopated sub-bass contour; Reese timbre belongs to production, not MIDI pitches.',roles:['bass']},
 {id:'sub_drone',slot:'bass',instruction:'Hold or occasionally rearticulate a tonal pedal/sub drone and reduce unnecessary note density.',roles:['bass']},
 {id:'arpeggio_pingpong',slot:'harmony_motion',instruction:'Arpeggiate current chord tones in a stable up/down order with visible rate/gate, phase and chord-change handling.',roles:['accompaniment','arp']},
 {id:'arpeggio_ascending',slot:'harmony_motion',instruction:'Build a chord-tone ascending arpeggio with occasional phrase end contour changes and no copied reference melodies.',roles:['accompaniment','arp']},
 {id:'chord_stabs',slot:'harmony_motion',instruction:'Place syncopated chord stabs with offbeat accents and rests, keeping space for kick and bass.',roles:['accompaniment','harmony']},
 {id:'ostinato',slot:'harmony_motion',instruction:'Maintain a recognizable ostinato motif, change ONE feature at planned bar boundaries and restore the motif.',roles:['accompaniment']},
 {id:'alberti',slot:'harmony_motion',instruction:'Repeat low-high-middle-high chord-tone movement using the actual chosen voicing.',roles:['accompaniment']},
 {id:'pad_chords',slot:'harmony_sustain',instruction:'Sustain harmony in a separate register behind the lead and moving part, with intentional phrase-level dynamics.',roles:['harmony','pad']},
 {id:'pedal_tone',slot:'harmony_sustain',instruction:'Hold a selected permitted scale tone as a pedal; coordinate any non-chord suspension with confirmed harmony.',roles:['harmony','pad']},
 {id:'short_fill',slot:'transition',instruction:'Reserve a short fill window near a section boundary; neighboring parts yield space before the return.',roles:['drums','accompaniment']},
 {id:'phrase_break',slot:'transition',instruction:'Subtract one or two layers for a short phrase break and return to the core motif without changing the user section structure.',roles:['all']}
];
// Each number is a STYLE DESIGN HEURISTIC, not an empirical frequency from MIDI training data.
const WEIGHTS:Readonly<Record<ElectronicStyle,Partial<Record<TechniqueId,number>>>>={
 house:{four_floor:100,offbeat_bass:96,chord_stabs:92,pad_chords:68,short_fill:65,phrase_break:60,
  octave_bass:40,retro_backbeat:30,arpeggio_pingpong:32,ostinato:26,pedal_tone:20},
 synthwave:{retro_backbeat:94,octave_bass:96,arpeggio_pingpong:98,pad_chords:98,short_fill:52,
  phrase_break:60,four_floor:40,offbeat_bass:30,arpeggio_ascending:70,ostinato:62,sub_drone:45},
 techno:{four_floor:98,rolling_bass:91,ostinato:98,pedal_tone:82,short_fill:67,phrase_break:76,
  offbeat_bass:65,chord_stabs:45,pad_chords:51},
 trance:{four_floor:98,rolling_bass:93,arpeggio_ascending:99,pad_chords:95,short_fill:75,phrase_break:86,
  arpeggio_pingpong:84,offbeat_bass:48},
 drum_and_bass:{breakbeat_two_step:100,reese_bass:98,ostinato:72,pad_chords:56,short_fill:90,
  phrase_break:73,chord_stabs:57,sub_drone:65},
 ambient:{sparse_pulse:42,sub_drone:93,pedal_tone:75,pad_chords:99,arpeggio_pingpong:47,
  phrase_break:65,short_fill:15,arpeggio_ascending:35},
 chiptune:{retro_backbeat:64,octave_bass:89,arpeggio_pingpong:98,pedal_tone:72,phrase_break:55,
  ostinato:80,arpeggio_ascending:85,pad_chords:54}
};
const SLOTS:readonly TechniqueSlot[]=['drums','bass','harmony_motion','harmony_sustain','transition'];
const MODIFIERS:readonly VariationGesture[]=['vary_accents','motif_answer','register_shift','reduce_density','late_fill','alternate_arpeggio_direction'];
const validU32=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
function hash(seed:number,key:string):number{
 let n=(2166136261^seed)>>>0;
 for(let i=0;i<key.length;i++)n=Math.imul(n^key.charCodeAt(i),16777619)>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 return (n^(n>>>16))>>>0;
}
const knownId=(id:unknown):id is TechniqueId=>typeof id==='string'&&SPECS.some(x=>x.id===id);
function check(req:TechniqueRequest){
 if(!WEIGHTS[req.style])throw Error('invalid_electronic_style');
 if(!validU32(req.seed)||!Number.isSafeInteger(req.variant??0)||req.variant!<0||req.variant!>7)
  throw Error('invalid_technique_seed');
 if(req.maxActiveSlots!==undefined&&(!Number.isSafeInteger(req.maxActiveSlots)||req.maxActiveSlots<1||req.maxActiveSlots>5))
  throw Error('invalid_technique_capacity');
 for(const list of [req.disabled,req.forced]){
  if(list===undefined)continue;
  if(!Array.isArray(list)||list.length>18||new Set(list).size!==list.length||list.some(x=>!knownId(x)))
   throw Error('invalid_technique_override');
 }
 const disabled=new Set(req.disabled??[]);
 const forced=req.forced??[];
 if(forced.some(x=>disabled.has(x)))throw Error('conflicting_technique_override');
 if(new Set(forced.map(id=>SPECS.find(x=>x.id===id)!.slot)).size!==forced.length)
  throw Error('conflicting_technique_slots');
}
function ranked(choices:readonly TechniqueSpec[],style:ElectronicStyle,seed:number,slot:TechniqueSlot,variant:number):TechniqueSpec[]{
 const weights=WEIGHTS[style];
 return [...choices].sort((a,b)=>{
  const wa=weights[a.id]??0,wb=weights[b.id]??0;
  // The core idiom retains a high deterministic weight across variations;
  // alternate suggestions still remain possible, but cannot happen by
  // accident from an unrelated musical role.
  const va=wa>=90?10000+wa*3+(hash(seed,slot+'/'+a.id)%30):
   wa*20+(hash(seed+variant,slot+'/'+a.id)%900);
  const vb=wb>=90?10000+wb*3+(hash(seed,slot+'/'+b.id)%30):
   wb*20+(hash(seed+variant,slot+'/'+b.id)%900);
  return vb-va||a.id.localeCompare(b.id);
 });
}
export function listElectronicTechniques():readonly TechniqueSpec[]{return SPECS.map(x=>({...x}));}
export function recommendElectronicTechniques(request:TechniqueRequest):TechniquePlan{
 check(request);
 const variant=request.variant??0;
 const disabled=new Set(request.disabled??[]);
 const forced=new Set(request.forced??[]);
 const choices:TechniqueChoice[]=[];
 for(const slot of SLOTS){
  if(choices.length===(request.maxActiveSlots??5))break;
  const requested=([...forced].map(id=>SPECS.find(t=>t.id===id)!).find(t=>t.slot===slot));
  const options=SPECS.filter(t=>t.slot===slot&&!disabled.has(t.id));
  const weight=(t:TechniqueSpec)=>WEIGHTS[request.style][t.id]??0;
  const candidate=requested??ranked(options.filter(t=>weight(t)>0),request.style,request.seed,slot,variant)[0];
  if(!candidate)continue;
  const value=weight(candidate);
  // Sparse ambient arrangements should not be forced to use a drum pattern.
  // Non-ambient dance styles keep an alternative pulse when their default kick is explicitly vetoed.
  if(value<50&&!requested&&!(slot==='drums'&&request.style!=='ambient'))continue;
  choices.push({
   id:candidate.id,slot,priority:value>=90?'signature':value>=65?'supporting':'optional',
   weight:value,evidence:'genre_design_heuristic',
   instruction:candidate.instruction,canDisable:true
  });
 }
 // Keep structural anchors constant between variants and vary modifiers.
 const mixSeed=(request.seed+Math.imul(variant,0x9e3779b9))>>>0;
 const gestures=[...MODIFIERS].sort((a,b)=>hash(mixSeed,'v/'+a)-hash(mixSeed,'v/'+b)||a.localeCompare(b))
  .slice(0,variant===0?1:2);
 return {
  version:'electronic-technique-plan-v1',style:request.style,seed:request.seed,variant,choices,gestures,
  guidelines:[
   'Use user-authorized music scope, tonic/meter/chords and track locks as higher priority than any technique.',
   'Signature techniques are high-probability STYLE DEFAULTS, not universal aesthetic laws; honor explicit disable/force choices.',
   'Write new complementary MIDI notes for each intended role. An actual Drum role cannot be realized by the legacy three-track arranger.',
   'Apply the variant gesture at a phrase boundary, retaining the recognizable core idiom and coherent return.',
   'A source style label or a valid note pattern does not prove perceptual genre or high music quality.'
  ],
  caveats:['Planner chooses symbolic intentions only. It does not generate or commit MIDI, guarantee sound design, or override human approval.']
 };
}
export function proposeElectronicTechniqueVariations(input:Omit<TechniqueRequest,'variant'>,count=3):readonly TechniquePlan[]{
 if(!Number.isSafeInteger(count)||count<2||count>4)throw Error('invalid_technique_variation_count');
 return Array.from({length:count},(_,variant)=>recommendElectronicTechniques({...input,variant}));
}