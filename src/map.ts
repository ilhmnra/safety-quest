export type Point = [number, number];
export type Vec = [number, number, number];
export type Rect = [number, number, number, number];
export const pressParts = ['front','rear','left','right','guard','status','start','stop','tag','reach'] as const;
export type Part = typeof pressParts[number];
export type Press = 'a' | 'b';
export const ppeOrder=['feet','eyes','ears'] as const;
export type PpeSlot=typeof ppeOrder[number];

export const gear = {
  glasses: {name:'Safety glasses', slot:'eyes', sound:true, anchor:[5.94,1.94,-4.36], detail:'Clear lenses and an intact frame.'},
  scratched: {name:'Scratched safety glasses', slot:'eyes', sound:false, anchor:[5.94,1.19,-4.36], detail:'A deep scratch crosses the lens. Return these and choose a clear pair.'},
  hearing: {name:'Hearing protection', slot:'ears', sound:true, anchor:[6.9,1.96,-4.36], detail:'The band is intact and both seals are present.'},
  broken: {name:'Damaged hearing protection', slot:'ears', sound:false, anchor:[6.9,1.23,-4.36], detail:'The band is split and a cushion is missing. Choose the intact defenders.'},
  boots: {name:'Safety boots', slot:'feet', sound:true, anchor:[7.86,1.94,-4.36], detail:'The sturdy pair has reinforced toes and intact soles.'},
  sneakers: {name:'Canvas shoes', slot:'feet', sound:false, anchor:[7.86,1.17,-4.36], detail:'Soft canvas shoes lack reinforced toes. The training bay requires safety footwear.'},
} satisfies Record<string,{name:string;slot:PpeSlot;sound:boolean;anchor:Vec;detail:string}>;
export type Gear = keyof typeof gear;
export type Target = 'crossing' | 'crossing-north' | 'arrival' | 'arrival-south' | 'door' | 'ppe' | 'clipboard' | 'tag' | 'mail' | Gear | `${Press}-${Part}`;

export const START: Point = [0, 22.7];
export const PRESS: Point = [-4.8, -7.2];
export const DESK: Point = [7.6, -9.65];
export const ROAD = { near: 15.55, far: 7.25, width: 1.85, lanes: [13.7,9.2] as const };
export const WALK_SPEED=3.3;
export const PREP_TABLE:Point=[4.55,-4.27];
export const PRESS_Z = -12.18;
export const pressX: Record<Press,number> = {a:-1.95,b:-7.65};
export function pressHazard([x,z]:Point):Press|null {
  if(z<PRESS_Z-3.12 || z>PRESS_Z+3.52) return null;
  const press=x<(pressX.a+pressX.b)/2?'b':'a';
  return Math.abs(x-pressX[press])<=2.95?press:null;
}
type Destination = { point:Point; anchor:Vec; name:string; reach:number; hit?:Vec };
export const positions = {
  crossing: {point:[0,16.45],anchor:[0,1.02,15.8],name:'Zebra crossing',reach:.45,hit:[3.5,1.5,.4]},
  'crossing-north': {point:[0,6.36],anchor:[0,1.02,7.07],name:'Return crossing',reach:.45,hit:[3.5,1.5,.4]},
  'arrival-south': {point:[0,16.62],anchor:[0,1.25,16.25],name:'Far curb toward arrival',reach:.5,hit:[2.8,1.5,.4]},
  arrival: {point:[0,5.75],anchor:[0,1.25,6.3],name:'Cross the road',reach:.5,hit:[2.8,1.5,.4]},
  door: {point:[0,1.45],anchor:[0,2.05,.24],name:'Training center entrance',reach:1.5,hit:[3.5,2.85,.8]},
  ppe: {point:[6.9,-1.04],anchor:[6.9,2.47,-4.58],name:'PPE station',reach:.24,hit:[2.8,.38,.25]},
  clipboard: {point:[PREP_TABLE[0],-2.72],anchor:[PREP_TABLE[0],1.17,PREP_TABLE[1]],name:'Take clipboard',reach:.62,hit:[.5,.55,.46]},
  tag: {point:[8.78,-2.92],anchor:[8.78,1.74,-4.41],name:'Take out-of-service tag',reach:.65,hit:[.46,.49,.3]},
  mail: {point:DESK,anchor:[7.6,2.1,-11.15],name:'Workstation',reach:1.45,hit:[2.7,1.95,.83]},
} as Record<Target,Destination>;

