import { DESK, PRESS, START, type Point, type Target } from './map';

export type Press = 'a' | 'b';
export type Inspection = 'stopped' | 'area' | 'left' | 'right' | 'guard' | 'clear';
export type Safety = {
  crossed: boolean;
  door: boolean;
  ppe: string[];
  inspected: Record<Press, Partial<Record<Inspection,boolean>>>;
  tagged: boolean;
  completed: boolean;
  reported: boolean;
  mailDisposition: 'report' | 'ignore' | null;
};
export type Settings = { sound: boolean; reduced: boolean; quality: 'auto' | 'low' | 'high' };
export type Panel = 'welcome' | 'pause' | 'settings' | 'restart' | 'traffic' | 'ppe' | 'checklist' | 'a' | 'al' | 'ar' | 'b' | 'bl' | 'br' | 'mail' | 'portfolio';
export type PortfolioTab = 'About Me' | 'Work Experience' | 'Projects' | 'Skills' | 'CV / Résumé' | 'Contact';
export type Failure = 'road' | 'reach' | 'operation';
export type Film = { kind: 'both' | 'near' | 'failure' | 'incident'; time: number; side?: -1 | 1; reason?: Failure; lane?: number; crossing?: boolean };
export type Session = {
  safety: Safety;
  settings: Settings;
  panel: Panel | null;
  portfolioTab: PortfolioTab;
  portfolioBack: 'pause' | 'mail' | 'welcome';
  pos: Point;
  yaw: number;
  pitch: number;
  look: [number,number] | null;
  nav: { path: Point[]; target?: Target; end: Point } | null;
  film: Film | null;
  roadClear: boolean;
  traffic: [number,number];
  stoppedA: boolean;
  pressTime: number;
  pressMode: 'idle' | 'cycling' | 'cycled';
  notification: string;
  toastId: number;
  checkpoint: 'outside' | 'press' | 'desk';
  started: boolean;
};

const key='safety-quest.works.v1';
const defaults = (): Safety => ({
  crossed:false, door:false, ppe:[], inspected:{a:{},b:{}}, tagged:false, completed:false, reported:false, mailDisposition:null,
});
const defaultsSettings = (): Settings => ({
  sound:true, reduced:typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, quality:'auto',
});
function read() {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
export function startSession(): Session {
  const data=read();
  const checkpoint = (data?.checkpoint === 'press' || data?.checkpoint === 'desk') ? data.checkpoint : 'outside';
  return {
    safety: {...defaults(),...data?.safety}, settings:{...defaultsSettings(),...data?.settings},
    panel:'welcome', portfolioTab:'About Me', portfolioBack:'welcome',
    pos: checkpoint==='desk' ? [...DESK] : checkpoint==='press' ? [...PRESS] : data?.safety?.crossed ? [0,5.7] : [...START],
    yaw:0, pitch:-.025, look:null, nav:null, film:null, roadClear:false,traffic:[32,-19], stoppedA:true,
    pressTime:0, pressMode:'idle', notification:'', toastId:0, checkpoint, started:false,
  };
}
export function save(s: Session) {
  try { localStorage.setItem(key, JSON.stringify({ safety:s.safety, settings:s.settings, checkpoint:s.checkpoint })); } catch { /* Storage may be unavailable. */ }
}
export function reset(s: Session) {
  Object.assign(s,{safety:defaults(),panel:null,pos:[...START],yaw:0,pitch:-.025,look:null,nav:null,film:null,roadClear:false,traffic:[32,-19],
    stoppedA:true,pressTime:0,pressMode:'idle',notification:'',checkpoint:'outside',started:true});
  save(s);
}
export const equipment = [
  ['glasses','Safety glasses','G', 'Protect eyes from debris.'],
  ['boots','Safety footwear','B', 'Protect feet in the training bay.'],
  ['hearing','Hearing protection','H', 'Reduce exposure in the marked noise area.'],
  ['gloves','Loose work gloves','×', 'Loose gloves can be caught by moving components.'],
  ['scarf','Loose neckwear','×', 'Secure loose clothing before entering the training bay.'],
] as const;
export const equipped = (s: Safety) => ['glasses','boots','hearing'].every(item => s.ppe.includes(item));
export const safeToStart = (s: Safety) => equipped(s) && ['stopped','area','left','right','guard','clear'].every(key => s.inspected.b[key as Inspection]);
export const hasMail = (s: Safety) => s.completed && s.tagged;
export function checklist(s: Safety): [string, boolean][] {
  const b=s.inspected.b;
  return [
    ['Verify safe equipment condition',!!b.stopped],
    ['Inspect machine surroundings',!!b.area],
    ['Check left and right sides',!!(b.left && b.right)],
    ['Inspect guards and visible defects',!!b.guard],
    ['Report/tag defective equipment',s.tagged],
    ['Operate approved training equipment safely',s.completed],
    ['Confirm cycle completion and perform shutdown',s.completed],
  ];
}
export function objective(s: Session): Target {
  if (!s.safety.crossed) return s.roadClear ? 'arrival' : 'crossing';
  if (!s.safety.door) return 'door';
  if (!equipped(s.safety)) return 'ppe';
  if (hasMail(s.safety)) return 'mail';
  if (s.pressMode !== 'idle' || s.safety.tagged) return 'b';
  return 'a';
}

