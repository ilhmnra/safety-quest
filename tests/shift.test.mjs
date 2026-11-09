import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite=await createServer({server:{middlewareMode:true,watch:null},appType:'custom'});
after(()=>vite.close());
const state=await vite.ssrLoadModule('/src/state.ts');
const engine=await vite.ssrLoadModule('/src/engine.ts');
const map=await vite.ssrLoadModule('/src/map.ts');
const traffic=await vite.ssrLoadModule('/src/traffic.ts');
const cinema=await vite.ssrLoadModule('/src/cinematics.ts');

const idle=new Set();

test('the bundled air horn has a strong signal before the camera reaction',()=>{
  const clip=readFileSync(new URL('../public/truck-air-horn.wav',import.meta.url));
  assert.equal(clip.toString('ascii',0,4),'RIFF');
  assert.equal(clip.readUInt16LE(22),1);
  const samples=Math.floor(clip.readUInt32LE(24)*.15);
  let energy=0;
  for(let i=0;i<samples;i++) energy+=(clip.readInt16LE(44+i*2)/32768)**2;
  assert.ok(Math.sqrt(energy/samples)>.25);
});
function tickFor(s,seconds,keys=idle) {
  for(let t=0;t<seconds;t+=.02) engine.tick(s,.02,keys);
}
function session(pos=[0,16.45]) {
  const s=state.startSession();
  Object.assign(s,{started:true,panel:null,pos:[...pos]});
  s.settings.sound=false;
  return s;
}
function look(s,side) {
  const yaw=(traffic.fromSouth(s.pos)?0:Math.PI)+(side==='left'?1.38:-1.38);
  s.yaw=yaw;
  for(let i=0;i<15;i++) {engine.tick(s,.02,idle);engine.observeView(s,yaw,0,.02);}
}
function inspect(s,target) {
  s.pos=[...map.positions[target].point];
  engine.interact(s,target);
  tickFor(s,.51);
}
function prepare(s) {
  s.safety.crossed=true;
  s.safety.door=true;
  s.safety.ppe=['glasses','hearing','boots'];
  s.pos=[...map.positions.clipboard.point];
  engine.interact(s,'clipboard');
  s.panel=null;
  s.pos=[...map.PRESS];
}
function document(s,press) {
  for(const [key] of state.checklist(press)) engine.markRecord(s,press,key,true);
}
function completePress(s,press) {
  for(const [key,,part] of state.checklist(press)) {
    if(s.safety.inspected[press][key]) continue;
    inspect(s,press+'-'+part);
    if(part==='start') tickFor(s,3.6);
    assert.equal(s.safety.inspected[press][key],true,key);
  }
}

test('off-stripe navigation remains possible; the truck stays in lane and cuts before contact',()=>{
  const s=session([5.8,18.5]);
  s.traffic[0]=-18; // The ambient vehicle has passed and is still on-screen.
  engine.navigate(s,[5.8,6]);
  assert.ok(s.nav);
  tickFor(s,1);
  assert.equal(s.film?.kind,'near');
  assert.equal(s.film.unchecked,false);
  const before=s.pos.slice();
  assert.ok(s.film.cut>=2 && s.film.cut<=3 && s.film.horn+cinema.ROAD_REACTION_DELAY<s.film.cut);
  assert.equal(s.film.useAmbient,false);
  while(s.film.time<s.film.cut) {
    const truck=traffic.encounterTruck(s);
    assert.ok(truck.z-traffic.TRUCK_HALF_WIDTH>map.ROAD.far);
    assert.ok(truck.z+traffic.TRUCK_HALF_WIDTH<map.ROAD.near);
    assert.equal(traffic.roadOccupied(s,s.pos),false);
    engine.tick(s,.02,idle);
  }
  const atCut=traffic.encounterTruck(s);
  assert.ok(Math.abs(atCut.x-s.pos[0])>traffic.TRUCK_HALF_LENGTH);
  assert.deepEqual(s.pos,before);
  assert.equal(cinema.canContinue(s.film),true);
  engine.continueFilm(s);
  assert.deepEqual(s.pos,map.START);
});

test('gaze uses rendered yaw, expires, and cues the unchecked side before camera reaction',()=>{
  for(const side of ['left','right']) {
    const s=session();
    engine.turnHead(s,side);
    assert.equal(state.observed(s,side),false);
    engine.observeView(s,0,0,.35);
    assert.equal(state.observed(s,side),false);
    look(s,side);
    assert.ok(state.observed(s,side));
    engine.navigate(s,[0,6.1]);
    tickFor(s,2.5);
    assert.equal(s.film?.kind,'near');
    assert.equal(s.film.side,side==='left'?1:-1);
    assert.ok(s.film.unchecked && s.film.holdView);
  }
  const expired=session();
  look(expired,'left');
  tickFor(expired,10.1);
  assert.equal(state.observed(expired,'left'),false);
});

