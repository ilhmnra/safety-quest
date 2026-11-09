import { MathUtils } from 'three';
import { play, setHearingEffect, warmMusic } from './audio';
import { canContinue, filmStage, PPE_BEAT, PPE_CUES, PPE_FADE, ppeBeat, REACH_CUT, REACH_JOLT, ROAD_IMPACT_LEAD } from './cinematics';
import { advanceTraffic, approachingLane, crossingThreat, dangerFilm, fromSouth, inTruckLane, roadOccupied, truckFrom } from './traffic';
import { DESK, distance, gear, inCrossing, isGear, machinePart, onRoad, positions, PRESS, pressHazard, ROAD, route, solid, START, WALK_SPEED, type Gear, type Part, type Point, type Press, type Target } from './map';
import { equipped, hasMail, nearCrossing, observed, recordIssues, recordName, nextStep, save, unsafePpe, type Inspection, type PreparationCheck, type Session } from './state';

const ROAD_EDGE_BUFFER=.02;

export function say(s:Session, message:string) {
  s.notification=message;
  s.toastId++;
}
export const turnTo=(from:Point,to:Point)=>Math.atan2(from[0]-to[0],from[1]-to[1]);
export const angleDelta=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const sideYaw=(s:Session,side:'left'|'center'|'right')=>(fromSouth(s.pos)?0:Math.PI)+(side==='center'?0:side==='left'?1:-1)*1.38;
const newGaze=()=>({left:-Infinity,right:-Infinity,side:null,dwell:0,curb:null,checked:false} as const);

function refreshCrossing(s:Session) {
  if(s.crossingHeading!==null) return;
  const side=s.gaze.checked?crossingThreat(s):null;
  s.roadClear=s.gaze.checked&&!side;
  s.trafficSide=side;
}

function resetCrossing(s:Session) {
  s.roadClear=false;
  s.trafficSide=null;
  s.crossingHeading=null;
  s.crossingDanger=null;
  s.gaze=newGaze();
  s.gazeSelection=null;
}

function startPpeIncident(s:Session,press:Press) {
  const hazards=unsafePpe(s.safety);
  if(!hazards.length || s.film) return false;
  s.nav=null;
  s.focus=null;
  s.look=null;
  s.film={kind:'ppe',press,hazards,time:0,footwear:s.safety.ppe.includes('sneakers')?'canvas':'missing'};
  return true;
}

export function turnHead(s:Session,side:'left'|'center'|'right') {
  s.nav=null;
  s.focus=null;
  s.gazeSelection=side;
  s.look=[sideYaw(s,side),-.025];
}

export function observeView(s:Session,yaw:number,pitch:number,dt:number) {
  if(s.panel || s.film || !s.started || !nearCrossing(s.pos) || s.gaze.checked) return false;
  const curb=fromSouth(s.pos)?'south':'north';
  if(s.gaze.curb!==curb) s.gaze={...newGaze(),curb};
  const side=Math.abs(pitch)>.64 ? null : (['left','right'] as const).find(d=>Math.abs(angleDelta(yaw,sideYaw(s,d)))<.57) ?? null;
  if(side!==s.gaze.side) {
    s.gaze.side=side;
    s.gaze.dwell=0;
  }
  if(!side) return false;
  s.gaze.dwell+=dt;
  if(s.gaze.dwell<.16) return false;
  s.gaze[side]=s.time;
  if(!observed(s,'left') || !observed(s,'right')) return false;
  s.gaze.checked=true;
  refreshCrossing(s);
  return true;
}

export function targetAvailable(s:Session,target:Target) {
  if(target==='crossing') return s.pos[1]>ROAD.near && !s.gaze.checked;
  if(target==='crossing-north') return s.pos[1]>0 && s.pos[1]<ROAD.far && !s.gaze.checked;
  if(target==='arrival'||target==='arrival-south') {
    const south=target==='arrival';
    return s.crossingHeading===null?nearCrossing(s.pos)&&fromSouth(s.pos)===south:s.crossingHeading===(south?0:Math.PI);
  }
  if(target==='door') return s.pos[1]>-.55 && s.pos[1]<ROAD.far && !s.safety.door;
  if(s.pos[1]>-.65) return false;
  if(target==='clipboard') return !s.safety.clipboard;
  if(target==='tag') return !s.safety.tagHeld && !s.safety.tagged;
  const machine=machinePart(target);
  if(!machine) return true;
  const [press,part]=machine;
  if(part==='tag') return !s.safety.tagged;
  if(part==='reach') return !s.safety.tagged;
  if(part==='start') return press==='a'&&nextStep(s.safety,'a')?.[0]==='cycle'&&s.pressMode==='idle';
  return true;
}

