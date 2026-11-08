export type Point = [number, number];
export type Rect = [number, number, number, number];
export type Target = 'crossing' | 'arrival' | 'door' | 'ppe' | 'checklist' | 'mail' | 'a' | 'al' | 'ar' | 'b' | 'bl' | 'br';

export const START: Point = [0, 22.7];
export const PRESS: Point = [-4.8, -7.2];
export const DESK: Point = [7.6, -9.65];
export const ROAD = { near: 15.55, far: 7.25, width: 1.85 };
export const positions: Record<Target, { point: Point; anchor: [number, number, number]; name: string; reach: number }> = {
  crossing: { point: [0, 16.55], anchor: [0, 1.02, 15.8], name: 'Zebra crossing', reach: 2.5 },
  arrival: { point: [0, 5.75], anchor: [0, 1.25, 6.3], name: 'Cross to the forecourt', reach: 1 },
  door: { point: [0, 1.45], anchor: [0, 2.05, .24], name: 'Training center entrance', reach: 2.15 },
  ppe: { point: [6.9, -2.35], anchor: [6.9, 2.28, -4.85], name: 'PPE station', reach: 1.55 },
  checklist: { point: [-8.5, -4.6], anchor: [-8.5, 2.45, -6.1], name: 'Safety checklist', reach: 1.65 },
  a: { point: [-7.65, -8.95], anchor: [-7.65, 2.65, -11.55], name: 'Press A controls', reach: 1.35 },
  al: { point: [-9.55, -12.05], anchor: [-9.15, 1.8, -11.95], name: 'Press A left side', reach: 1.4 },
  ar: { point: [-5.75, -12.05], anchor: [-6.15, 1.8, -11.95], name: 'Press A right side', reach: 1.4 },
  b: { point: [-1.95, -8.95], anchor: [-1.95, 2.65, -11.55], name: 'Press B controls', reach: 1.35 },
  bl: { point: [-3.85, -12.05], anchor: [-3.45, 1.8, -11.95], name: 'Press B left side', reach: 1.4 },
  br: { point: [-.05, -12.05], anchor: [-.45, 1.8, -11.95], name: 'Press B right side', reach: 1.4 },
  mail: { point: DESK, anchor: [7.6, 2.1, -11.15], name: 'Workstation', reach: 1.45 },
};

export const walls: Rect[] = [
  [-12, -1.65, -.36, .39], [1.65, 12, -.36, .39],
  [-12, -11.55, -19.4, 0], [11.55, 12, -19.4, 0],
  [-12, 6.15, -19.75, -19.25], [8.7, 12, -19.75, -19.25],
  [3.7, 4.15, -28, -19.4], [11.55, 12, -28, -19.4], [3.7, 12, -28.3, -27.85],
];

export const props: Rect[] = [
  [-9.02,-6.28,-13.45,-10.98], [-3.32,-.58,-13.45,-10.98],
  [5.35,8.45,-5.75,-4.66], [-10.27,-6.74,-6.55,-5.88],
  [5.84,9.32,-12.15,-10.68], [10.05,11.52,-16.9,-13.55],
  [-11.55,-9.75,-18.6,-15.1], [-5.9,1.05,-18.7,-17.65], [8.96,11.1,-18.65,-17.68],
  [5.7,10.8,-26.9,-25.05], [4.05,5.15,-24.1,-21.5],
  [-20,-15.3,1.75,4.55], [14.15,18.35,2.35,5.45], [18.85,22.6,1.6,4.6],
  [-7.4,-3.8,19.6,21.75], [3.9,7.5,19.65,21.75],
  [-12,-9.2,17.15,19.6], [6.4,9.8,2.15,3.3], [-9.8,-6.4,2.15,3.3],
  [-24,-3.2,24.9,25.25], [3.2,24,24.9,25.25],
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
  return Math.abs(x)>23.7 || z>26.6 || z< -27.55 ||
    walls.some(rect => inRect(p,rect)) || props.some(rect => inRect(p,rect)) ||
    (!doorOpen && inRect(p,doorBarrier));
}

export function allowed(p: Point, doorOpen: boolean, cleared: boolean) {
  return !solid(p,doorOpen) && (!onRoad(p) || (cleared && inCrossing(p)));
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

export function route(from: Point, to: Point, doorOpen: boolean, cleared: boolean): Point[] | null {
  const pass=(p:Point)=>allowed(p,doorOpen,cleared);
  const solidRects=doorOpen?[...walls,...props]:[...walls,...props,doorBarrier];
  const blocked:Rect[]=solidRects.map(([x0,x1,z0,z1])=>[x0-pad,x1+pad,z0-pad,z1+pad]);
  if(cleared) blocked.push([-24,-ROAD.width,ROAD.far,ROAD.near],[ROAD.width,24,ROAD.far,ROAD.near]);
  else blocked.push([-24,24,ROAD.far,ROAD.near]);
  const lineClear=(a:Point,b:Point)=>pass(b) && !blocked.some(rect=>intersects(a,b,rect));
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