test('two looks clear an empty crossing immediately without spawning trucks',()=>{
  const s=session();
  s.traffic=[-18,18];
  assert.equal(engine.targetAvailable(s,'door'),false);
  look(s,'left');look(s,'right');
  assert.ok(s.roadClear);
  assert.ok(s.traffic[0]<-18&&s.traffic[1]>18);
  engine.navigate(s,'arrival');
  tickFor(s,3.8);
  assert.ok(s.safety.crossed);
  assert.equal(engine.targetAvailable(s,'door'),true);
  assert.equal(s.film,null);
});

test('the warning tracks actual approaching trucks and mirrors on the return curb',()=>{
  for(const [from,side] of [[[0,16.45],'right'],[[0,6.36],'left']]) {
    const s=session(from);
    s.traffic=[27,20];
    look(s,'left');look(s,'right');
    assert.equal(s.roadClear,false);
    assert.equal(s.trafficSide,side);
    engine.turnHead(s,'center');
    s.time+=12;
    assert.ok(state.observed(s,'left')&&state.observed(s,'right'));
    for(let t=0;t<4&&!s.roadClear;t+=.02) engine.tick(s,.02,idle);
    assert.equal(s.roadClear,true);
    assert.equal(s.trafficSide,null);
    assert.ok(s.traffic[0]<-map.ROAD.width);
    s.traffic=[-20,-22];
    tickFor(s,.02);
    assert.equal(s.roadClear,false);
    assert.notEqual(s.trafficSide,side);
    engine.navigate(s,from[1]>map.ROAD.near?[0,5.75]:[0,16.62]);
    for(let t=0;t<2.6&&!s.film;t+=.02) engine.tick(s,.02,idle);
    assert.equal(s.film?.kind,'near');
    assert.equal(s.film.side,-1);
  }
});

test('a clear road survives centering, aligning inside the curb area and waiting mid-crossing in either direction',()=>{
  for(const [from,to] of [[[2.12,16.62],[.35,5.75]],[[2.12,6.22],[.35,16.62]]]) {
    const s=session(from);
    s.traffic=[-18,18];
    look(s,'left');look(s,'right');
    engine.turnHead(s,'center');
    assert.equal(s.roadClear,true);
    assert.ok(state.observed(s,'left')&&state.observed(s,'right'));
    engine.navigate(s,to);
    for(let t=0;t<4&&!map.onRoad(s.pos);t+=.02) engine.tick(s,.02,idle);
    assert.ok(map.onRoad(s.pos)&&map.inCrossing(s.pos));
    const onward=s.nav;
    s.nav=null;
    s.traffic=[-25,25];
    tickFor(s,.75);
    assert.equal(s.roadClear,true);
    s.nav=onward;
    tickFor(s,5);
    assert.deepEqual(s.pos,to);
    assert.equal(s.film,null);
    assert.equal(s.roadClear,false);
  }
});

test('leaving the curb clears both observations and the traffic warning',()=>{
  const s=session();
  s.traffic=[27,20];
  look(s,'left');look(s,'right');
  assert.ok(s.gaze.checked&&s.trafficSide);
  s.pos=[4,18];
  tickFor(s,.2);
  assert.equal(s.roadClear,false);
  assert.equal(s.trafficSide,null);
  assert.equal(state.observed(s,'left'),false);
  assert.equal(state.observed(s,'right'),false);
});

test('a crossing tap during a clear window stops at the curb if a real truck closes the gap',()=>{
  for(const destination of ['arrival',[.65,5.9]]) {
    const s=session();
    s.traffic=[-18,18];
    look(s,'left');look(s,'right');
    engine.navigate(s,destination);
    assert.equal(s.nav.clearAtStart,true);
    s.traffic=[24,18];
    tickFor(s,1);
    assert.ok(s.pos[1]>=map.ROAD.near);
    assert.equal(s.nav,null);
    assert.equal(s.film,null);
    assert.equal(s.trafficSide,'right');
    assert.equal(s.gaze.checked,true);
  }
});

