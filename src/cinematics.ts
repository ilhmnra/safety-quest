import type { Point, PpeSlot, Press } from './map';
import type { Session } from './state';

export type Film =
  | {kind:'near'; time:number; side:-1|1; cut:number; horn:number; startX:number; endX:number; useAmbient:boolean; holdView:boolean; curb:number; unchecked:boolean; restart:Point}
  | {kind:'failure'; time:number; reason:'reach'|'operation'}
  | {kind:'ppe'; time:number; press:Press; hazards:PpeSlot[]; footwear:'canvas'|'missing'}
  | {kind:'incident'|'audit'; time:number; beat:number};

export const REACH_JOLT=3.15;
export const REACH_CUT=4.08;
export const OFFICE_SHIFT=-49;
export const ROAD_REACTION_DELAY=.32;
export const ROAD_IMPACT_LEAD=.17;
export const PPE_BEAT=1.74;
export const PPE_FADE=.25;
export const PPE_CUES={feet:.79,eyes:.56,ears:.24} as const;
const officeBeats=['office-intro','office-manager','office-staff','office-close'] as const;

export function filmStage(s:Session) {
  const f=s.film;
  if(!f) return '';
  if(f.kind==='near') {
    if(f.time<f.horn) return 'near-quiet';
    if(f.time>=f.cut-ROAD_IMPACT_LEAD&&f.time<f.cut) return 'near-impact';
    if(f.time<f.cut) return 'near-horn';
    return 'near-black';
  }
  if(f.kind==='failure') {
    if(f.time<(f.reason==='reach'?REACH_JOLT:1.3)) return 'machine-tension';
    return f.time<(f.reason==='reach'?REACH_CUT:2.55)?'machine-danger':'machine-black';
  }
  if(f.kind==='ppe') {
    const beat=ppeBeat(f);
    if(!beat) return 'ppe-black';
    if(beat.time>=PPE_BEAT-PPE_FADE) return 'ppe-fade';
    return `ppe-${beat.slot}${beat.time>=PPE_CUES[beat.slot]?'-impact':''}`;
  }
  return officeBeats[f.beat];
}
export function canContinue(f:Film) {
  if(f.kind==='near') return f.time>=f.cut;
  if(f.kind==='failure') return f.time>=(f.reason==='reach'?REACH_CUT:2.55);
  if(f.kind==='ppe') return f.time>=f.hazards.length*PPE_BEAT;
  return true;
}

export function ppeBeat(f:Film|null) {
  if(f?.kind!=='ppe') return null;
  const index=Math.floor(f.time/PPE_BEAT),slot=f.hazards[index];
  return slot?{slot,time:f.time-index*PPE_BEAT}:null;
}