function aimAt(s:Session,target:Target) {
  const [x,y,z]=positions[target].anchor;
  s.look=[turnTo(s.pos,[x,z]),Math.atan2(y-1.72,Math.max(.4,distance(s.pos,[x,z])))];
}

export function interact(s:Session,target:Target) {
  if(s.film || s.panel==='reach') return;
  if((target==='tag'||target==='clipboard') && !targetAvailable(s,target)) return;
  s.nav=null;
  s.focus=null;
  if(target==='crossing'||target==='crossing-north') {
    turnHead(s,'center');
  } else if(target==='arrival'||target==='arrival-south') {
    say(s,target==='arrival'?'Follow the entrance sign.':'You are back at the visitor entrance.');
  } else if(target==='door') {
    s.safety.door=true;
    play('door',s.settings.sound);
    save(s);
    say(s,'Pick up the clipboard beside the PPE cabinet.');
    navigate(s,[2.6,-1.8]);
  } else if(target==='ppe') {
    const [x,y,z]=gear.hearing.anchor;
    s.look=[turnTo(s.pos,[x,z]),Math.atan2(y-.28-1.72,distance(s.pos,[x,z]))];
    say(s,'Select the equipment on the shelves to inspect it.');
    play('ui',s.settings.sound);
  } else if(target==='clipboard') {
    s.safety.clipboard=true;
    s.panel='clipboard';
    s.clipboardBack=null;
    s.pressPage='ppe';
    save(s);
    play('paper',s.settings.sound);
  } else if(target==='tag') {
    s.safety.tagHeld=true;
    save(s);
    play('switch',s.settings.sound);
    say(s,'Out-of-service tag picked up.');
  } else if(target==='mail') {
    aimAt(s,target);
    s.panel='mail';
    s.desktop=s.safety.mailDisposition?'security':'home';
    if(hasMail(s.safety)) {
      s.checkpoint='desk';
      save(s);
    }
  } else if(isGear(target)) {
    aimAt(s,target);
    s.panel=null;
    s.focus={target,time:0};
    play('ui',s.settings.sound);
  } else {
    const [press,part]=machinePart(target)!;
    if(startPpeIncident(s,press)) return;
    if(press==='b'&&nextStep(s.safety,'a')&&part!=='reach') {
      say(s,'Complete the functional Press A exercise first.');
      return;
    }
    if(part==='start'||part==='stop') {
      s.controlPress={target,until:s.time+.24};
      if(part==='start') startPress(s,press);
      else stopPress(s,press);
    }
    else if(part==='tag') tagPress(s);
    else if(part==='reach') {
      aimAt(s,target);
      if(press==='b'&&!s.safety.tagged) s.panel='reach';
    } else {
      if(press==='a' && s.pressMode==='cycling') {
        say(s,'Keep clear while the press is moving.');
        return;
      }
      aimAt(s,target);
      s.focus={target,time:0};
    }
  }
}

export function navigate(s:Session,destination:Target|Point) {
  const target=typeof destination==='string'?destination:undefined;
  const point=target?positions[target].point:destination as Point;
  const across=fromSouth(s.pos)?point[1]<ROAD.near:point[1]>ROAD.far;
  const clearAtStart=s.roadClear&&nearCrossing(s.pos)&&across&&inCrossing(point);
  const path=walkingRoute(s,point);
  if(!path) { say(s,'There is no clear walking route there.'); return; }
  // Keep the entire approach collision-free, but stop as soon as the final leg enters interaction range.
  if(target && !['arrival','arrival-south','crossing','crossing-north'].includes(target)) {
    const previous=path.length===1?s.pos:path[path.length-2];
    const leg=distance(previous,point);
    const fraction=Math.min(1,positions[target].reach*.82/Math.max(.001,leg));
    path[path.length-1]=[point[0]+(previous[0]-point[0])*fraction,point[1]+(previous[1]-point[1])*fraction];
  }
  s.panel=null;
  s.focus=null;
  s.look=null;
  s.nav={path,target,end:path[path.length-1],clearAtStart};
}