test('unchecked zebra crossings walk into the truck lane before the incident from both curbs',()=>{
  for(const [point,destination,fromSouth] of [[[0,16.45],[0,5.75],true],[[0,6.36],[0,16.62],false]]) {
    for(const checked of [null,'left','right']) {
      const s=session(point);
      s.traffic=[-24,24];
      s.yaw=fromSouth?0:Math.PI;
      if(checked) look(s,checked);
      const direction=checked==='right'?(fromSouth?-1:1):(fromSouth?1:-1);
      const keys=checked==='left'?new Set(['w']):idle;
      if(keys===idle) engine.navigate(s,destination);
      let walkedInRoad=false;
      for(let t=0;t<3&&!s.film;t+=.02) {
        engine.tick(s,.02,keys);
        if(s.film) break;
        assert.equal(traffic.inTruckLane(s.pos,direction),false);
        if(map.onRoad(s.pos)) walkedInRoad=true;
      }
      assert.ok(walkedInRoad);
      assert.equal(s.film?.kind,'near');
      assert.ok(map.onRoad(s.pos)&&map.inCrossing(s.pos));
      assert.equal(s.film.holdView,Boolean(checked));
      assert.equal(s.film.side,direction);
      assert.ok(traffic.inTruckLane(s.pos,direction));
      assert.equal(s.film.curb,fromSouth?map.ROAD.near:map.ROAD.far);
      engine.endFilm(s);
      assert.equal(map.onRoad(s.pos),false);
    }
  }
});

test('manual gaze is counted from the early approach and survives centering and walking to both curbs',()=>{
  for(const [point,destination,heading] of [[[0,19.75],[0,5.75],0],[[0,3.05],[0,16.62],Math.PI]]) {
    const s=session(point);
    s.yaw=heading;
    s.traffic=[-20,20];
    assert.ok(state.usingCrossing(s));
    look(s,'left');look(s,'right');
    assert.ok(s.roadClear);
    engine.turnHead(s,'center');
    engine.navigate(s,destination);
    tickFor(s,5.5);
    assert.deepEqual(s.pos,destination);
    assert.equal(s.film,null);
  }
});

test('retreating to the starting curb discards a pending encounter',()=>{
  const s=session();
  look(s,'right');
  engine.navigate(s,[0,5.75]);
  tickFor(s,.8);
  assert.ok(s.crossingDanger&&map.onRoad(s.pos));
  engine.navigate(s,[0,16.45]);
  tickFor(s,1);
  assert.equal(s.crossingHeading,null);
  assert.equal(s.crossingDanger,null);
  assert.equal(state.observed(s,'right'),false);
});

test('a checked lane no longer triggers an incident once the real truck has passed',()=>{
  const s=session();
  s.traffic=[-20,-30];
  look(s,'left');look(s,'right');
  assert.equal(s.trafficSide,'left');
  engine.navigate(s,[0,5.75]);
  tickFor(s,.65);
  assert.ok(s.crossingDanger&&map.onRoad(s.pos));
  s.traffic=[-24,24];
  tickFor(s,3);
  assert.equal(s.film,null);
  assert.equal(s.safety.crossed,true);
});

test('all eight PPE combinations at both presses produce only the affected beats in order',()=>{
  for(const press of ['a','b']) for(let mask=0;mask<8;mask++) {
    const s=session([map.pressX[press],map.PRESS_Z+3.75]);
    prepare(s);
    s.pos=[map.pressX[press],map.PRESS_Z+3.75];
    s.safety.ppe=[['boots','sneakers'],['glasses','scratched'],['hearing','broken']].map((items,i)=>items[(mask>>i)&1]);
    s.safety.collectedPpe=s.safety.ppe.slice();
    s.safety.tagHeld=true;
    s.safety.inspected.a.front=true;
    const safety=structuredClone(s.safety), settings=structuredClone(s.settings);
    const expected=map.ppeOrder.filter((_,i)=>mask&(1<<i));
    tickFor(s,.14,new Set(['w']));
    if(!mask) {
      assert.equal(s.film,null);
      assert.equal(map.pressHazard(s.pos),press);
      continue;
    }
    assert.equal(s.film?.press,press);
    assert.deepEqual(s.film.hazards,expected);
    const seen=new Set();
    for(let frame=0;frame<400&&!cinema.canContinue(s.film);frame++) {
      const beat=cinema.ppeBeat(s.film);
      if(beat) seen.add(beat.slot);
      engine.tick(s,.02,idle);
    }
    assert.deepEqual([...seen],expected);
    assert.equal(cinema.filmStage(s),'ppe-black');
    engine.continueFilm(s);
    assert.equal(map.pressHazard(s.pos),null);
    assert.deepEqual(s.safety,safety);
    assert.deepEqual(s.settings,settings);
    tickFor(s,.3);
    assert.equal(s.film,null);
  }
});

