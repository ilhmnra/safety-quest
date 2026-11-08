let context: AudioContext | undefined;
let music: GainNode | undefined;
let master: GainNode | undefined;
let outputLevel=.85;
const samples=new Map<'horn'|'mail',AudioBuffer>();
const asset={horn:'truck-air-horn.mp3',mail:'youve-got-mail.wav'} as const;
let loading=false;
function preload() {
  if(loading || !context) return;
  loading=true;
  const audio=context;
  for(const key of ['horn','mail'] as const) {
    void fetch(new URL(asset[key],document.baseURI)).then(r=>{
      if(!r.ok) throw new Error('Audio asset unavailable');
      return r.arrayBuffer();
    }).then(buffer=>audio.decodeAudioData(buffer)).then(buffer=>{samples.set(key,buffer);}).catch(()=>{});
  }
}
function playSample(name:'horn'|'mail',side:number) {
  const buffer=samples.get(name);
  if(!context || !buffer) return false;
  const start=context.currentTime, source=context.createBufferSource(), gain=context.createGain();
  source.buffer=buffer;
  const pan=context.createStereoPanner();
  pan.pan.value=side*.65;
  source.connect(gain).connect(pan).connect(master??context.destination);
  if(name==='horn') {
    const data=buffer.getChannelData(0);
    const initial=data.findIndex(x=>Math.abs(x)>.075);
    const offset=initial<0?0:Math.max(0,initial/buffer.sampleRate-.018);
    const length=Math.min(1.26,buffer.duration-offset);
    gain.gain.setValueAtTime(.34,start);
    gain.gain.linearRampToValueAtTime(.34,start+Math.max(.03,length-.14));
    gain.gain.linearRampToValueAtTime(0,start+length);
    source.start(start,offset,length);
  } else {
    gain.gain.value=.56;
    source.start();
  }
  return true;
}

export function setAudioLevel(sound:boolean, volume:number) {
  outputLevel=sound?Math.max(0,Math.min(1,volume)):0;
  if(context&&master) master.gain.setTargetAtTime(outputLevel,context.currentTime,.018);
  if(!sound && typeof speechSynthesis!=='undefined') speechSynthesis.cancel();
}
export function unlock() {
  try {
    context ??= new AudioContext();
    if(!master) {
      master=context.createGain();
      master.gain.value=outputLevel;
      master.connect(context.destination);
    }
    preload();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}

function tone(hz: number, start: number, length: number, volume: number, type: OscillatorType, output: AudioNode) {
  if (!context) return;
  const wave=context.createOscillator(), amp=context.createGain();
  wave.type=type;
  wave.frequency.value=hz;
  amp.gain.setValueAtTime(.001,start);
  amp.gain.exponentialRampToValueAtTime(volume,start+.035);
  amp.gain.exponentialRampToValueAtTime(.001,start+length);
  wave.connect(amp).connect(output);
  wave.start(start);
  wave.stop(start+length+.01);
}
export function play(name: 'horn'|'mail'|'door'|'switch'|'cycle'|'warning'|'strain', enabled: boolean, side=0) {
  if (!enabled || !context || context.state !== 'running') return;
  const t=context.currentTime, out=master??context.destination;
  if ((name==='horn'||name==='mail') && playSample(name,side)) return;
  if (name==='horn') {
    const pan=context.createStereoPanner();
    pan.pan.value=side*.65;
    pan.connect(out);
    tone(139,t,.96,.11,'sawtooth',pan);
    tone(186,t+.018,1.02,.075,'sawtooth',pan);
    tone(92,t+.016,.94,.045,'triangle',pan);
  } else if (name==='mail') {
    if(typeof speechSynthesis!=='undefined') {
      const message=new SpeechSynthesisUtterance("You've got mail!");
      message.lang='en-US';message.rate=.93;message.volume=outputLevel*.65;
      speechSynthesis.speak(message);
    }
  } else if(name==='strain') {
    tone(54,t,.57,.09,'sawtooth',out);
    tone(91,t+.07,.38,.04,'triangle',out);
    tone(107,t+.13,.30,.035,'square',out);
  } else if (name==='cycle') {
    [58,74,61].forEach((f,i)=>tone(f,t+i*.6,.59,.05,'triangle',out));
  } else if (name==='warning') {
    [233,193].forEach((f,i)=>tone(f,t+i*.17,.35,.06,'square',out));
  } else {
    tone(name==='door'?83:420,t,name==='door'?.37:.095,.045,'triangle',out);
  }
}
export function warmMusic(enabled: boolean) {
  if (!context) return;
  music?.disconnect();
  music=undefined;
  if (!enabled || context.state!=='running') return;
  music=context.createGain();
  music.gain.value=.6;
  music.connect(master??context.destination);
  const out=music, start=context.currentTime;
  const phrases=[[261.63,329.63,392,440],[220,261.63,329.63,392],[174.61,220,261.63,329.63],[196,246.94,293.66,392]];
  for (let repeat=0;repeat<2;repeat++) phrases.forEach((chord,index)=>{
    const t=start+(index+repeat*4)*1.72;
    chord.forEach((f,i)=>tone(f/2,t+.04*i,1.65,.018,'sine',out));
    [0,2,1,3,2].forEach((note,i)=>tone(chord[note]*2,t+.32*i,.61,.03,'triangle',out));
  });
}