export function walkingRoute(s:Session,point:Point) {
  const south=fromSouth(s.pos);
  const towardRoad=south?point[1]<ROAD.near:point[1]>ROAD.far;
  if(nearCrossing(s.pos) && towardRoad && inCrossing(point)) {
    const near=positions[south?'crossing':'crossing-north'].point;
    const far=positions[south?'arrival':'arrival-south'].point;
    const first=route(s.pos,near,s.safety.door);
    if(first && onRoad(point)) return [...first,point];
    const last=route(far,point,s.safety.door);
    if(first && last) return [...first,far,...last];
  }
  return route(s.pos,point,s.safety.door);
}

export function openNearby(s:Session,target?:Target) {
  if(!target || !targetAvailable(s,target)) return;
  const dest=positions[target];
  if(distance(s.pos,dest.point)<=dest.reach && route(s.pos,dest.point,s.safety.door)?.length===1) interact(s,target);
  else navigate(s,target);
}

export function nearest(s:Session):Target|undefined {
  let best:Target|undefined, rating=Infinity;
  for(const [id,value] of Object.entries(positions)) {
    const target=id as Target;
    if(!targetAvailable(s,target) || target==='arrival' || target==='arrival-south') continue;
    const d=distance(s.pos,value.point);
    if(d>value.reach+.1) continue;
    const [x,y,z]=value.anchor;
    const heading=angleDelta(s.yaw,turnTo(s.pos,[x,z]));
    const pitch=Math.atan2(y-1.72,Math.max(.4,distance(s.pos,[x,z])));
    if(Math.abs(heading)>.75) continue;
    const score=d*.32+Math.abs(heading)*2+Math.abs(pitch-s.pitch)*2.7;
    if(score<rating) { rating=score; best=target; }
  }
  return best;
}

export function gearAction(s:Session,id:Gear) {
  const item=gear[id];
  const wearing=s.safety.ppe.includes(id);
  s.safety.ppe=s.safety.ppe.filter(other=>gear[other].slot!==item.slot);
  if(!wearing) {
    s.safety.ppe.push(id);
    if(!s.safety.collectedPpe.includes(id)) s.safety.collectedPpe.push(id);
  }
  if(!s.safety.inspectedPpe.includes(id)) s.safety.inspectedPpe.push(id);
  save(s);
  play('switch',s.settings.sound);
  say(s,!wearing&&!item.sound?item.detail:wearing?`${item.name} returned to the shelf.`:`${item.name} fitted.`);
}

function fail(s:Session,reason:'reach'|'operation') {
  s.panel=null;
  s.nav=null;
  s.focus=null;
  s.film={kind:'failure',reason,time:0};
  play(reason==='reach'?'strain':'warning',s.settings.sound);
}

export function endFilm(s:Session) {
  const film=s.film;
  if(!film) return;
  s.seenFilms.add(film.kind);
  s.film=null;
  s.look=null;
  s.focus=null;
  s.yaw=0;
  s.pitch=-.025;
  if(film.kind==='near') {
    s.pos=[...film.restart];
    resetCrossing(s);
    if(film.curb===ROAD.far) s.yaw=Math.PI;
  } else if(film.kind==='incident') {
    s.pos=[...DESK];
    s.checkpoint='desk';
    s.desktop='inbox';
    s.panel='mail';
  } else if(film.kind==='audit') {
    s.pos=[...PRESS];
    s.checkpoint='press';
    const issues=recordIssues(s.safety);
    s.pressPage=issues[0]?.page??'a';
    say(s,'Review '+[...new Set(issues.map(issue=>recordName(issue.page)))].join(' and ')+' on your clipboard.');
  } else if(film.kind==='ppe') {
    setHearingEffect(false);
    s.pos=[...PRESS];
    s.yaw=turnTo(PRESS,positions.ppe.point);
    s.checkpoint='press';
    say(s,'Check your equipment at the PPE station before re-entering the press bay.');
  } else {
    s.pos=[...PRESS];
    s.checkpoint='press';

  }
  save(s);
}

export function skipFilm(s:Session) {
  const film=s.film;
  if(!film || !s.seenFilms.has(film.kind)) return;
  if(film.kind==='near') film.time=film.cut;
  else if(film.kind==='failure') film.time=film.reason==='reach'?REACH_CUT:2.55;
  else if(film.kind==='ppe') {film.time=film.hazards.length*PPE_BEAT;setHearingEffect(false);}
  else {film.beat=3;film.time=0;}
}