test('missing PPE is treated as unsafe and checked before inspecting a press',()=>{
  const s=session();
  prepare(s);
  s.safety.ppe=['hearing'];
  engine.interact(s,'b-guard');
  assert.deepEqual(s.film.hazards,['feet','eyes']);
  assert.equal(s.film.footwear,'missing');
  assert.deepEqual(s.safety.inspected.b,{});
  engine.endFilm(s);
  s.safety.ppe=[];
  engine.navigate(s,[map.pressX.a,map.PRESS_Z+2.72]);
  tickFor(s,4);
  assert.deepEqual(s.film.hazards,map.ppeOrder);
});

test('the curb prompt follows the road-facing side after arriving',()=>{
  for(const [position,heading] of [[[0,5.75],0],[[0,16.62],Math.PI]]) {
    const s=session(position);
    s.yaw=heading;
    assert.equal(state.usingCrossing(s),false);
    s.yaw+=Math.PI;
    assert.equal(state.usingCrossing(s),true);
  }
});

test('damaged equipment can be replaced, and attaching a collected tag requires guard and STOP',()=>{
  const s=session();
  prepare(s);
  engine.gearAction(s,'scratched');
  assert.equal(state.equipped(s.safety),false);
  assert.ok(s.safety.ppe.includes('scratched'));
  engine.gearAction(s,'glasses');
  assert.ok(state.equipped(s.safety));
  completePress(s,'a');
  engine.interact(s,'tag');
  inspect(s,'b-tag');
  assert.equal(s.safety.tagged,false);
  assert.equal(s.safety.tagHeld,true);
  completePress(s,'b');
  assert.equal(s.safety.tagged,true);
  assert.equal(s.safety.tagHeld,false);
  assert.equal(s.safety.recorded.b.tagged,undefined);
  assert.equal(engine.targetAvailable(s,'b-reach'),false);
});

test('the cabinet reopens an equipment close-up even when the player is already next to it',()=>{
  const s=session(map.positions.boots.point);
  s.safety.door=true;
  for(let pass=0;pass<3;pass++) {
    engine.interact(s,'ppe');
    assert.equal(s.panel,null);
    engine.openNearby(s,'boots');
    assert.equal(s.panel,null);
    assert.equal(s.focus?.target,'boots');
    tickFor(s,.51);
    engine.gearAction(s,'boots');
    assert.equal(s.safety.ppe.includes('boots'),pass!==1);
    assert.deepEqual(s.safety.collectedPpe,['boots']);
  }
});

test('separate STOP and status events bracket the completed training cycle',()=>{
  const s=session();
  prepare(s);
  inspect(s,'b-stop');
  assert.deepEqual(s.safety.inspected.b,{});
  inspect(s,'a-status');
  assert.deepEqual(s.safety.inspected.a,{});
  for(const [, ,part] of state.checklist('a').slice(0,7)) inspect(s,'a-'+part);
  inspect(s,'a-start');
  inspect(s,'a-stop');
  assert.equal(s.safety.inspected.a.cycle,undefined);
  assert.equal(s.safety.inspected.a.stopFinal,undefined);
  inspect(s,'a-start');
  tickFor(s,3.6);
  assert.equal(s.pressMode,'cycled');
  inspect(s,'a-status');
  assert.equal(s.safety.inspected.a.statusFinal,undefined);
  inspect(s,'a-stop');
  inspect(s,'a-status');
  assert.equal(s.safety.inspected.a.statusFinal,true);
  assert.equal(state.nextStep(s.safety,'a'),undefined);
});

test('reaching requires confirmation and cancel preserves inspection progress',()=>{
  const s=session();
  prepare(s);
  completePress(s,'a');
  inspect(s,'b-stop');
  inspect(s,'b-reach');
  assert.equal(s.panel,'reach');
  assert.equal(s.film,null);
  engine.resolveReach(s,false);
  assert.equal(s.panel,null);
  assert.equal(s.film,null);
  assert.deepEqual(s.safety.inspected.b,{stopInitial:true});
  inspect(s,'b-reach');
  engine.resolveReach(s,true);
  assert.equal(s.film?.reason,'reach');
  engine.endFilm(s);
  assert.deepEqual(s.pos,map.PRESS);
  assert.deepEqual(s.safety.inspected.b,{stopInitial:true});
});