for(const [id,item] of Object.entries(gear)) {
  positions[id as Gear]={point:[item.anchor[0],-2.88],anchor:item.anchor,name:item.name,reach:1.8,hit:[.65,.51,.44]};
}
const partLabels: Record<Part,string> = {
  front:'Front housing',rear:'Rear panel',left:'Left frame',right:'Right frame',guard:'Tooling guard',
  status:'Status display',start:'START',stop:'STOP',tag:'Tag hook',reach:'Lodged offcut',
};
const parts:Record<Part,{point:Point; anchor:Vec; hit:Vec}> = {
  front:{point:[0,2.65],anchor:[-.48,2.95,1.24],hit:[.8,.42,.23]},
  rear:{point:[0,-2.48],anchor:[0,2.08,-1.13],hit:[.8,.65,.32]},
  left:{point:[-2.46,0],anchor:[-1.2,2.1,0],hit:[.29,.68,.65]},
  right:{point:[2.46,0],anchor:[1.2,2.1,0],hit:[.29,.68,.65]},
  guard:{point:[-.34,2.59],anchor:[-.26,1.96,.83],hit:[.44,.39,.27]},
  status:{point:[.79,2.55],anchor:[.86,2.34,1.18],hit:[.54,.27,.19]},
  start:{point:[.8,2.52],anchor:[.91,1.81,1.23],hit:[.32,.26,.24]},
  stop:{point:[.8,2.52],anchor:[.91,1.33,1.24],hit:[.35,.28,.24]},
  tag:{point:[-.92,2.58],anchor:[-.95,1.35,1.24],hit:[.39,.34,.24]},
  reach:{point:[.05,2.49],anchor:[.32,1.44,.83],hit:[.36,.31,.28]},
};
for(const press of ['a','b'] as const) {
  for(const part of pressParts) {
    if(press==='a' && (part==='tag'||part==='reach') || press==='b' && part==='start') continue;
    const {point,anchor,hit}=parts[part];
    positions[`${press}-${part}`]={
      point:[pressX[press]+point[0],PRESS_Z+point[1]],
      anchor:press==='b'&&part==='guard'?[pressX.b+.47,1.72,PRESS_Z+.84]:
        [pressX[press]+anchor[0],anchor[1],PRESS_Z+anchor[2]],
      name:`Press ${press.toUpperCase()} · ${partLabels[part]}`,
      reach:part==='front'?1.0:.6,hit,
    };
  }
}
export function machinePart(target:Target): [Press,Part] | null {
  return target.startsWith('a-')||target.startsWith('b-') ? target.split('-') as [Press,Part] : null;
}
export const isGear = (target:Target): target is Gear => Object.hasOwn(gear,target);


export const walls: Rect[] = [
  [-12, -1.65, -.36, .39], [1.65, 12, -.36, .39],
  [-12, -11.55, -19.4, 0], [11.55, 12, -19.4, 0],
  [-12, 12, -19.75, -19.25],
];

export const props: Rect[] = [
  [-9.02,-6.28,-13.45,-10.98], [-3.32,-.58,-13.45,-10.98],
  [5.35,8.45,-5.75,-4.66], [PREP_TABLE[0]-.54,PREP_TABLE[0]+.54,PREP_TABLE[1]-.36,PREP_TABLE[1]+.36],
  [5.84,9.32,-12.15,-10.68], [10.05,11.52,-16.9,-13.55],
  [-5.9,1.05,-18.7,-17.65], [8.96,11.1,-18.65,-17.68],
  [-20,-15.3,1.75,4.55], [14.15,18.35,2.35,5.45], [18.85,22.6,1.6,4.6],
  [-7.4,-3.8,19.6,21.75], [3.9,7.5,19.65,21.75],
  [-12,-9.2,17.15,19.6], [6.4,9.8,2.15,3.3], [-9.8,-6.4,2.15,3.3],
  [-24.5,24.5,24.85,25.4],
  [-24.2,-23.15,-19.5,25.4], [23.15,24.2,-19.5,25.4],
  [-22,-21.55,-2,7.15], [22,22.45,-2,7.15],
  [-5.12,-4.76,16.64,17.04], [4.76,5.12,16.64,17.04],
  [-5.12,-4.76,6.25,6.65], [4.76,5.12,6.25,6.65],
  [-2.68,-2.22,15.98,16.54],
];

export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const onRoad = ([, z]: Point) => z < ROAD.near && z > ROAD.far;
export const inCrossing = ([x]: Point) => Math.abs(x) < ROAD.width;
const pad = .255;
const inRect = ([x,z]: Point, [x0,x1,z0,z1]: Rect) => x > x0-pad && x < x1+pad && z > z0-pad && z < z1+pad;
const doorBarrier: Rect = [-1.7,1.7,-.28,.4];