export function continueFilm(s:Session) {
  const f=s.film;
  if(!f || !canContinue(f)) return;
  play('ui',s.settings.sound);
  if((f.kind==='incident'||f.kind==='audit') && f.beat<3) {
    f.beat++;
    f.time=0;
  } else endFilm(s);
}

export function markPreparation(s:Session,key:PreparationCheck,checked:boolean) {
  s.safety.recordedPpe[key]=checked;
  save(s);
  play('paper',s.settings.sound);
}

function record(s:Session,press:Press,key:Inspection) {
  s.safety.inspected[press][key]=true;
  save(s);
}

export function markRecord(s:Session,press:Press,key:Inspection,checked:boolean) {
  s.safety.recorded[press][key]=checked;
  save(s);
  play('paper',s.settings.sound);
}

function finishTraining(s:Session) {
  if(!hasMail(s.safety)) return;
  play('mail',s.settings.sound);
  say(s,"You've got mail!");
}

export function resolveReach(s:Session,confirmed:boolean) {
  if(s.panel!=='reach'||s.film) return;
  s.panel=null;
  if(confirmed&&!s.safety.tagged) fail(s,'reach');
}

function performStep(s:Session,press:Press,part:Part) {
  const step=nextStep(s.safety,press);
  if(step?.[2]!==part) return false;
  record(s,press,step[0]);
  if(hasMail(s.safety)&&!s.safety.mailDisposition) finishTraining(s);
  return true;
}

function tagPress(s:Session) {
  if(s.safety.tagged) return;
  if(!s.safety.tagHeld) { say(s,'Pick up an out-of-service tag from the preparation station.'); return; }
  const step=nextStep(s.safety,'b');
  if(step?.[2]!=='tag') { say(s,step?.[3]??'Complete the Press B inspection.'); return; }
  s.safety.tagHeld=false;
  s.safety.tagged=true;
  performStep(s,'b','tag');
  play('switch',s.settings.sound);
}

function startPress(s:Session,press:Press) {
  if(press!=='a'||!equipped(s.safety)||!targetAvailable(s,'a-start')) return;
  s.pressTime=0;
  s.pressMode='cycling';
  play('cycle',s.settings.sound);
  say(s,'Training cycle in progress. Keep clear of the tooling.');
}
function stopPress(s:Session,press:Press) {
  play('switch',s.settings.sound);
  if(press==='a') {
    s.pressMode='idle';
    s.pressTime=0;
  }
  performStep(s,press,'stop');
  say(s,'Press '+press.toUpperCase()+' is stopped. Servicing requires authorized energy isolation.');
}

function inspect(s:Session,target:Target) {
  if(isGear(target)) {
    if(!s.safety.inspectedPpe.includes(target)) {
      s.safety.inspectedPpe.push(target);
      save(s);
    }
    return;
  }
  const machine=machinePart(target);
  if(!machine) return;
  const [press,part]=machine;
  if(part==='status'&&press==='a'&&s.pressMode!=='idle') return;
  performStep(s,press,part);
}

export function mailDecision(s:Session,decision:'report'|'ignore'|'open') {
  if(!hasMail(s.safety) || s.safety.mailDisposition) return;
  if(decision==='open') {
    s.panel=null;
    s.film={kind:'incident',time:0,beat:0};
    play('warning',s.settings.sound);
  } else {
    s.safety.mailDisposition=decision;
    s.desktop='security';
    save(s);
    reviewRecords(s);
  }
}

export function reviewRecords(s:Session) {
  if(!s.safety.mailDisposition || s.safety.reported || !hasMail(s.safety)) return;
  const flagged=[...new Set(recordIssues(s.safety).map(issue=>recordName(issue.page)))];
  if(flagged.length) {
    if(!s.safety.auditShown) {
      s.safety.auditShown=true;
      save(s);
      s.panel=null;
      s.film={kind:'audit',time:0,beat:0};
    } else say(s,`Review ${flagged.join(' and ')}. Check the record against the work you performed.`);
    return;
  }
  if(!s.safety.crossed || !equipped(s.safety) || !s.safety.clipboard) {
    say(s,'Finish safety preparation before signing off.');
    return;
  }
  s.safety.reported=true;
  s.panel='ending';
  save(s);
  warmMusic(s.settings.sound);
}

