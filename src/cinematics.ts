import type { Point } from './map';
import type { Session } from './state';

export type Film =
  | {kind:'near'; time:number; side:-1|1; cut:number; horn:number; startX:number; endX:number; useAmbient:boolean; holdView:boolean; curb:number; unchecked:boolean; restart:Point}
  | {kind:'failure'; time:number; reason:'reach'|'operation'}
  | {kind:'incident'|'audit'; time:number; beat:number};

export const REACH_JOLT=3.15;
export const REACH_CUT=4.08;
export const OFFICE_SHIFT=-49;
export const ROAD_REACTION_DELAY=.32;
const officeBeats=['office-intro','office-manager','office-staff','office-close'] as const;

export function filmStage(s:Session) {
  const f=s.film;
  if(!f) return '';
  if(f.kind==='near') {
    if(f.time<f.horn) return 'near-quiet';
    if(f.time<f.cut) return 'near-horn';
    return 'near-black';
  }
  if(f.kind==='failure') {
    if(f.time<(f.reason==='reach'?REACH_JOLT:1.3)) return 'machine-tension';
    return f.time<(f.reason==='reach'?REACH_CUT:2.55)?'machine-danger':'machine-black';
  }
  return officeBeats[f.beat];
}
export function canContinue(f:Film) {
  if(f.kind==='near') return f.time>=f.cut;
  if(f.kind==='failure') return f.time>=(f.reason==='reach'?REACH_CUT:2.55);
  return true;
}