export function solid(p: Point, doorOpen: boolean) {
  const [x,z] = p;
  return Math.abs(x)>23.7 || z>26.6 || z< -19.24 ||
    walls.some(rect => inRect(p,rect)) || props.some(rect => inRect(p,rect)) ||
    (!doorOpen && inRect(p,doorBarrier));
}

const step = .5, cols = 97, rows = 111;
const nodeAt = (p: Point) => Math.max(0,Math.min(cols-1,Math.round((p[0]+24)/step))) +
  Math.max(0,Math.min(rows-1,Math.round((p[1]+28)/step)))*cols;
const at = (i: number): Point => [(i % cols)*step-24, Math.floor(i/cols)*step-28];

function intersects(a: Point, b: Point, [x0,x1,z0,z1]: Rect) {
  let entry=0, exit=1;
  for (const [start,end,min,max] of [[a[0],b[0],x0,x1],[a[1],b[1],z0,z1]]) {
    const delta=end-start;
    if(delta===0) {
      if(start<=min || start>=max) return false;
      continue;
    }
    const first=(min-start)/delta, last=(max-start)/delta;
    entry=Math.max(entry,Math.min(first,last));
    exit=Math.min(exit,Math.max(first,last));
    if(entry>=exit) return false;
  }
  return true;
}

const expandRect=([x0,x1,z0,z1]:Rect):Rect=>[x0-pad,x1+pad,z0-pad,z1+pad];
const openRects=[...walls,...props].map(expandRect);
const closedRects=[...openRects,expandRect(doorBarrier)];
export function clearSegment(a:Point,b:Point,doorOpen:boolean) {
  return !solid(b,doorOpen)&&!(doorOpen?openRects:closedRects).some(rect=>intersects(a,b,rect));
}

export function route(from: Point, to: Point, doorOpen: boolean): Point[] | null {
  const pass=(p:Point)=>!solid(p,doorOpen);
  const lineClear=(a:Point,b:Point)=>clearSegment(a,b,doorOpen);
  if (!pass(to)) return null;
  if (lineClear(from,to)) return [to];
  const near = (p: Point, reverse = false) => {
    const center = nodeAt(p);
    const neighbors = [center,center-1,center+1,center-cols,center+cols,center-cols-1,center-cols+1,center+cols-1,center+cols+1];
    return neighbors.filter(i => i>=0 && i<cols*rows && pass(at(i)) && (reverse ? lineClear(at(i),p) : lineClear(p,at(i))))
      .sort((a,b)=>distance(p,at(a))-distance(p,at(b)))[0];
  };
  const start = near(from), goal = near(to,true);
  if (start === undefined || goal === undefined) return null;
  const candidates = [start], open = new Set(candidates), closed = new Set<number>(), parents = new Map<number,number>();
  const costs = new Map([[start,0]]);
  const heuristic = (i: number) => distance(at(i),at(goal));
  while (candidates.length) {
    let best=0;
    for (let j=1;j<candidates.length;j++) {
      const a=candidates[j], b=candidates[best];
      if (costs.get(a)!+heuristic(a) < costs.get(b)!+heuristic(b)) best=j;
    }
    const current=candidates.splice(best,1)[0];
    open.delete(current);
    if (current===goal) {
      const path: Point[]=[to];
      let cursor: number | undefined=current;
      while (cursor !== undefined) { path.unshift(at(cursor)); cursor=parents.get(cursor); }
      const trimmed: Point[]=[];
      let origin=from;
      while (path.length) {
        let next=path.length-1;
        while (next>0 && !lineClear(origin,path[next])) next--;
        origin=path[next];
        trimmed.push(origin);
        path.splice(0,next+1);
      }
      return trimmed;
    }
    closed.add(current);
    const p=at(current);
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      if ((current%cols)+dx<0 || (current%cols)+dx>=cols) continue;
      const i=current+dx+dz*cols;
      if (i<0 || i>=cols*rows || closed.has(i) || !lineClear(p,at(i))) continue;
      const cost=costs.get(current)!+Math.hypot(dx,dz)*step;
      if (cost >= (costs.get(i) ?? Infinity)) continue;
      parents.set(i,current);
      costs.set(i,cost);
      if (!open.has(i)) { candidates.push(i); open.add(i); }
    }
  }
  return null;
}
