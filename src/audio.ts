type Effect='horn'|'mail'|'door'|'switch'|'cycle'|'warning'|'strain'|'impact'|'ui'|'paper'|'step';
type Sample='horn'|'mail';

const assets={horn:'truck-air-horn.mp3',mail:'youve-got-mail.wav'} as const;
const assetURL=(name:Sample)=>new URL(import.meta.env.BASE_URL+assets[name],document.baseURI).href;
const buffers=new Map<Sample,AudioBuffer>();
const media=new Map<Sample,HTMLAudioElement>();
let context: AudioContext | undefined;
let master: GainNode | undefined;
let music: GainNode | undefined;
let ambience: {out:GainNode; frequency:OscillatorNode; trucks:{gain:GainNode; pitch:OscillatorNode; pan:StereoPannerNode|null}[]} | undefined;
let noise: AudioBuffer | undefined;
let enabled=true, volume=.85, attempted=false, loading=false;
let pending: Effect|null=null;
const listeners=new Set<()=>void>();

export function audioStatus() {
  return context?.state==='running'?'running':attempted?'blocked':'idle';
}
export function onAudioStatus(listener:()=>void) {
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}
const update=()=>listeners.forEach(listener=>listener());

function preload() {
  if(loading || !context) return;
  loading=true;
  const audio=context;
  for(const name of ['horn','mail'] as const) {
    void fetch(assetURL(name)).then(response=>{
      if(!response.ok) throw new Error('Sound file unavailable');
      return response.arrayBuffer();
    }).then(bytes=>audio.decodeAudioData(bytes)).then(buffer=>{
      buffers.set(name,buffer);
      if(pending===name && enabled && audio.state==='running') {
        pending=null;
        playSample(name,0);
      }
    }).catch(()=>{ /* The media element remains available for this sample. */ });
  }
}

export function setAudioLevel(sound:boolean,level:number) {
  enabled=sound;
  volume=Number.isFinite(level)?Math.max(0,Math.min(1,level)):.85;
  if(context&&master) master.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.02);
  for(const [name,el] of media) {
    el.volume=enabled?volume*(name==='horn'?.38:.76):0;
    if(!enabled) el.pause();
  }
  if(!enabled) {
    pending=null;
    if(typeof speechSynthesis!=='undefined') speechSynthesis.cancel();
  }
}

export function unlock() {
  if(!enabled) return;
  try {
    if(!context) {
      const Audio=window.AudioContext??(window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!Audio) { attempted=true; update(); return; }
      context=new Audio();
      master=context.createGain();
      master.gain.value=volume;
      master.connect(context.destination);
      context.addEventListener('statechange',update);
      preload();
    }
    attempted=true;
    // Called directly inside the pointer or keyboard handler, before awaiting any assets.
    const request=context.state!=='running'?context.resume():Promise.resolve();
    void request.then(()=>{
      if(pending) {
        const next=pending;
        pending=null;
        play(next,enabled);
      }
      update();
    }).catch(update);
    update();
  } catch { attempted=true; update(); }
}

function fallbackSample(name:Sample) {
  if(typeof Audio==='undefined') return;
  try {
    const element=media.get(name)??new Audio(assetURL(name));
    media.set(name,element);
    element.volume=volume*(name==='horn'?.38:.76);
    element.currentTime=0;
    void element.play().then(()=>{if(pending===name) pending=null;}).catch(()=>{
      if(name==='mail' && typeof speechSynthesis!=='undefined' && enabled) {
        const message=new SpeechSynthesisUtterance("You've got mail!");
        message.lang='en-US';message.rate=.93;message.volume=volume*.8;
        speechSynthesis.speak(message);
      }
    });
  } catch { /* A suspended browser can retry on the next gesture. */ }
}

function playSample(name:Sample,side:number) {
  const buffer=buffers.get(name);
  if(!context||!master||!buffer) return false;
  const start=context.currentTime, source=context.createBufferSource(), gain=context.createGain();
  source.buffer=buffer;
  source.connect(gain);
  if(typeof context.createStereoPanner==='function') {
    const pan=context.createStereoPanner();
    pan.pan.value=Math.max(-1,Math.min(1,side))*.8;
    gain.connect(pan).connect(master);
  } else gain.connect(master);
  if(name==='horn') {
    const data=buffer.getChannelData(0);
    const initial=data.findIndex(x=>Math.abs(x)>.075);
    const offset=Math.max(0,initial/buffer.sampleRate-.022);
    const length=Math.min(1.75,buffer.duration-offset);
    gain.gain.setValueAtTime(.44,start);
    gain.gain.linearRampToValueAtTime(.44,start+Math.max(.03,length-.14));
    gain.gain.linearRampToValueAtTime(0,start+length);
    source.start(start,offset,length);
  } else {
    gain.gain.value=.83;
    source.start();
  }
  return true;
}

