import { DESK, distance, gear, positions, ppeOrder, PRESS, ROAD, START, type Gear, type Part, type Point, type Press, type Target } from './map';
import type { Film } from './cinematics';
import { fromSouth, startTraffic, type TrafficSide, type TruckDirection } from './traffic';

export type Inspection = 'stopInitial' | 'statusInitial' | 'front' | 'rear' | 'left' | 'right' | 'guard' | 'cycle' | 'stopFinal' | 'statusFinal' | 'defect' | 'tagged';
export type PreparationCheck = 'eyes'|'ears'|'feet'|'tag';
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
export type Panel = 'welcome' | 'pause' | 'settings' | 'restart' | 'clipboard' | 'mail' | 'portfolio' | 'ending' | 'reach';
export type PortfolioTab = 'About Me' | 'Work Experience' | 'Projects' | 'Skills' | 'CV / Résumé' | 'Contact';

export type Session = {
  safety: Safety;
  settings: Settings;
  panel: Panel | null;
  portfolioTab: PortfolioTab;
  portfolioBack: 'pause' | 'welcome' | 'ending';
  desktop: 'home'|'inbox'|'message'|'report'|'security';
  clipboardBack: Panel | null;
  pos: Point;
  yaw: number;
  pitch: number;
  look: [number,number] | null;
  focus: {target:Target; time:number} | null;
  pressPage: InspectionPage;
  controlPress: { target:Target; until:number } | null;
  nav: { path: Point[]; target?: Target; end: Point; clearAtStart?:boolean } | null;
  film: Film | null;
  seenFilms:Set<Film["kind"]>;
  roadClear: boolean;
  crossingHeading: number|null;
  crossingDanger: {side:TruckDirection; holdView:boolean}|null;
  trafficSide:TrafficSide|null;
  gaze: {left:number; right:number; side:'left'|'right'|null; dwell:number; curb:'south'|'north'|null; checked:boolean};
  gazeSelection:'left'|'center'|'right'|null;
  time: number;
  traffic: [number,number];
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
  tagged:false,  reported:false, mailDisposition:null, auditShown:false,
});
const defaultsSettings = (): Settings => ({
  sound:true, volume:.85, fov:79, reduced:typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality:'auto',control:'trackpad',lookKeys:'arrows',
});
function read() {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
const freshRuntime = () => ({
  desktop:'home' as const, look:null,focus:null,pressPage:'ppe' as const, clipboardBack:null, controlPress:null, nav:null, film:null, seenFilms:new Set<Film["kind"]>(), roadClear:false, crossingHeading:null, crossingDanger:null, trafficSide:null,
  gaze:{left:-Infinity,right:-Infinity,side:null,dwell:0,curb:null,checked:false},gazeSelection:null,time:0,traffic:startTraffic(),
  pressTime:0,pressMode:'idle' as const,notification:'',
});
export function startSession(): Session {
  const data=read();
  let checkpoint = (data?.checkpoint === 'press' || data?.checkpoint === 'desk') ? data.checkpoint : 'outside';
  const safety:Safety={...defaults(),...data?.safety};
  const uniqueGear=(items:unknown):Gear[]=>Array.isArray(items)
    ? [...new Set(items.filter((id):id is Gear=>typeof id==='string' && Object.hasOwn(gear,id)))] : [];
  const worn=uniqueGear(safety.ppe);
  safety.ppe=worn.filter((id,i)=>!worn.slice(i+1).some(other=>gear[other].slot===gear[id].slot));
  safety.collectedPpe=uniqueGear([...uniqueGear(safety.collectedPpe),...worn]);
  safety.inspectedPpe=uniqueGear(safety.inspectedPpe);
  const migrated=!!data?.safety && data.pressVersion!==2;
  if(migrated) {
    Object.assign(safety,{inspected:{a:{},b:{}},recorded:{a:{},b:{}},
      tagHeld:safety.tagHeld||safety.tagged,tagged:false,reported:false,auditShown:false});
    if(checkpoint==='desk') checkpoint='press';
  }
  return {
    ...freshRuntime(),safety, settings:{...defaultsSettings(),...data?.settings},
    pressMode:safety.inspected.a.cycle&&!safety.inspected.a.stopFinal?'cycled':'idle',
    panel:'welcome', portfolioTab:'About Me', portfolioBack:'welcome',
    pos: checkpoint==='desk' ? [...DESK] : checkpoint==='press' ? [...PRESS] : safety.crossed ? [0,5.7] : [...START],
    yaw:0, pitch:-.025,toastId:migrated?1:0,checkpoint,started:false,
    notification:migrated?"Press exercises were updated. Redo both press inspections and their clipboard records.":"",
  };
}
export function save(s: Session) {
  try { localStorage.setItem(key, JSON.stringify({ pressVersion:2,safety:s.safety, settings:s.settings, checkpoint:s.checkpoint })); } catch { /* Storage may be unavailable. */ }
}
export function reset(s: Session) {
  Object.assign(s,freshRuntime(),{safety:defaults(),panel:null,pos:[...START],yaw:0,pitch:-.025,checkpoint:'outside',started:true});
  save(s);
}
export const equipped = (s: Safety) => (['glasses','boots','hearing'] as const).every(item => s.ppe.includes(item));
export const unsafePpe = (s:Safety) => ppeOrder.filter(slot=>!s.ppe.some(id=>gear[id].slot===slot&&gear[id].sound));
const preparationItems={eyes:'glasses',ears:'hearing',feet:'boots'} as const;
export const preparationRows:readonly (readonly [PreparationCheck,string])[]=[
  ['eyes','Select and wear intact safety glasses.'],
  ['ears','Select and wear intact hearing protection.'],
  ['feet','Select and wear suitable safety footwear.'],
  ['tag','Collect the out-of-service tag for Press B.'],
];

export function preparationPerformed(s:Safety,key:PreparationCheck) {
  if(key==='tag') return s.tagHeld||s.tagged;
  return s.ppe.includes(preparationItems[key]);
}
type InspectionStep=readonly [Inspection,string,Part,string];
const pressSteps:Record<Press,readonly InspectionStep[]>={
  a:[
    ['stopInitial','Pressed STOP before inspection.','stop','Press the STOP button.'],
    ['statusInitial','Verified initial stopped status.','status','Verify that the machine is stopped.'],
    ['front','Inspected front.','front','Inspect the front of the press.'],
    ['guard','Verified guards and visible condition.','guard','Check the safety guards and visible machine condition.'],
    ['left','Inspected left.','left','Inspect the left side.'],
    ['rear','Inspected rear.','rear','Inspect the rear of the press.'],
    ['right','Inspected right.','right','Inspect the right side.'],
    ['cycle','Completed approved training cycle.','start','Complete the approved training cycle.'],
    ['stopFinal','Pressed STOP after operation.','stop','Press STOP after the cycle.'],
    ['statusFinal','Verified final stopped status.','status','Verify the machine is stopped after operation.'],
  ],
  b:[
    ['stopInitial','Pressed STOP before inspection.','stop','Press STOP before inspection.'],
    ['statusInitial','Verified initial stopped status.','status','Verify that the machine is stopped.'],
    ['front','Inspected front.','front','Inspect the front of the press.'],
    ['defect','Identified visible defect.','guard','Inspect the safety guard and identify any defects.'],
    ['left','Inspected left.','left','Inspect the left side.'],
    ['rear','Inspected rear.','rear','Inspect the rear of the press.'],
    ['right','Inspected right.','right','Inspect the right side.'],
    ['stopFinal','Pressed STOP before reporting.','stop','Press STOP again before reporting the defect.'],
    ['statusFinal','Verified final stopped status.','status','Verify the machine is still stopped.'],
    ['tagged','Reported defect and attached OUT OF SERVICE tag.','tag','Report the defect and attach the OUT OF SERVICE tag.'],
  ],
};
export const checklist=(press:Press)=>pressSteps[press];
export const nextStep=(s:Safety,press:Press)=>checklist(press).find(([key])=>!s.inspected[press][key]);
export const hasMail=(s:Safety)=>!nextStep(s,'a')&&!nextStep(s,'b');
export function endingMusicAllowed(s:Session,resumePanel:Panel|null) {
  if(!s.settings.sound) return false;
  const panel=s.panel==='portfolio'?s.portfolioBack:s.panel;
  return panel==='ending'||resumePanel==='ending'&&
    (panel==='pause'||panel==='settings'||panel==='restart');
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
const crossingApproach=4.65;
export const nearCrossing = ([x,z]:Point) => Math.abs(x)<3.2 &&
  (z>=ROAD.near && z<ROAD.near+crossingApproach || z<=ROAD.far && z>ROAD.far-crossingApproach);
export const observed = (s:Session,side:'left'|'right') => s.gaze.curb===(fromSouth(s.pos)?'south':'north') && (s.gaze.checked || s.time-s.gaze[side]<9) && Number.isFinite(s.gaze[side]);
export const usingCrossing = (s:Session) => nearCrossing(s.pos) && (s.gaze.checked || !!s.gazeSelection ||
  observed(s,'left') || observed(s,'right') || Math.cos(s.yaw)*(fromSouth(s.pos)?1:-1)>-.12);
export function objective(s:Session):Target {
  if(s.pos[1]>=ROAD.near) return nearCrossing(s.pos)?'arrival':'crossing';
  if(nearCrossing(s.pos) && (s.gazeSelection || observed(s,'left') || observed(s,'right'))) return 'arrival-south';
  if(!s.safety.door) return 'door';
  if(!s.safety.clipboard) return 'clipboard';
  for(const [key] of preparationRows) {
    if(preparationPerformed(s.safety,key)) continue;
    if(key==='tag') return 'tag';
    return distance(s.pos,positions.ppe.point)>2.4?'ppe':preparationItems[key];
  }
  for(const press of ['a','b'] as const) {
    const step=nextStep(s.safety,press);
    if(step) return `${press}-${step[2]}`;
  }
  return 'mail';
}
