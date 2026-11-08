import { MathUtils } from 'three';
import { play, warmMusic } from './audio';
import { allowed, DESK, distance, inCrossing, onRoad, positions, PRESS, ROAD, route, solid, START, type Point, type Target } from './map';
import { equipped, hasMail, safeToStart, save, type Failure, type Inspection, type Press, type Session } from './state';

export function say(s: Session, message: string) {
  s.notification=message;
  s.toastId++;
}
export const turnTo = (from:Point, to:Point) => Math.atan2(from[0]-to[0],from[1]-to[1]);
export function interact(s:Session, target:Target) {
  s.nav=null;
  if (target==='crossing') {
    if(s.roadClear || s.safety.crossed) navigate(s,'arrival');
    else s.panel='traffic';
  } else if (target==='arrival') {
    say(s,'The entrance is straight ahead.');
  } else if (target==='door') {
    if (!s.safety.door) {
      s.safety.door=true;
      play('door',s.settings.sound);
      save(s);
      say(s,'Step inside. The PPE station is on the right.');
    }
    navigate(s,[0,-2.25]);
  } else {
    s.panel=target;
    if (target==='mail' && hasMail(s.safety)) {
      s.checkpoint='desk';
      save(s);
    }
  }
}
export function navigate(s:Session, destination:Target | Point) {
  const target=typeof destination==='string'?destination:undefined;
  const point=typeof destination==='string'?positions[destination].point:destination;
  const cleared=s.roadClear || s.safety.crossed;
  if (target==='arrival' && !cleared) {
    say(s,'Check both directions at the zebra crossing first.');
    return;
  }
  const path=route(s.pos,point,s.safety.door,cleared);
  if(!path) {
    say(s,onRoad(point) || (s.pos[1]>ROAD.near && point[1]<ROAD.far) ? 'Use the zebra crossing and wait for a clear road.' : 'There is no clear walking route there.');
    return;
  }
  s.panel=null;
  s.look=null;
  s.nav={path,target,end:point};
}
export function openNearby(s: Session, target?:Target) {
  if (!target) return;
  if (distance(s.pos,positions[target].point)<=positions[target].reach) {
    const [x,,z]=positions[target].anchor;
    if (target!=='arrival') s.look=[turnTo(s.pos,[x,z]),0];
    interact(s,target);
  } else navigate(s,target);
}
export function nearest(s:Session):Target|undefined {
  let best:Target|undefined, rating=Infinity;
  for(const [id, value] of Object.entries(positions)) {
    const target=id as Target;
    if(target==='arrival' || (target==='door' && s.safety.door) || (target==='crossing' && s.safety.crossed)) continue;
    const d=distance(s.pos,value.point);
    if(d>value.reach) continue;
    const [x,,z]=value.anchor;
    const angle=turnTo(s.pos,[x,z])-s.yaw;
    const score=d+(1-Math.cos(angle))*.8;
    if(score<rating) { rating=score; best=target; }
  }
  return best;
}
export function checkTraffic(s:Session, choice:'both'|'right'|'left'|'none') {
  s.panel=null;
  s.nav=null;
  s.look=null;
  if(choice==='both') {
    s.film={kind:'both',time:0};
    return;
  }
  const side=choice==='right'?-1:1;
  const lane=side===1?13.7:9.2;
  s.film={kind:'near',time:0,side,lane,crossing:true};
}
function fail(s:Session,reason:Failure) {
  s.panel=null;
  s.nav=null;
  s.look=null;
  s.film={kind:'failure',reason,time:0};
  play('warning',s.settings.sound);
}
export function endFilm(s:Session) {
  const film=s.film;
  if(!film) return;
  if (film.kind==='both') {
    s.roadClear=true;
    s.yaw=0;
    s.pitch=-.025;
    say(s,'Road clear. Cross at the zebra stripes.');
  } else if (film.kind==='incident') {
    s.pos=[...DESK];
    s.yaw=0;
    s.pitch=0;
    s.panel='mail';
  } else if(film.reason==='road' || film.kind==='near') {
    s.pos=[...START];
    s.yaw=0;
    s.pitch=-.025;
    s.roadClear=false;
  } else {
    s.pos=[...PRESS];
    s.yaw=0;
    s.pitch=0;
    s.stoppedA=true;
    s.pressMode='idle';
    s.pressTime=0;
  }
  s.film=null;
}
export function record(s:Session,press:Press,key:Inspection) {
  s.safety.inspected[press][key]=true;
  save(s);
  play('switch',s.settings.sound);
}
function finishTraining(s:Session) {
  if(!hasMail(s.safety)) return;
  play('mail',s.settings.sound);
  say(s,"YOU'VE GOT MAIL!");
}
export function tagPress(s:Session) {
  if(s.safety.tagged) return;
  if(!s.stoppedA) { say(s,'Stop the simulated press before reporting.'); return; }
  if(!s.safety.inspected.a.right && !s.safety.inspected.a.guard) { say(s,'Inspect the right-side guard to document the defect.'); return; }
  s.safety.tagged=true;
  save(s);
  play('switch',s.settings.sound);
  if(hasMail(s.safety)) finishTraining(s);
  else say(s,'Out-of-service tag attached. Press A stays unavailable.');
}
export function startPress(s:Session,press:Press) {
  if (press==='a') {
    if(s.safety.tagged) return;
    if(!equipped(s.safety)) { say(s,'Equip the required PPE before using the controls.'); return; }
    s.stoppedA=false;
    play('warning',s.settings.sound);
    say(s,'Press A failed to cycle. Stop and report the fault.');
  } else if (!safeToStart(s.safety) || s.pressMode!=='idle') {
    fail(s,'operation');
  } else {
    s.pressTime=0;
    s.pressMode='cycling';
    play('cycle',s.settings.sound);
  }
}
export function stopPress(s:Session,press:Press) {
  play('switch',s.settings.sound);
  if(press==='a') {
    s.stoppedA=true;
    say(s,'Press A is stopped. Report the fault and leave servicing to authorized personnel.');
  } else if(s.pressMode==='cycling') {
    s.pressMode='idle';
    s.pressTime=0;
    say(s,'Simulation stopped early. Run a full cycle and verify the ram returns.');
  } else if(s.pressMode==='cycled') {
    s.pressMode='idle';
    s.pressTime=0;
    if (!s.safety.completed) {
      s.safety.completed=true;
      save(s);
      if(hasMail(s.safety)) finishTraining(s);
      else say(s,'Press B is shut down. Inspect and report any defects on Press A.');
    } else say(s,'Press B is shut down.');
  } else say(s,'Press B is already stopped.');
}
export function reachInside(s:Session) { fail(s,'reach'); }