test('opening the attachment precedes audit; omissions require correction',()=>{
  const s=session();
  prepare(s);
  engine.interact(s,'tag');
  document(s,'b');
  assert.ok(state.recordIssues(s.safety).some(x=>x.page==='b'&&x.reason==='Not performed'));
  completePress(s,'a');
  completePress(s,'b');
  document(s,'a');
  engine.markRecord(s,'b','statusFinal',false);
  assert.ok(state.recordIssues(s.safety).some(x=>x.page==='b'&&x.reason==='Not recorded'));
  engine.mailDecision(s,'open');
  assert.equal(s.film?.kind,'incident');
  engine.endFilm(s);
  assert.equal(s.safety.mailDisposition,null);
  engine.mailDecision(s,'report');
  assert.equal(s.film?.kind,'audit');
  engine.endFilm(s);
  assert.deepEqual(s.pos,map.PRESS);
  assert.equal(s.safety.tagged,true);
  engine.reviewRecords(s);
  assert.equal(s.safety.reported,false);
  engine.markRecord(s,'b','statusFinal',true);
  for(const [key] of state.preparationRows) engine.markPreparation(s,key,true);
  engine.reviewRecords(s);
  assert.equal(s.panel,'ending');
  assert.deepEqual(state.recordIssues(s.safety),[]);
});

test('every placed indoor interaction point has a collision-free approach',()=>{
  for(const [target,definition] of Object.entries(map.positions)) {
    if(definition.point[1]>0) continue;
    assert.equal(map.solid(definition.point,true),false,target);
    assert.ok(map.route(map.PRESS,definition.point,true),target);
  }
});

test('guidance follows the clipboard order through every physical step',()=>{
  const s=session(map.PRESS);
  prepare(s);
  engine.interact(s,'tag');
  for(const press of ['a','b']) {
    assert.equal(state.checklist(press).length,10);
    for(const [key,,part] of state.checklist(press)) {
      assert.equal(state.objective(s),press+'-'+part);
      inspect(s,press+'-'+part);
      if(part==='start') tickFor(s,3.6);
      assert.equal(s.safety.inspected[press][key],true);
      assert.equal(s.safety.recorded[press][key],undefined);
    }
  }
  assert.equal(state.objective(s),'mail');
});

test('legacy press records reset while PPE and a collected tag survive migration',()=>{
  globalThis.localStorage={getItem:()=>JSON.stringify({checkpoint:'desk',safety:{
    ppe:['boots'],tagged:true,completed:true,reported:true,mailDisposition:'report',
    inspected:{a:{shutdown:true},b:{cycle:true}},recorded:{a:{shutdown:true},b:{cycle:true}},
  }})};
  try {
    const s=state.startSession();
    assert.deepEqual(s.pos,map.PRESS);
    assert.deepEqual(s.safety.ppe,['boots']);
    assert.deepEqual(s.safety.inspected,{a:{},b:{}});
    assert.deepEqual(s.safety.recorded,{a:{},b:{}});
    assert.equal(s.safety.tagHeld,true);
    assert.equal(s.safety.mailDisposition,'report');
    assert.match(s.notification,/Press exercises were updated/);
  } finally {delete globalThis.localStorage;}
});

test('floor routes stay on the starting bank to the curb and detour around indoor obstacles',()=>{
  const origin=[0,22.7], curb=[0,16];
  const guide=map.route(origin,curb,false);
  assert.deepEqual(guide.at(-1),curb);
  for(const [i,point] of guide.entries()) {
    assert.ok(point[1]>=map.ROAD.near);
    assert.ok(map.clearSegment(i?guide[i-1]:origin,point,false));
  }
  const indoor=[7.7,-7.1];
  const target=map.positions['a-front'].point;
  const route=map.route(indoor,target,true);
  for(const [i,point] of route.entries()) assert.ok(map.clearSegment(i?route[i-1]:indoor,point,true));
});

test('object approach stops within reach of the stand point and leaves room from the object',()=>{
  for(const target of ['clipboard','ppe','boots','a-guard','mail']) {
    const s=session([0,-2.25]);
    s.safety.door=true;
    s.safety.ppe=['boots','glasses','hearing'];
    const {point,anchor,reach}=map.positions[target];
    engine.openNearby(s,target);
    const end=s.nav.end;
    assert.ok(map.distance(end,point)<=reach && map.distance(end,point)>.05,target);
    assert.ok(map.distance(end,[anchor[0],anchor[2]])>1,target);
    assert.equal(map.solid(end,true),false,target);
    tickFor(s,10);
    assert.deepEqual(s.pos,end);
    engine.openNearby(s,target);
    assert.deepEqual(s.pos,end);
    assert.equal(s.nav,null);
  }
});

