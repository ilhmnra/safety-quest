import assert from 'node:assert/strict';
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
function tickFor(s,seconds) {
  for(let t=0;t<seconds;t+=.02) engine.tick(s,.02,idle);
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
function inspectPress(s,press) {
  for(const part of ['status','front','rear','left','right','guard']) inspect(s,press+'-'+part);
}

test('off-stripe navigation remains possible; the truck stays in lane and cuts before contact',()=>{
  const s=session([5.8,18.5]);
  engine.navigate(s,[5.8,6]);
  assert.ok(s.nav);
  tickFor(s,1);
  assert.equal(s.film?.kind,'near');
  assert.equal(s.film.unchecked,false);
  const before=s.pos.slice();
  assert.ok(s.film.cut>3.3 && s.film.horn+cinema.ROAD_REACTION_DELAY<s.film.cut);
  while(s.film.time<s.film.cut) {
    const truck=traffic.truckMotion(s,s.film.side===1?0:1);
    assert.ok(truck.z-traffic.TRUCK_HALF_WIDTH>map.ROAD.far);
    assert.ok(truck.z+traffic.TRUCK_HALF_WIDTH<map.ROAD.near);
    assert.equal(traffic.roadOccupied(s,s.pos),false);
    engine.tick(s,.02,idle);
  }
  const atCut=traffic.truckMotion(s,s.film.side===1?0:1);
  assert.ok(Math.abs(atCut.x-s.pos[0])>traffic.TRUCK_HALF_LENGTH);
  engine.continueFilm(s);
  assert.ok(s.film);
  tickFor(s,10);
  assert.deepEqual(s.pos,before);
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
    tickFor(s,.5);
    assert.equal(s.film?.kind,'near');
    assert.equal(s.film.side,side==='left'?1:-1);
    assert.ok(s.film.unchecked && s.film.holdView);
  }
  const expired=session();
  look(expired,'left');
  tickFor(expired,10.1);
  assert.equal(state.observed(expired,'left'),false);
});

test('two looks release the crossing only after both trucks pass',()=>{
  const s=session();
  look(s,'left');look(s,'right');
  assert.ok(s.passage);
  assert.equal(s.roadClear,false);
  engine.navigate(s,'arrival');
  tickFor(s,.55);
  assert.ok(s.pos[1]>=map.ROAD.near);
  assert.equal(s.film,null);
  for(let t=0;t<20&&!s.roadClear;t+=.02) engine.tick(s,.02,idle);
  assert.ok(s.roadClear);
  engine.navigate(s,'arrival');
  tickFor(s,3.8);
  assert.ok(s.safety.crossed);
  assert.equal(s.film,null);
});

test('damaged equipment can be replaced, and attaching a collected tag requires guard and STOP',()=>{
  const s=session();
  prepare(s);
  engine.gearAction(s,'scratched');
  assert.equal(state.equipped(s.safety),false);
  assert.ok(s.safety.ppe.includes('scratched'));
  engine.gearAction(s,'glasses');
  assert.ok(state.equipped(s.safety));
  inspect(s,'a-guard');
  engine.interact(s,'a-stop');
  engine.interact(s,'a-tag');
  assert.equal(s.safety.tagged,false);
  engine.interact(s,'tag');
  assert.equal(s.safety.tagHeld,true);
  engine.interact(s,'a-tag');
  assert.equal(s.safety.tagged,true);
  assert.equal(s.safety.tagHeld,false);
  assert.equal(s.safety.recorded.a.tagged,undefined);
});

test('the cabinet reopens an equipment close-up even when the player is already next to it',()=>{
  const s=session(map.positions.boots.point);
  s.safety.door=true;
  for(let pass=0;pass<3;pass++) {
    s.panel='cabinet';
    engine.openNearby(s,'boots');
    assert.equal(s.panel,null);
    assert.equal(s.focus?.target,'boots');
    tickFor(s,.51);
    engine.gearAction(s,'boots');
    assert.equal(s.safety.ppe.includes('boots'),pass!==1);
    assert.deepEqual(s.safety.collectedPpe,['boots']);
  }
});

test('unsafe starts and reaching preserve the shift; shutdown requires a full cycle',()=>{
  const s=session();
  prepare(s);
  engine.interact(s,'b-start');
  assert.equal(s.film?.kind,'failure');
  engine.endFilm(s);
  inspectPress(s,'b');
  engine.interact(s,'b-start');
  engine.interact(s,'b-stop');
  assert.equal(s.safety.completed,false);
  engine.interact(s,'b-start');
  tickFor(s,3.6);
  assert.equal(s.pressMode,'cycled');
  engine.interact(s,'b-stop');
  assert.equal(s.safety.completed,true);
  engine.interact(s,'a-start');
  assert.equal(s.stoppedA,false);
  engine.interact(s,'a-reach');
  assert.equal(s.film?.reason,'reach');
  engine.endFilm(s);
  assert.equal(s.safety.completed,true);
  assert.deepEqual(s.pos,map.PRESS);
});

test('opening the attachment precedes audit; claims and omissions require correction',()=>{
  const s=session();
  prepare(s);
  engine.interact(s,'tag');
  inspect(s,'a-guard');
  engine.interact(s,'a-stop');
  engine.interact(s,'a-tag');
  inspectPress(s,'b');
  engine.interact(s,'b-start');
  tickFor(s,3.6);
  engine.interact(s,'b-stop');
  document(s,'a');
  document(s,'b');
  engine.markRecord(s,'b','shutdown',false);
  assert.ok(state.recordIssues(s.safety).some(x=>x.page==='a'&&x.reason==='Not performed'));
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
  assert.equal(s.safety.completed,true);
  engine.reviewRecords(s);
  assert.equal(s.film,null);
  assert.equal(s.safety.reported,false);
  inspectPress(s,'a');
  engine.markRecord(s,'b','shutdown',true);
  for(const id of s.safety.ppe) inspect(s,id);
  for(const [key] of state.preparationRows) engine.markPreparation(s,key,true);
  engine.reviewRecords(s);
  assert.equal(s.panel,'ending');
  assert.equal(s.safety.reported,true);
  assert.deepEqual(state.recordIssues(s.safety),[]);
});


test('every placed indoor interaction point has a collision-free approach',()=>{
  for(const [target,definition] of Object.entries(map.positions)) {
    if(definition.point[1]>0) continue;
    assert.equal(map.solid(definition.point,true),false,target);
    assert.ok(map.route(map.PRESS,definition.point,true),target);
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
    engine.interact(s,'tag');
    engine.interact(s,'tag');
    inspect(s,'a-guard');
    engine.interact(s,'a-stop');
    engine.interact(s,'a-tag');
    engine.interact(s,'tag');
    const restored=state.startSession();
    assert.deepEqual(restored.pos,map.PRESS);
    assert.deepEqual(restored.safety.collectedPpe,['glasses','scratched']);
    assert.deepEqual(restored.safety.ppe,['scratched']);
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
  engine.continueFilm(s);
  assert.equal(s.film.beat,0);
  for(let beat=0;beat<4;beat++){
    tickFor(s,20);
    assert.equal(s.film.beat,beat);
    engine.continueFilm(s);
  }
  assert.equal(s.film,null);
  assert.equal(s.panel,'mail');
  assert.deepEqual(s.pos,map.DESK);
});