function roadStep(s:Session,next:Point) {
  if(!onRoad(next)) return 'go';
  const entering=s.crossingHeading===null;
  const south=entering?fromSouth(s.pos):s.crossingHeading===0;
  const firstTruck=south?1:-1;
  const zebra=inCrossing(next);
  if(entering&&zebra&&s.trafficSide&&s.nav?.clearAtStart) {
    s.nav=null;
    return 'wait';
  }

  let danger=s.crossingDanger;
  if(entering&&zebra&&!s.roadClear) {
    const left=observed(s,'left'), right=observed(s,'right');
    const holdView=left!==right;
    const source=holdView?(left?'right':'left'):s.trafficSide;
    danger={side:source?truckFrom(source,south):firstTruck,holdView};
  }
  if(danger&&zebra&&inTruckLane(next,danger.side)&&s.gaze.checked&&!approachingLane(s,next,danger.side)) {
    s.crossingDanger=danger=null;
    s.roadClear=true;
  }
  if(!zebra || danger&&inTruckLane(next,danger.side)) {
    const side=zebra&&danger?danger.side:(fromSouth(next)?1:-1);
    s.film=dangerFilm(s,next,south,side,zebra,zebra&&!!danger?.holdView);
    s.pos=next;
    s.nav=null;
    s.look=null;
    s.focus=null;
    resetCrossing(s);
    return 'film';
  }
  if(roadOccupied(s,next)) return 'wait';
  if(entering) {
    s.crossingHeading=south?0:Math.PI;
    s.crossingDanger=danger;
  }
  return 'go';
}

function move(s:Session,next:Point) {
  if(solid(next,s.safety.door)) return false;
  const status=roadStep(s,next);
  if(status==='film') return true;
  if(status==='wait') return false;
  const wasOnRoad=onRoad(s.pos);
  const press=pressHazard(next),previousPress=pressHazard(s.pos);
  s.pos=next;
  if(wasOnRoad && !onRoad(next)) {
    const reachedFactory=next[1]<=ROAD.far+ROAD_EDGE_BUFFER;
    if(reachedFactory && s.crossingHeading===0 && s.roadClear && !s.safety.crossed) {
      s.safety.crossed=true;
      save(s);
      say(s,'The training center is just ahead.');
    }
    resetCrossing(s);
  }
  return !!press&&press!==previousPress&&startPpeIncident(s,press);
}