test('laptop W follows the marked crossing while the camera stays pointed along traffic',()=>{
  const s=session();
  look(s,'left');look(s,'right');
  for(let t=0;t<20&&!s.roadClear;t+=.02) engine.tick(s,.02,idle);
  assert.ok(s.roadClear);
  for(let t=0;t<3.4 && !s.safety.crossed;t+=.02) engine.tick(s,.02,new Set(['w']));
  assert.equal(s.film,null);
  assert.ok(s.safety.crossed);
  assert.ok(Math.abs(s.pos[0])<.001);
});

test('traffic rolls on approach and return crossing resets the permit and mirrors danger',()=>{
  const s=session([0,6.36]);
  s.safety.crossed=true;
  const initial=s.traffic.slice();
  tickFor(s,1);
  assert.notDeepEqual(initial,s.traffic);
  look(s,'left');
  engine.turnHead(s,'center');
  assert.ok(state.observed(s,'left'));
  engine.navigate(s,'arrival-south');
  tickFor(s,.5);
  assert.equal(s.film?.side,-1);
  engine.endFilm(s);
  assert.deepEqual(s.pos,[0,5.75]);
  assert.equal(state.observed(s,'left'),false);
  s.pos=[0,6.36];
  look(s,'left');look(s,'right');
  for(let t=0;t<20&&!s.roadClear;t+=.02) engine.tick(s,.02,idle);
  assert.ok(s.roadClear);
  engine.navigate(s,'arrival-south');
  tickFor(s,3.8);
  assert.ok(s.pos[1]>map.ROAD.near);
  assert.equal(s.roadClear,false);
  assert.equal(s.film,null);
  engine.navigate(s,'arrival');
  tickFor(s,.65);
  assert.equal(s.film?.kind,'near');
});

test('unique PPE is reusable and a spent tag stays attached across checkpoint reloads',()=>{
  let saved=null;
  globalThis.localStorage={getItem:()=>saved,setItem:(_,json)=>{saved=json;}};
  try {
    const s=session();
    s.pos=[...map.PRESS];
    s.checkpoint='press';
    engine.gearAction(s,'glasses');
    engine.gearAction(s,'glasses');
    assert.deepEqual(s.safety.ppe,[]);
    assert.deepEqual(s.safety.collectedPpe,['glasses']);
    engine.gearAction(s,'glasses');
    engine.gearAction(s,'scratched');
    assert.deepEqual(s.safety.ppe,['scratched']);
    assert.deepEqual(s.safety.collectedPpe,['glasses','scratched']);
    engine.gearAction(s,'glasses');
    engine.gearAction(s,'hearing');
    engine.gearAction(s,'boots');
    engine.interact(s,'tag');
    engine.interact(s,'tag');
    completePress(s,'a');
    completePress(s,'b');
    engine.interact(s,'tag');
    engine.gearAction(s,'scratched');
    const restored=state.startSession();
    assert.deepEqual(restored.pos,map.PRESS);
    assert.deepEqual(restored.safety.collectedPpe,['glasses','scratched','hearing','boots']);
    assert.deepEqual(restored.safety.ppe,['hearing','boots','scratched']);
    assert.equal(restored.safety.tagHeld,false);
    assert.ok(restored.safety.tagged);
    assert.ok(engine.targetAvailable(restored,'ppe'));
    assert.ok(engine.targetAvailable(restored,'scratched'));
    assert.equal(engine.targetAvailable(restored,'tag'),false);
  } finally { delete globalThis.localStorage; }
});

test('office beats wait for Continue, and clipboard records remain independent',()=>{
  const s=session();
  prepare(s);
  engine.markPreparation(s,'tag',true);
  assert.equal(state.preparationPerformed(s.safety,'tag'),false);
  assert.ok(state.recordIssues(s.safety).some(x=>x.page==='ppe'&&x.label.includes('tag')&&x.reason==='Not performed'));
  s.film={kind:'incident',time:0,beat:0};
  tickFor(s,20);
  assert.equal(s.film.beat,0);
  for(let beat=0;beat<4;beat++){
    assert.equal(s.film.beat,beat);
    engine.continueFilm(s);
  }
  assert.equal(s.film,null);
  assert.equal(s.panel,'mail');
  assert.deepEqual(s.pos,map.DESK);
});