function tone(hz:number,end:number,start:number,length:number,level:number,type:OscillatorType,output:AudioNode) {
  if(!context) return;
  const wave=context.createOscillator(), amp=context.createGain();
  wave.type=type;
  wave.frequency.setValueAtTime(hz,start);
  wave.frequency.exponentialRampToValueAtTime(end,start+length);
  amp.gain.setValueAtTime(.001,start);
  amp.gain.exponentialRampToValueAtTime(level,start+Math.min(.026,length/4));
  amp.gain.exponentialRampToValueAtTime(.001,start+length);
  wave.connect(amp).connect(output);
  wave.start(start);
  wave.stop(start+length+.01);
}
function grit(start:number,length:number,level:number,hz:number,output:AudioNode,type:BiquadFilterType='lowpass') {
  if(!context) return;
  if(!noise) {
    noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
    const pcm=noise.getChannelData(0);
    for(let i=0;i<pcm.length;i++) pcm[i]=Math.random()*2-1;
  }
  const wave=context.createBufferSource(), filter=context.createBiquadFilter(), amp=context.createGain();
  wave.buffer=noise;
  filter.type=type;filter.frequency.value=hz;
  amp.gain.setValueAtTime(level,start);
  amp.gain.exponentialRampToValueAtTime(.001,start+length);
  wave.connect(filter).connect(amp).connect(output);
  wave.start(start,Math.random()*.25,length);
}
export function play(name:Effect,allow:boolean,side=0) {
  if(!allow||!enabled||volume===0) return;
  if((name==='mail'||name==='horn') && context?.state!=='running') {
    pending=name==='mail'?name:null;
    fallbackSample(name);
    return;
  }
  if(!context||!master||context.state!=='running') return;
  const t=context.currentTime, out=master;
  const note=(hz:number,end:number,duration:number,level:number,type:OscillatorType='triangle',delay=0)=>tone(hz,end,t+delay,duration,level,type,out);
  if(name==='horn'||name==='mail') {
    if(!playSample(name,side)) fallbackSample(name);
    return;
  }
  switch(name) {
    case 'door': grit(t,.37,.14,710,out);note(140,68,.36,.14); break;
    case 'switch': grit(t,.07,.1,1200,out);note(225,145,.1,.12); break;
    case 'cycle': note(86,132,.78,.15,'sawtooth');note(134,50,.61,.16,'triangle',.85);grit(t+1.4,.45,.16,620,out);break;
    case 'warning': note(435,398,.18,.14);note(435,398,.26,.13,'triangle',.22);break;
    case 'strain': note(84,50,.68,.17,'sawtooth');grit(t+.18,.44,.13,240,out);break;
    case 'impact': note(111,31,.53,.29,'sawtooth');grit(t,.42,.31,760,out);break;
    case 'step': grit(t,.09,.21,920,out);note(95,48,.11,.105);break;
    case 'paper': grit(t,.17,.14,1450,out,'bandpass');break;
    case 'ui': note(522,370,.065,.06);break;
  }
}

export function updateAmbience(active:boolean,outside:boolean,trucks:readonly {distance:number;pan:number}[]) {
  if(!context||!master||context.state!=='running') return;
  const now=context.currentTime;
  if(!ambience) {
    const out=context.createGain(), frequency=context.createOscillator();
    out.gain.value=0;
    frequency.type='triangle';frequency.frequency.value=52;
    frequency.connect(out).connect(master);frequency.start();
    const motors=Array.from({length:2},()=>{
      const pitch=context!.createOscillator(),gain=context!.createGain(),filter=context!.createBiquadFilter();
      const pan=typeof context!.createStereoPanner==='function'?context!.createStereoPanner():null;
      pitch.type='sawtooth';pitch.frequency.value=46;
      filter.frequency.value=250;gain.gain.value=0;
      pitch.connect(filter).connect(gain);
      if(pan) gain.connect(pan).connect(master!);
      else gain.connect(master!);
      pitch.start();
      return {gain,pitch,pan};
    });
    ambience={out,frequency,trucks:motors};
  }
  const heard=active&&enabled;
  ambience.out.gain.setTargetAtTime(heard?(outside?.038:.025):0,now,.25);
  ambience.frequency.frequency.setTargetAtTime(outside?51:66,now,.25);
  ambience.trucks.forEach((motor,index)=>{
    const source=trucks[index], distance=source?.distance??80;
    const level=heard&&outside ? .19/(1+(distance/9)**1.7) : 0;
    motor.gain.gain.setTargetAtTime(level,now,.095);
    motor.pitch.frequency.setTargetAtTime(39+Math.max(0,36-distance)*.52,now,.16);
    motor.pan?.pan.setTargetAtTime(source?.pan??0,now,.12);
  });
}

export function warmMusic(allow:boolean) {
  music?.disconnect();
  music=undefined;
  if(!context||!master||!allow||context.state!=='running') return;
  music=context.createGain();
  music.gain.value=.8;
  music.connect(master);
  const out=music, start=context.currentTime+.15;
  const phrases=[[261.63,329.63,392,440],[220,261.63,329.63,392],[174.61,220,261.63,329.63],[196,246.94,293.66,392]];
  for(let repeat=0;repeat<2;repeat++) phrases.forEach((chord,index)=>{
    const t=start+(index+repeat*4)*1.72;
    chord.forEach((f,i)=>tone(f/2,f/2,t+.04*i,1.65,.04,'sine',out));
    [0,2,1,3,2].forEach((note,i)=>tone(chord[note]*2,chord[note]*2,t+.32*i,.61,.055,'triangle',out));
  });
}
