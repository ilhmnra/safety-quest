import { DESK, gear, PRESS, ROAD, START, type Gear, type Part, type Point, type Press, type Target } from './map';
import type { Film } from './cinematics';
import { fromSouth, startTraffic } from './traffic';

export type Inspection = 'stopped' | 'front' | 'rear' | 'left' | 'right' | 'guard' | 'tagged' | 'cycle' | 'shutdown' | 'noDefects';
export type PreparationCheck = 'eyes'|'ears'|'feet'|'suitable'|'tag';
export type InspectionPage = Press|'ppe';
type Checks = Partial<Record<Inspection,boolean>>;
type Records = Record<Press,Checks>;
export type Safety = {
  crossed: boolean;
  door: boolean;
  ppe: Gear[];
  collectedPpe: Gear[];
  inspectedPpe: Gear[];
  recordedPpe: Partial<Record<PreparationCheck,boolean>>;
  legacyPreparation: boolean;
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
  fov: number;
  reduced: boolean;
  quality: 'auto' | 'low' | 'high';
  control: 'trackpad' | 'mouse';
  lookKeys: 'arrows' | 'qe';
};
export type Panel = 'welcome' | 'pause' | 'settings' | 'restart' | 'cabinet' | 'clipboard' | 'mail' | 'portfolio' | 'ending';
export type PortfolioTab = 'About Me' | 'Work Experience' | 'Projects' | 'Skills' | 'CV / Résumé' | 'Contact';

