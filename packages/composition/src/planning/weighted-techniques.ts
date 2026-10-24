/**
 * Style-aware technique priorities for a GENERAL-PURPOSE LLM composer.
 * Never synthesizes MIDI, commits notes, or calls a music generation model.
 *
 * A genre label is an intentional user preference, not an expert genre classifier.
 * A high-priority technique is automatically assigned when a compatible MIDI role
 * exists. Important missing roles remain *explicitly deferred* (not hallucinated).
 */
export type ElectronicGenre='house'|'techno'|'trance'|'synthwave'|'drum_and_bass'|'chiptune'|'ambient';
export type TechniqueId=
 'four_on_floor'|'breakbeat_drums'|'hat_pulse'|'retro_drum_pattern'|
 'offbeat_bass'|'root_octave_bass'|'sub_bass'|'pedal_bass'|
 'arpeggio'|'alberti'|'ostinato'|'syncopated_comp'|'block_comp'|'pad'|'chiptune_pulse'|
 'motif_development'|'transition_fill';
export type TechniqueRole='harmony'|'bass'|'accompaniment'|'drums'|'structure';
export type TechniqueStrength='signature'|'preferred'|'support';
export interface TechniqueIntent {
 readonly genre?:ElectronicGenre;
 /** False disables automatic technique selection, including instruction detection. */
 readonly auto?:boolean;
 /** User-authorized exclusions always override style priorities. */
 readonly disabled?:readonly TechniqueId[];
 /** A deterministic card/variation choice, not a remote-LLM reproducibility guarantee. */
 readonly seed?:number;
}
export interface TechniqueContext {
 readonly instruction:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly ppq:number;
 readonly meter:{readonly numerator:number;readonly denominator:number};
 readonly intent?:TechniqueIntent;
}
interface Rule{
 readonly id:TechniqueId;
 readonly role:TechniqueRole;
 readonly weight:number;
 readonly direction:string;
 readonly variations:readonly string[];
 readonly rationale:string;
}
export interface TechniqueVariation{
 readonly startTick:number;
 readonly endTick:number;
 readonly kind:'phrase_end_variation';
 readonly instruction:string;
}
export interface AssignedTechnique{
 readonly id:TechniqueId;
 readonly role:'harmony'|'bass'|'accompaniment';
 readonly weight:number;
 readonly strength:TechniqueStrength;
 readonly instruction:string;
 readonly reason:string;
 readonly variation:TechniqueVariation|null;
}
export interface DeferredTechnique{
 readonly id:TechniqueId;
 readonly role:'drums'|'structure';
 readonly weight:number;
 readonly reason:string;
}
export interface TechniquePlan {
 readonly version:'weighted-techniques-v1';
 readonly genre:ElectronicGenre;
 readonly detection:'explicit'|'instruction_hint';
 readonly sourceInstruction:string;
 readonly seed:number;
 readonly scope:{readonly startTick:number;readonly endTick:number};
 readonly meter:string;
 readonly assigned:readonly AssignedTechnique[];
 readonly deferred:readonly DeferredTechnique[];
 readonly suppressed:readonly {readonly id:TechniqueId;readonly reason:string}[];
 readonly variationPolicy:'retain_identifiable_motif_and_change_one_parameter';
 readonly safety:readonly string[];
}
const rules:Record<ElectronicGenre,readonly Rule[]>={
 house:[
  {id:'four_on_floor',role:'drums',weight:100,direction:'Kick four-to-the-floor, clap/snare backbeats, complementary hats.',variations:['A short end-of-phrase hat opening or fill','Remove a percussion hit to create a break'],rationale:'Common structural pulse for straight house arrangements.'},
  {id:'offbeat_bass',role:'bass',weight:94,direction:'Write a tightly gated bassline emphasizing clear offbeats and chord roots; give kick transients space.',variations:['Move one bass pickup before the chord change','Replace one repeated bass note with a permitted octave'],rationale:'Bass/kick interplay creates the characteristic rhythmic foundation.'},
  {id:'syncopated_comp',role:'accompaniment',weight:88,direction:'Use clipped chord stabs between pulse accents; avoid copying lead timing.',variations:['Omit a stab before the cadence','Shift one authorized chord attack to a different offbeat'],rationale:'Accented harmonic offbeats establish interplay without constant chords.'},
  {id:'pad',role:'harmony',weight:61,direction:'Use light sustained, voice-led chord support under the groove, leaving the lead present.',variations:['Open the voicing in the return phrase','Release the pad just before a transition'],rationale:'Optional harmonic atmosphere; not every house piece needs a pad.'},
  {id:'motif_development',role:'structure',weight:86,direction:'Return a recognizable groove motif with one controlled phrase-level change.',variations:['Reduce density before motif return'],rationale:'Repetition with variation supports longer dance form.'}
 ],
 techno:[
  {id:'four_on_floor',role:'drums',weight:97,direction:'Keep an intentional kick pulse; consider deliberate gaps where the section needs contrast.',variations:['Percussion dropout before return'],rationale:'Common foundation for four-to-the-floor techno, not universal across substyles.'},
  {id:'ostinato',role:'accompaniment',weight:94,direction:'Develop a short repeated rhythmic/pitch motif without continuous random new notes.',variations:['Remove one onset in the last cycle','Change register for a single reprise'],rationale:'Recognizable cycles create motoric development.'},
  {id:'pedal_bass',role:'bass',weight:80,direction:'Use a focused pedal or minimal repeating bass pulse to support the motif.',variations:['Leave one intentional bass rest'],rationale:'A stable low-frequency anchor helps timbral development.'},
  {id:'pad',role:'harmony',weight:57,direction:'Use sparse sustained harmonic or noisy contrast, not continuous chords.',variations:['Thin the final phrase'],rationale:'Optional atmospheric texture.'},
  {id:'transition_fill',role:'structure',weight:78,direction:'Mark a short break or a section transition; reserve filter automation for the production plan.',variations:['One beat of silence before return'],rationale:'Section transition can be sparse and does not require extra notes.'}
 ],
 trance:[
  {id:'four_on_floor',role:'drums',weight:98,direction:'Maintain a stable kick and supporting subdivision where requested.',variations:['Hat lift at the transition'],rationale:'Common pulse across mainstream four-floor trance.'},
  {id:'arpeggio',role:'accompaniment',weight:97,direction:'Create a coherent chord-tone arpeggio with an explicit up/down order, rate, gate and chord-change restart.',variations:['Change only the arpeggio direction in the return','Shorten one arpeggio cycle before a cadence'],rationale:'Fast harmonically anchored motion is an important trance device.'},
  {id:'offbeat_bass',role:'bass',weight:89,direction:'Provide gated bass impulses complementary to the kick, with predictable harmonic targets.',variations:['Add a short root pickup before a new chord'],rationale:'Dance pulse and sub movement depend on rhythm-aware bass.'},
  {id:'pad',role:'harmony',weight:76,direction:'Hold voice-led chord pads with restraint, reserving intensity growth for sound automation.',variations:['Delay one chord entry'],rationale:'A pad can support the larger theme without doubling the arpeggio.'},
  {id:'transition_fill',role:'structure',weight:89,direction:'Plan contrasting break and return; do not call a MIDI note fill an audio riser.',variations:['Rhythmic break before reprise'],rationale:'Larger scale breaks and transitions are commonly important.'}
 ],
 synthwave:[
  {id:'arpeggio',role:'accompaniment',weight:97,direction:'Build a chord-tone 8th/16th arpeggio with recurring order and occasional purposeful rests.',variations:['Reverse the contour for the last bar','Skip a repeated arpeggio attack to let the lead speak'],rationale:'Repeated synth arpeggios are a strong idiom for this requested flavor.'},
  {id:'root_octave_bass',role:'bass',weight:92,direction:'Use grounded root-octave movement with precise note gates and no out-of-range sub pitch.',variations:['Substitute an allowed fifth for one octave hit','Keep the final root sustained instead of bouncing'],rationale:'A coherent mono bassline anchors the harmony and pulse.'},
  {id:'pad',role:'harmony',weight:88,direction:'Sustain wide but voice-led chords at a lower attack density than the arpeggio.',variations:['Thin the pad on the phrase break','Open the voicing on reprise'],rationale:'Long synth pad envelopes counterbalance the short arpeggio.'},
  {id:'retro_drum_pattern',role:'drums',weight:80,direction:'Use a clear programmed kick/snare/hat groove; render with a suitable synthetic drum kit.',variations:['Short percussive fill'],rationale:'A retro drum texture can help define the intended production era.'},
  {id:'motif_development',role:'structure',weight:86,direction:'Keep a recognizable theme while introducing a phrase-level variation and reprise.',variations:['Lead pause before the thematic return'],rationale:'A memorable theme prevents a purely textural loop.'}
 ],
 drum_and_bass:[
  {id:'breakbeat_drums',role:'drums',weight:100,direction:'Write an original fast syncopated breakbeat with kick/snare/hat accents; do not copy licensed audio breaks.',variations:['One-bar break rearrangement'],rationale:'The breakbeat is defining for many DnB branches.'},
  {id:'sub_bass',role:'bass',weight:98,direction:'Place a controlled sub/bass rhythm under the kick/snare pattern, avoiding incessant note attacks.',variations:['Leave a bass rest on a snare accent','Change the last bass articulation'],rationale:'Rhythmically intentional sub is essential to a useful DnB foundation.'},
  {id:'ostinato',role:'accompaniment',weight:80,direction:'Use a sparse identifiable repeating figure that leaves room for complex drum detail.',variations:['Strip the last loop to half the onsets'],rationale:'Focused repetition can keep fast rhythm coherent.'},
  {id:'pad',role:'harmony',weight:56,direction:'Use low-density harmony to avoid overfilling the break.',variations:['Brief harmony rest'],rationale:'Optional tonal backdrop.'},
  {id:'transition_fill',role:'structure',weight:76,direction:'Include a brief contrast, not constant maximal rhythmic density.',variations:['Short reset before next section'],rationale:'Controlled breaks help perception of intricate grooves.'}
 ],
 chiptune:[
  {id:'chiptune_pulse',role:'accompaniment',weight:95,direction:'Use short monophonic-like pulse figures and recognizable register-limited motives.',variations:['Shift one motif to a higher octave','Pause one pulse before reprise'],rationale:'Constrained parts are characteristic of many classic game chiptune arrangements.'},
  {id:'arpeggio',role:'harmony',weight:92,direction:'Imply harmony with quick, ordered chord-tone arpeggios rather than huge stacked chords.',variations:['Change upward motion to ping-pong','Shorten one repeated cycle'],rationale:'Arpeggios convey chords economically under limited channels.'},
  {id:'root_octave_bass',role:'bass',weight:81,direction:'Use a short-cycle root/octave bass pulse in a limited register.',variations:['Hold the final tonic pulse'],rationale:'Low channel economy matters under constrained voices.'},
  {id:'motif_development',role:'structure',weight:89,direction:'Repeat a recognizable game motif with short developmental variation.',variations:['Change a single motif rhythm in reprise'],rationale:'Motif recall is vital for loop identity.'}
 ],
 ambient:[
  {id:'pad',role:'harmony',weight:97,direction:'Use long controlled harmonic sustains, carefully planned entries and releases.',variations:['Delay one chord swell','Thin the upper voice for the final phrase'],rationale:'Textural continuity often anchors ambient arrangements.'},
  {id:'pedal_bass',role:'bass',weight:74,direction:'Sustain an in-scale drone/pedal or use deliberate low rests.',variations:['Replace one attack with an extended rest'],rationale:'Low harmonic stability is an option rather than an absolute law.'},
  {id:'arpeggio',role:'accompaniment',weight:58,direction:'Introduce very sparse arpeggio tones with wide gaps, if the texture supports them.',variations:['Remove one repeated figure'],rationale:'Subtle motion can relieve stasis without overpowering atmosphere.'},
  {id:'motif_development',role:'structure',weight:79,direction:'Revisit a tiny texture/motif change rather than forcing a big dance drop.',variations:['Drop one layer during reprise'],rationale:'Slow movement and return can sustain interest.'}
 ]
};
const ALL_IDS=new Set<string>(Object.values(rules).flatMap(x=>x.map(r=>r.id)));
const GENRES=Object.keys(rules) as ElectronicGenre[];
const pattern:Record<ElectronicGenre,RegExp>={
 house:/\bhouse\b|浩室|豪斯/i,
 techno:/\btechno\b|铁克诺/i,
 trance:/\btrance\b|出神舞曲/i,
 synthwave:/\bsynth[\s-]?wave\b|合成器浪潮|复古合成/i,
 drum_and_bass:/\b(?:drum\s*(?:and|&|n)\s*bass|dnb|d&b)\b|鼓打贝斯|鼓与贝斯/i,
 chiptune:/\b(?:chiptune|8[\s-]?bit)\b|芯片音乐|八位机音乐/i,
 ambient:/\bambient\b|氛围电子|环境电子/i
};
function hash(seed:number,key:string):number{
 let state=(seed^2166136261)>>>0;
 for(let i=0;i<key.length;i++)state=Math.imul(state^key.charCodeAt(i),16777619)>>>0;
 state^=state>>>16;
 return Math.imul(state,0x7feb352d)>>>0;
}
function validUint32(n:unknown):n is number{
 return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
}
export function inferElectronicGenre(instruction:string):ElectronicGenre|null{
 if(typeof instruction!=='string'||instruction.length>2000)throw Error('invalid_technique_instruction');
 const matches=GENRES.filter(x=>pattern[x].test(instruction));
 // Do not silently assign a style when instructions contain multiple genres.
 return matches.length===1?matches[0]!:null;
}
function strength(weight:number):TechniqueStrength{
 return weight>=85?'signature':weight>=75?'preferred':'support';
}
function validate(ctx:TechniqueContext):{genre:ElectronicGenre|null;source:'explicit'|'instruction_hint'|null;seed:number;disabled:Set<string>}{
 if(!ctx||typeof ctx!=='object')throw Error('invalid_technique_context');
 if(typeof ctx.instruction!=='string'||ctx.instruction.length>2000)throw Error('invalid_technique_instruction');
 if(!Number.isSafeInteger(ctx.ppq)||ctx.ppq<24||ctx.ppq>9600||
  !Number.isSafeInteger(ctx.startTick)||!Number.isSafeInteger(ctx.endTick)||
  ctx.startTick<0||ctx.endTick<=ctx.startTick||
  ctx.endTick-ctx.startTick>ctx.ppq*4*16)throw Error('invalid_technique_scope');
 const meter=ctx.meter;
 if(!meter||!Number.isSafeInteger(meter.numerator)||meter.numerator<1||meter.numerator>32||
  ![1,2,4,8,16,32].includes(meter.denominator)||
  !Number.isSafeInteger(ctx.ppq*4*meter.numerator/meter.denominator))throw Error('invalid_technique_meter');
 const intent=ctx.intent;
 if(intent!==undefined&&(!intent||typeof intent!=='object'||Array.isArray(intent)||
  Object.keys(intent).some(k=>!['genre','auto','disabled','seed'].includes(k))||
  (intent.auto!==undefined&&typeof intent.auto!=='boolean')||
  (intent.genre!==undefined&&!GENRES.includes(intent.genre))))throw Error('invalid_technique_intent');
 if(intent?.seed!==undefined&&!validUint32(intent.seed))throw Error('invalid_technique_seed');
 const disabled=intent?.disabled??[];
 if(!Array.isArray(disabled)||disabled.length>ALL_IDS.size||
  disabled.some(x=>typeof x!=='string'||!ALL_IDS.has(x))||
  new Set(disabled).size!==disabled.length)throw Error('invalid_technique_exclusions');
 return {genre:intent?.auto===false?null:intent?.genre??inferElectronicGenre(ctx.instruction),
  source:intent?.genre!==undefined?'explicit':'instruction_hint',
  seed:intent?.seed??0,disabled:new Set(disabled)};
}
/** No genre is implied for ambiguous free text. The caller can supply one explicitly. */
export function planElectronicTechniques(ctx:TechniqueContext):TechniquePlan|null{
 const {genre,source,seed,disabled}=validate(ctx);
 if(!genre||!source)return null;
 const authored=rules[genre];
 const arranged=[...authored].sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id));
 const selected=new Set<TechniqueRole>();
 const assigned:AssignedTechnique[]=[],deferred:DeferredTechnique[]=[],suppressed:{id:TechniqueId;reason:string}[]=[];
 const barTicks=ctx.ppq*4*ctx.meter.numerator/ctx.meter.denominator;
 const windowLength=ctx.endTick-ctx.startTick;
 const variationStart=Math.max(ctx.startTick,ctx.endTick-Math.min(barTicks,windowLength/4));
 for(const rule of arranged){
  if(disabled.has(rule.id)){suppressed.push({id:rule.id,reason:'explicit_user_exclusion'});continue;}
  if(rule.role==='drums'||rule.role==='structure'){
   if(rule.weight>=75)deferred.push({id:rule.id,role:rule.role,weight:rule.weight,
    reason:rule.role==='drums'?'current_arrangement_schema_has_no_drum_role':'whole_song_section_planner_not_yet_connected'});
   continue;
  }
  if(selected.has(rule.role)){
   suppressed.push({id:rule.id,reason:'one_primary_technique_per_track_role'});
   continue;
  }
  // Strong (75+) techniques are assigned by default. Lower-weight techniques
  // may fill a free role but may be omitted by the LLM where user context conflicts.
  if(rule.weight<55)continue;
  selected.add(rule.role);
  const v=rule.variations[hash(seed,'variation/'+rule.id)%rule.variations.length]!;
  assigned.push({
   id:rule.id,role:rule.role,weight:rule.weight,strength:strength(rule.weight),
   instruction:rule.direction,reason:rule.rationale,
   variation:windowLength>=ctx.ppq*2?{
    startTick:Math.round(variationStart),
    endTick:ctx.endTick,
    kind:'phrase_end_variation',
    instruction:v+'; retain the motif identity and obey MIDI/user constraints.'
   }:null
  });
 }
 return {
  version:'weighted-techniques-v1',genre,detection:source,
  sourceInstruction:ctx.instruction.slice(0,500),seed,
  scope:{startTick:ctx.startTick,endTick:ctx.endTick},
  meter:ctx.meter.numerator+'/'+ctx.meter.denominator,
  assigned,deferred,suppressed,
  variationPolicy:'retain_identifiable_motif_and_change_one_parameter',
  safety:[
   'High weight means strong style preference, not a universally mandatory musical law.',
   'User exclusions, project locks, scope and any explicit harmony plan override style preferences.',
   'Write original editable MIDI on only the authorized arrangement roles; never fake missing drum or FX lanes.',
   'Apply ONE named phrase-level variation per selected role without changing every part simultaneously.',
   'Do not claim style correctness from MIDI rules; musical quality needs listening judgment.'
  ]
 };
}
