import { DESK, gear, PRESS, START, type Gear, type Part, type Point, type Press, type Target } from './map';

export type Inspection = 'stopped' | 'front' | 'rear' | 'left' | 'right' | 'guard' | 'tagged' | 'cycle' | 'shutdown';
type Checks = Partial<Record<Inspection,boolean>>;
type Records = Record<Press,Checks>;
export type Safety = {
  crossed: boolean;
  door: boolean;
  ppe: Gear[];
  clipboard: boolean;
  tagHeld: boolean;
  inspected: Records;
  recorded: Records;
  tagged: boolean;
  completed: boolean;
  reported: boolean;
  mailDisposition: 'report' | 'ignore' | null;
  auditShown: boolean;
};
export type Settings = {
  sound: boolean;
  volume: number;
  reduced: boolean;
  quality: 'auto' | 'low' | 'high';
  control: 'trackpad' | 'mouse';
  lookKeys: 'arrows' | 'qe';
};
export type Panel = 'welcome' | 'pause' | 'settings' | 'restart' | 'clipboard' | 'mail' | 'portfolio' | 'ending';
export type PortfolioTab = 'About Me' | 'Work Experience' | 'Projects' | 'Skills' | 'CV / Résumé' | 'Contact';
export type Film =
  | {kind:'near'; time:number; side:-1|1; startX:number; curb:number; unchecked:boolean}
  | {kind:'failure'; time:number; reason:'reach'|'operation'}
  | {kind:'incident'|'audit'; time:number};
export const HORN_AT=.27, REACT_AT=.48, ROAD_CUT=1.81, REACH_CUT=.95;
export const OFFICE_SHIFT=-49;

export type Session = {
  safety: Safety;
  settings: Settings;
  panel: Panel | null;
  portfolioTab: PortfolioTab;
  portfolioBack: 'pause' | 'mail' | 'welcome' | 'ending';
  desktop: 'home'|'inbox'|'message'|'report'|'security';
  pos: Point;
  yaw: number;
  pitch: number;
  look: [number,number] | null;
  focus: {target:Target; time:number} | null;
  pressPage: Press;
  nav: { path: Point[]; target?: Target; end: Point } | null;
  film: Film | null;
  roadClear: boolean;
  crossingHeading: number|null;
  passage: {left:number; right:number} | null;
  gaze: {left:number; right:number; side:'left'|'right'|null; dwell:number};
  time: number;
  traffic: [number,number];
  stoppedA: boolean;
  faultTime: number;
  pressTime: number;
  pressMode: 'idle' | 'cycling' | 'cycled';
  notification: string;
  toastId: number;
  checkpoint: 'outside' | 'press' | 'desk';
  started: boolean;
};

