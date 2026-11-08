let context: AudioContext | undefined;
let music: GainNode | undefined;

export function unlock() {
  try {
    context ??= new AudioContext();
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
export function play(name: 'horn'|'mail'|'door'|'switch'|'cycle'|'warning', enabled: boolean) {
  if (!enabled || !context || context.state !== 'running') return;
  const t=context.currentTime, out=context.destination;
  if (name==='horn') {
    tone(147,t,.75,.095,'sawtooth',out);
    tone(196,t,.75,.065,'triangle',out);
    tone(65,t,.66,.07,'sine',out);
  } else if (name==='mail') {
    [523,659,784].forEach((f,i)=>tone(f,t+i*.105,.29,.045,'sine',out));
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
  music.connect(context.destination);
  const out=music, start=context.currentTime;
  const phrases=[[261.63,329.63,392,440],[220,261.63,329.63,392],[174.61,220,261.63,329.63],[196,246.94,293.66,392]];
  for (let repeat=0;repeat<2;repeat++) phrases.forEach((chord,index)=>{
    const t=start+(index+repeat*4)*1.72;
    chord.forEach((f,i)=>tone(f/2,t+.04*i,1.65,.018,'sine',out));
    [0,2,1,3,2].forEach((note,i)=>tone(chord[note]*2,t+.32*i,.61,.03,'triangle',out));
  });
}