export function tick(s:Session,dt:number,keys:Set<string>,timelineDt=dt):boolean {
  const paused=s.panel==='pause'||s.panel==='settings'||s.panel==='restart'||
    (s.panel==='portfolio' && (s.portfolioBack==='pause'||s.portfolioBack==='ending'));
  if(paused) return false;
  s.time+=dt;
  if(s.panel==='ending' || s.panel==='reach') return false;
  const film=s.film;
  const stage=filmStage(s);
  if(stage!=='near-black') advanceTraffic(s,timelineDt);
  if(film) {
    const prev=film.time;
    film.time+=timelineDt;
    if(film.kind==='near' && prev<film.horn && film.time>=film.horn) {
      const laneYaw=film.side===1?-Math.PI/2:Math.PI/2;
      const spatial=-Math.sin(angleDelta(s.yaw,laneYaw));
      const roadSide=film.curb===ROAD.near?film.side:-film.side;
      play('horn',s.settings.sound,Math.abs(spatial)>.3?spatial:roadSide*.7);
    }
    if(film.kind==='near' && prev<film.cut-ROAD_IMPACT_LEAD && film.time>=film.cut-ROAD_IMPACT_LEAD) play('impact',s.settings.sound);
    if(film.kind==='ppe') {
      const beat=ppeBeat(film);
      setHearingEffect(beat?.slot==='ears'&&beat.time>=PPE_CUES.ears&&beat.time<PPE_BEAT-PPE_FADE);
      if(beat) {
        const cue=Math.floor(film.time/PPE_BEAT)*PPE_BEAT+PPE_CUES[beat.slot];
        if(prev<cue&&film.time>=cue) play(beat.slot==='feet'?'impact':beat.slot==='eyes'?'shrapnel':'hearing',s.settings.sound);
      }
    }
    if(film.kind==='failure' && film.reason==='reach' && prev<REACH_JOLT && film.time>=REACH_JOLT) {
      play('impact',s.settings.sound);
    }
    return stage!==filmStage(s);
  }
  if(!onRoad(s.pos) && s.gaze.curb && !nearCrossing(s.pos)) resetCrossing(s);
  refreshCrossing(s);
  let update=false;
  if(s.pressMode==='cycling') {
    s.pressTime+=dt;
    if(s.pressTime>=3.35) {
      s.pressMode='cycled';
      record(s,'a','cycle');
      say(s,'Ram returned. Use the red STOP control to finish the simulation.');
      update=true;
    }
  }
  if(s.panel || !s.started) return update;

  const horizontal=s.settings.lookKeys==='qe' ? ['q','e'] : ['arrowleft','arrowright'];
  const yawKey=Number(keys.has(horizontal[0]))-Number(keys.has(horizontal[1]));
  const pitchKey=Number(keys.has('arrowup'))-Number(keys.has('arrowdown'));
  if(yawKey || pitchKey) {
    s.look=null;
    s.gazeSelection=null;
    s.focus=null;
    s.nav=null;
    s.yaw+=yawKey*dt*1.95;
    s.pitch=MathUtils.clamp(s.pitch+pitchKey*dt*1.5,-1.18,1.18);
  }
  if(s.look) {
    const turn=angleDelta(s.yaw,s.look[0]);
    s.yaw+=turn*(1-Math.exp(-dt*8));
    s.pitch=MathUtils.damp(s.pitch,s.look[1],8,dt);
    if(Math.abs(turn)<.008 && Math.abs(s.pitch-s.look[1])<.008) s.look=null;
  }
  if(s.focus && s.focus.time<.45) {
    s.focus.time+=dt;
    if(s.focus.time>=.45) {
      inspect(s,s.focus.target);
      update=true;
    }
  }

  const vx=Number(keys.has('d'))-Number(keys.has('a'));
  const vz=Number(keys.has('s'))-Number(keys.has('w'));
  let next:Point|null=null;
  if(vx || vz) {
    const preserveGaze=nearCrossing(s.pos) && (observed(s,'left') || observed(s,'right'));
    if(s.gazeSelection!=='center' || !preserveGaze&&s.crossingHeading===null) s.look=null;
    s.focus=null;
    s.nav=null;
    const speed=dt*WALK_SPEED/Math.hypot(vx,vz);
    const yaw=s.crossingHeading??(preserveGaze?(fromSouth(s.pos)?0:Math.PI):s.yaw);
    next=[s.pos[0]+(Math.cos(yaw)*vx+Math.sin(yaw)*vz)*speed,s.pos[1]+(-Math.sin(yaw)*vx+Math.cos(yaw)*vz)*speed];
  } else if(s.nav) {
    const dest=s.nav.path[0];
    const d=distance(s.pos,dest);
    if(d<.00001) {
      s.nav.path.shift();
      if(!s.nav.path.length) {
        const target=s.nav.target;
        s.nav=null;
        if(target && targetAvailable(s,target)) interact(s,target);
        return true;
      }
    } else {
      const watched=s.crossingDanger?.holdView || nearCrossing(s.pos) && (observed(s,'left') || observed(s,'right')) && !s.roadClear;
      if(!watched) {
        const turn=angleDelta(s.yaw,turnTo(s.pos,dest));
        s.yaw+=turn*(1-Math.exp(-dt*(s.settings.reduced?12:4.8)));
        s.pitch=MathUtils.damp(s.pitch,-.055,3.5,dt);
      }
      const ratio=Math.min(d,dt*3.55)/d;
      next=[s.pos[0]+(dest[0]-s.pos[0])*ratio,s.pos[1]+(dest[1]-s.pos[1])*ratio];
    }
  }
  if(next) {
    if(solid(next,s.safety.door)) {
      if(s.nav) { s.nav=null; say(s,'The walking route is blocked.'); }
      else {
        const x:Point=[next[0],s.pos[1]],z:Point=[s.pos[0],next[1]];
        if(!solid(x,s.safety.door) && x[0]!==s.pos[0]) update=move(s,x)||update;
        else if(!solid(z,s.safety.door) && z[1]!==s.pos[1]) update=move(s,z)||update;
      }
    } else update=move(s,next)||update;
    if(s.safety.door && s.checkpoint==='outside' && s.pos[1]<-6.5 && equipped(s.safety)) {
      s.checkpoint='press';
      save(s);
    }
  }
  return update;
}