const key='safety-quest.works.v1';
const defaults = (): Safety => ({
  crossed:false, door:false, ppe:[], clipboard:false, tagHeld:false,
  inspected:{a:{},b:{}}, recorded:{a:{},b:{}},
  tagged:false, completed:false, reported:false, mailDisposition:null, auditShown:false,
});
const defaultsSettings = (): Settings => ({
  sound:true, volume:.85, reduced:typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality:'auto',control:'trackpad',lookKeys:'arrows',
});
function read() {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
const freshRuntime = () => ({
  desktop:'home' as const, look:null,focus:null,pressPage:'a' as const, nav:null, film:null, roadClear:false, crossingHeading:null, passage:null,
  gaze:{left:-Infinity,right:-Infinity,side:null,dwell:0},time:0,traffic:[46,-46] as [number,number], stoppedA:true,
  faultTime:0,pressTime:0,pressMode:'idle' as const,notification:'',
});
export function startSession(): Session {
  const data=read();
  const checkpoint = (data?.checkpoint === 'press' || data?.checkpoint === 'desk') ? data.checkpoint : 'outside';
  const safety:Safety={...defaults(),...data?.safety};
  safety.ppe=safety.ppe.filter(id=>Object.hasOwn(gear,id));
  // Existing saves retain equipment and completed work. New records are filled in by the player.
  if(data?.safety && !data.safety.recorded) {
    if(safety.tagged) Object.assign(safety.inspected.a,{tagged:true,shutdown:true,guard:true});
    if(safety.completed) Object.assign(safety.inspected.b,{cycle:true,shutdown:true});
    if(safety.reported) {
      safety.reported=false;
      safety.mailDisposition??='report';
    }
  }
  return {
    ...freshRuntime(),safety, settings:{...defaultsSettings(),...data?.settings},
    panel:'welcome', portfolioTab:'About Me', portfolioBack:'welcome',
    pos: checkpoint==='desk' ? [...DESK] : checkpoint==='press' ? [...PRESS] : safety.crossed ? [0,5.7] : [...START],
    yaw:0, pitch:-.025,toastId:0,checkpoint,started:false,
  };
}
export function save(s: Session) {
  try { localStorage.setItem(key, JSON.stringify({ safety:s.safety, settings:s.settings, checkpoint:s.checkpoint })); } catch { /* Storage may be unavailable. */ }
}
export function reset(s: Session) {
  Object.assign(s,freshRuntime(),{safety:defaults(),panel:null,pos:[...START],yaw:0,pitch:-.025,checkpoint:'outside',started:true});
  save(s);
}
export const equipped = (s: Safety) => (['glasses','boots','hearing'] as const).every(item => s.ppe.includes(item));
const inspectionRows = [
  ['stopped','Verified stopped status'],
  ['front','Inspected front housing'],
  ['rear','Inspected rear panel'],
  ['left','Inspected left frame'],
  ['right','Inspected right frame'],
  ['guard','Examined tooling guard and condition'],
] as const;
export const safeToStart = (s: Safety) => equipped(s) && inspectionRows.every(([key])=>s.inspected.b[key]);
export const hasMail = (s: Safety) => s.completed && s.tagged;
export function checklist(press:Press): readonly (readonly [Inspection,string])[] {
  return [...inspectionRows,press==='a'?['tagged','Reported defect and attached tag']:['cycle','Verified full training cycle'],
    ['shutdown','Confirmed simulated shutdown']];
}
export function inaccurateRecords(s:Safety): Press[] {
  return (['a','b'] as const).filter(press=>checklist(press).some(([key])=>!s.inspected[press][key] || !s.recorded[press][key]));
}
export const nearCrossing = ([x,z]:Point) => Math.abs(x)<2.3 && (z>=15.53 && z<18.0 || z<=7.27 && z>5.0);
export const observed = (s:Session,side:'left'|'right') => s.time-s.gaze[side] < 10;
const lookPoints:readonly [Inspection,Part][]=[
  ['stopped','status'],['front','front'],['guard','guard'],['left','left'],['rear','rear'],['right','right'],
];
export function objective(s:Session):Target {
  if(s.pos[1]>7.25 && !s.safety.crossed) return s.roadClear||nearCrossing(s.pos) ? 'arrival' : 'crossing';
  if(!s.safety.door) return 'door';
  if(!equipped(s.safety)) return 'ppe';
  if(!s.safety.clipboard) return 'clipboard';
  if(!s.safety.tagged && !s.safety.tagHeld) return 'tag';
  if(hasMail(s.safety) && !s.safety.auditShown) return 'mail';
  for(const press of ['a','b'] as const) {
    for(const [key,part] of lookPoints) {
      if(!s.safety.inspected[press][key]) return `${press}-${part}`;
    }
    if(press==='a' && !s.safety.tagged) return s.safety.inspected.a.shutdown?'a-tag':'a-stop';
    if(press==='b' && !s.safety.completed) return s.pressMode==='idle'?'b-start':'b-stop';
  }
  return 'mail';
}
export function filmStage(s:Session) {
  const f=s.film;
  if(!f) return '';
  if(f.kind==='near') {
    if(f.time< HORN_AT) return 'near-quiet';
    if(f.time< ROAD_CUT) return 'near-horn';
    return 'near-black';
  }
  if(f.kind==='failure') return f.time<(f.reason==='reach'?REACH_CUT:.48)?'machine-danger':'machine-black';
  if(f.kind==='audit') {
    if(f.time<2.05) return 'audit-intro';
    if(f.time<6.2) return 'audit-ceo';
    if(f.time<10.2) return 'audit-staff';
    return 'audit-close';
  }
  if(f.time<.58) return 'incident-glitch';
  if(f.time<2.6) return 'incident-intro';
  if(f.time<6.0) return 'incident-ceo';
  if(f.time<10.2) return 'incident-staff';
  if(f.time<12.45) return 'incident-last';
  return 'incident-close';
}