export type Session = {
  safety: Safety;
  settings: Settings;
  panel: Panel | null;
  portfolioTab: PortfolioTab;
  portfolioBack: 'pause' | 'mail' | 'welcome' | 'ending';
  desktop: 'home'|'inbox'|'message'|'report'|'security'|'portfolio'|'cv'|'contact';
  clipboardBack: Panel | null;
  pos: Point;
  yaw: number;
  pitch: number;
  look: [number,number] | null;
  focus: {target:Target; time:number} | null;
  pressPage: InspectionPage;
  controlPress: { target:Target; until:number } | null;
  nav: { path: Point[]; target?: Target; end: Point } | null;
  film: Film | null;
  seenFilms:Set<Film["kind"]>;
  roadClear: boolean;
  clearUntil:number;
  crossingHeading: number|null;
  passage: {launched:[boolean,boolean]} | null;
  gaze: {left:number; right:number; side:'left'|'right'|null; dwell:number; curb:'south'|'north'|null};
  gazeSelection:'left'|'center'|'right'|null;
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
  crossed:false, door:false, ppe:[], collectedPpe:[], inspectedPpe:[], recordedPpe:{}, legacyPreparation:false, clipboard:false, tagHeld:false,
  inspected:{a:{},b:{}}, recorded:{a:{},b:{}},
  tagged:false, completed:false, reported:false, mailDisposition:null, auditShown:false,
});
const defaultsSettings = (): Settings => ({
  sound:true, volume:.85, fov:79, reduced:typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality:'auto',control:'trackpad',lookKeys:'arrows',
});
function read() {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
const freshRuntime = () => ({
  desktop:'home' as const, look:null,focus:null,pressPage:'ppe' as const, clipboardBack:null, controlPress:null, nav:null, film:null, seenFilms:new Set<Film["kind"]>(), roadClear:false, clearUntil:0, crossingHeading:null, passage:null,
  gaze:{left:-Infinity,right:-Infinity,side:null,dwell:0,curb:null},gazeSelection:null,time:0,traffic:startTraffic(), stoppedA:true,
  faultTime:0,pressTime:0,pressMode:'idle' as const,notification:'',
});
export function startSession(): Session {
  const data=read();
  const checkpoint = (data?.checkpoint === 'press' || data?.checkpoint === 'desk') ? data.checkpoint : 'outside';
  const safety:Safety={...defaults(),...data?.safety};
  const uniqueGear=(items:unknown):Gear[]=>Array.isArray(items)
    ? [...new Set(items.filter((id):id is Gear=>typeof id==='string' && Object.hasOwn(gear,id)))] : [];
  const worn=uniqueGear(safety.ppe);
  safety.ppe=worn.filter((id,i)=>!worn.slice(i+1).some(other=>gear[other].slot===gear[id].slot));
  safety.collectedPpe=uniqueGear([...uniqueGear(safety.collectedPpe),...worn]);
  safety.inspectedPpe=uniqueGear(safety.inspectedPpe);
  if(safety.tagged) safety.tagHeld=false;
  // Older shifts had no PPE page or separate out-of-service/no-defect entries.
  if(data?.safety && !Object.hasOwn(data.safety,'recordedPpe')) {
    safety.legacyPreparation=safety.completed && safety.tagged;
    if(safety.tagged) {
      safety.inspected.a.cycle=true;
      if(safety.recorded.a.tagged) safety.recorded.a.cycle=true;
    }
    if(safety.inspected.b.guard) safety.inspected.b.noDefects=true;
    if(safety.recorded.b.guard) safety.recorded.b.noDefects=true;
  }
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
export const preparationRows:readonly (readonly [PreparationCheck,string])[]=[
  ['eyes','Inspect safety glasses.'],
  ['ears','Inspect hearing protection.'],
  ['feet','Verify safety footwear.'],
  ['suitable','Confirm all required PPE is suitable.'],
  ['tag','Collect an OUT OF SERVICE tag.'],
];

export function preparationPerformed(s:Safety,key:PreparationCheck) {
  if(key==='suitable') return equipped(s);
  if(key==='tag') return s.tagHeld||s.tagged;
  return s.inspectedPpe.some(id=>gear[id].slot===key);
}
export function checklist(press:Press): readonly (readonly [Inspection,string])[] {
  return [...inspectionRows,press==='a'?['tagged','Reported defect and attached tag']:['noDefects','Confirmed no defect to report'],
    ['cycle',press==='a'?'Recorded out-of-service condition':'Completed approved simulation'],
    ['shutdown','Confirmed final safe state']];
}
export type RecordIssue = { page:InspectionPage; label:string; reason:'Not performed'|'Not recorded' };
export function recordIssues(s:Safety):RecordIssue[] {
  const issues:RecordIssue[]=[];
  if(!s.legacyPreparation) for(const [key,label] of preparationRows) {
    const actual=preparationPerformed(s,key);
    if(!actual || !s.recordedPpe[key]) issues.push({page:'ppe',label,reason:actual?'Not recorded':'Not performed'});
  }
  for(const page of ['a','b'] as const) for(const [key,label] of checklist(page)) {
    if(!s.inspected[page][key] || !s.recorded[page][key]) issues.push({page,label,reason:s.inspected[page][key]?'Not recorded':'Not performed'});
  }
  return issues;
}
export const recordName=(page:InspectionPage)=>page==='ppe'?'PPE inspection':'Press '+page.toUpperCase();
export const nearCrossing = ([x,z]:Point) => Math.abs(x)<2.8 && (z>=ROAD.near && z<18.65 || z<=ROAD.far && z>4.7);
export const observed = (s:Session,side:'left'|'right') => s.gaze.curb===(fromSouth(s.pos)?'south':'north') && (s.passage!==null || s.roadClear || s.time-s.gaze[side]<9) && Number.isFinite(s.gaze[side]);
export const usingCrossing = (s:Session) => nearCrossing(s.pos) && (s.roadClear || !!s.passage || !!s.gazeSelection ||
  observed(s,'left') || observed(s,'right') || Math.cos(s.yaw)*(fromSouth(s.pos)?1:-1)>.23);
const lookPoints:readonly [Inspection,Part][]=[
  ['stopped','status'],['front','front'],['guard','guard'],['left','left'],['rear','rear'],['right','right'],
];
export function objective(s:Session):Target {
  if(s.pos[1]>ROAD.near) return nearCrossing(s.pos)?'arrival':'crossing';
  if(nearCrossing(s.pos) && (s.gazeSelection || observed(s,'left') || observed(s,'right') || s.passage || s.roadClear)) return 'arrival-south';
  if(!s.safety.door) return 'door';
  if(!s.safety.clipboard) return 'clipboard';
  if(!equipped(s.safety)) return 'ppe';
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