export function mailDecision(s:Session, decision:'report'|'ignore'|'open') {
  if(!hasMail(s.safety) || s.safety.reported) return;
  if(decision!=='open') {
    s.safety.reported=true;
    s.safety.mailDisposition=decision;
    save(s);
    warmMusic(s.settings.sound);
    say(s,'All safety checks completed. Great work!');
  } else {
    s.panel=null;
    s.film={kind:'incident',time:0};
    play('warning',s.settings.sound);
  }
}

export function tick(s:Session,dt:number,keys:Set<string>):boolean {
  let update=false;
  const paused=s.panel==='pause' || s.panel==='settings' || s.panel==='restart' ||
    (s.panel==='portfolio' && s.portfolioBack==='pause');
  if(paused) return false;
  const yielding=s.safety.crossed && Math.abs(s.pos[0])<3 && s.pos[1]>ROAD.far-2.4 && s.pos[1]<ROAD.near+2.4;
  for (const lane of [0,1] as const) {
    const side=lane===0?1:-1;
    const next=s.traffic[lane]-side*dt*(lane===0?7.4:6.6);
    if(yielding && s.traffic[lane]*side>6.5 && next*side<=6.5) continue;
    s.traffic[lane]=next*side< -44?side*44:next;
  }
  if (s.pressMode==='cycling' && !s.film && s.panel!=='pause' && s.panel!=='settings' && s.panel!=='restart') {
    s.pressTime+=dt;
    if(s.pressTime>=3.35) {
      s.pressMode='cycled';
      say(s,'The ram has returned. Confirm the shutdown at Press B.');
      update=true;
    }
  }
  const film=s.film;
  if(film) {
    const prev=film.time;
    film.time+=dt;
    if(film.kind==='near' && prev<.68 && film.time>=.68) play('horn',s.settings.sound);
    if(film.kind==='near' && film.time<1.47) {
      if(film.crossing) s.pos[0]=MathUtils.damp(s.pos[0],0,7,dt);
      s.pos[1]=MathUtils.damp(s.pos[1],film.lane!,2.12,dt);
    }
    if((film.kind==='both' && film.time>=6.1) || (film.kind==='near' && film.time>=4.5) ||
      (film.kind==='failure' && film.time>=3.55) || (film.kind==='incident' && film.time>=13.6)) {
      endFilm(s);
      return true;
    }
    return update;
  }
  if(s.look) {
    const d=Math.atan2(Math.sin(s.look[0]-s.yaw),Math.cos(s.look[0]-s.yaw));
    s.yaw+=d*(1-Math.exp(-dt*(s.settings.reduced?18:7)));
    s.pitch=MathUtils.damp(s.pitch,s.look[1],s.settings.reduced?18:7,dt);
    if(Math.abs(d)<.01 && Math.abs(s.pitch-s.look[1])<.01) s.look=null;
  }
  if(s.panel || !s.started) return update;
  const vx=Number(keys.has('d') || keys.has('arrowright'))-Number(keys.has('a') || keys.has('arrowleft'));
  const vz=Number(keys.has('s') || keys.has('arrowdown'))-Number(keys.has('w') || keys.has('arrowup'));
  let next:Point|null=null;
  if(vx || vz) {
    s.look=null;
    s.nav=null;
    const speed=dt*3.3/Math.hypot(vx,vz);
    next=[s.pos[0]+(Math.cos(s.yaw)*vx+Math.sin(s.yaw)*vz)*speed,s.pos[1]+(-Math.sin(s.yaw)*vx+Math.cos(s.yaw)*vz)*speed];
  } else if(s.nav) {
    const dest=s.nav.path[0];
    const d=distance(s.pos,dest);
    if(d<.00001) {
      s.nav.path.shift();
      if(!s.nav.path.length) {
        const target=s.nav.target;
        s.nav=null;
        if(target) {
          const [x,y,z]=positions[target].anchor;
          s.look=[turnTo(s.pos,[x,z]),target==='mail'?Math.atan2(y-1.7,distance(s.pos,[x,z]))*.62:0];
          interact(s,target);
          return true;
        }
      }
    } else {
      const heading=turnTo(s.pos,dest);
      const turn=Math.atan2(Math.sin(heading-s.yaw),Math.cos(heading-s.yaw));
      s.yaw+=turn*(1-Math.exp(-dt*(s.settings.reduced?12:4.8)));
      s.pitch=MathUtils.damp(s.pitch,-.055,3.5,dt);
      const move=Math.min(d,dt*3.55)/d;
      next=[s.pos[0]+(dest[0]-s.pos[0])*move,s.pos[1]+(dest[1]-s.pos[1])*move];
    }
  }
  if(next) {
    const cleared=s.safety.crossed || s.roadClear;
    const pass=(p:Point)=>!solid(p,s.safety.door) && (!s.nav || allowed(p,s.safety.door,cleared));
    if(pass(next)) {
      if(onRoad(next) && (!inCrossing(next) || !cleared)) {
        const side=next[1]>11.4?1:-1;
        s.nav=null;
        s.film={kind:'near',time:0,side,lane:next[1]};
        return true;
      }
      const truckAhead=s.safety.crossed && onRoad(next) && s.traffic.some((x,lane)=>
        Math.abs(x-next![0])<3.55 && Math.abs((lane===0?13.7:9.2)-next![1])<1.34);
      if(!truckAhead) s.pos=next;
    } else if(!s.nav) {
      const x:Point=[next[0],s.pos[1]], z:Point=[s.pos[0],next[1]];
      if(pass(x) && (!onRoad(x)||(cleared&&inCrossing(x)))) s.pos=x;
      else if(pass(z) && (!onRoad(z)||(cleared&&inCrossing(z)))) s.pos=z;
    } else {
      s.nav=null;
      say(s,'The walking route is blocked.');
      update=true;
    }
    if(s.roadClear && !s.safety.crossed && s.pos[1]<ROAD.far-.23) {
      s.safety.crossed=true;
      s.traffic=[28,-28];
      save(s);
      say(s,'Follow the walkway to the training center.');
      update=true;
    }
    if(s.safety.door && s.checkpoint==='outside' && s.pos[1]<-6.5 && equipped(s.safety)) {
      s.checkpoint='press';
      save(s);
    }
  }
  return update;
}

