import { inCrossing, onRoad, ROAD, type Point } from './map';
import type { Film } from './cinematics';
import type { Session } from './state';

export const TRUCK_HALF_WIDTH=1.28;
export const TRUCK_HALF_LENGTH=3.05;
const EDGE=64;
const SPEED=10.5;
const MIN_BUILDUP=3.4;
const playerRadius=.29;
type Lane=0|1;
const lanes=[0,1] as const;
const direction=(lane:Lane)=>lane===0?1:-1;
const laneOf=(side:-1|1):Lane=>side===1?0:1;
export const fromSouth=(pos:Point)=>pos[1]>(ROAD.near+ROAD.far)/2;
export const startTraffic=():[number,number]=>[49,-44];

export function truckMotion(s:Session,lane:Lane) {
  const x=s.traffic[lane];
  return {x,z:ROAD.lanes[lane],direction:direction(lane),visible:Math.abs(x)<EDGE};
}
export function roadOccupied(s:Session,next:Point) {
  return lanes.some(lane=>{
    const truck=truckMotion(s,lane);
    return truck.visible && Math.abs(truck.x-next[0])<TRUCK_HALF_LENGTH+playerRadius &&
      Math.abs(truck.z-next[1])<TRUCK_HALF_WIDTH+playerRadius;
  });
}

// During a check, existing traffic keeps rolling. Each scripted vehicle uses
// the same lane and pool slot once its previous trip has left the visible road.
export function startPassage(s:Session) {
  s.passage={launched:[s.traffic[0]>=-3,s.traffic[1]<=3]};
}
export function advanceTraffic(s:Session,dt:number) {
  const film=s.film?.kind==='near'?s.film:null;
  const passage=film?null:s.passage;
  for(const lane of lanes) {
    const dir=direction(lane);
    const x=s.traffic[lane];
    if(x*dir<=-EDGE) {
      if(film) {
        if(lane===laneOf(film.side)) s.traffic[lane]=dir*EDGE;
      } else if(passage) {
        const canLaunch=lane===0 || passage.launched[0] && s.traffic[0]<12;
        if(!passage.launched[lane] && canLaunch) {
          s.traffic[lane]=dir*EDGE;
          passage.launched[lane]=true;
        }
      } else if(!s.roadClear && !onRoad(s.pos)) s.traffic[lane]=dir*EDGE;
    } else {
      const speed=film && lane===laneOf(film.side) && film.time>=film.approachAt?film.speed:SPEED;
      s.traffic[lane]=dir*Math.max(-EDGE,x*dir-speed*dt);
    }
  }
  if(!passage || !passage.launched.every(Boolean) || s.traffic[0]>=-7 || s.traffic[1]<=7) return false;
  s.passage=null;
  s.roadClear=true;
  s.clearUntil=s.time+10;
  return true;
}

export function dangerFilm(s:Session,point:Point,unchecked:boolean,left:boolean,right:boolean):Extract<Film,{kind:'near'}> {
  const south=fromSouth(s.pos);
  const side=unchecked && left!==right ? (left===south?1:-1) : (south?1:-1);
  const lane=laneOf(side);
  const targetX=point[0]+side*(TRUCK_HALF_LENGTH+1.3);
  const distance=(s.traffic[lane]-targetX)*side;
  const canUseCurrent=distance>=11;
  const finishTrip=canUseCurrent?0:Math.max(0,(s.traffic[lane]*side+EDGE)/SPEED);
  const speed=canUseCurrent?Math.min(SPEED,distance/MIN_BUILDUP):SPEED;
  const approach=canUseCurrent?distance/speed:(EDGE-targetX*side)/speed;
  const cut=finishTrip+approach;
  return {
    kind:'near', time:0, side, cut, horn:cut-1.9, approachAt:finishTrip, speed, holdView:unchecked&&left!==right, curb:south?ROAD.near:ROAD.far,
    unchecked, restart:south?[0,22.7]:[0,5.75],
  };
}

export function updateClearance(s:Session,near:boolean) {
  if(onRoad(s.pos)) return;
  if(s.roadClear && (s.time>s.clearUntil || !near || !inCrossing(s.pos))) s.roadClear=false;
}
