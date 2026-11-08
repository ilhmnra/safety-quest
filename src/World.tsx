import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as T from 'three';
import { architecture, press, truck, person, type Box, ink, steel, amber, lamp, alert, tealLamp, cream, slate } from './models';
import { distance, positions, ROAD, walls, type Point, type Target } from './map';
import { checklist, equipped, hasMail, objective, type Session } from './state';
import { navigate, nearest, say, tick, turnTo } from './engine';

export type Markers = Partial<Record<Target,HTMLButtonElement>>;
type Props = { session:Session; keys:Set<string>; markers:MutableRefObject<Markers>; update:()=>void; touch:boolean };
const cube=new T.BoxGeometry();
const temp=new T.Object3D();
const mats=new Map<string,T.Material>();
function material(color:string) {
  let mat=mats.get(color);
  if(!mat) {
    mat=color.startsWith('!') ? new T.MeshBasicMaterial({color:color.slice(1)}) : new T.MeshLambertMaterial({color});
    mats.set(color,mat);
  }
  return mat;
}
const Batch=memo(function Batch({boxes, shadows=true}:{boxes:Box[];shadows?:boolean}) {
  const groups=useMemo(()=>{
    const result=new Map<string,Box[]>();
    for(const box of boxes) {
      if(!result.has(box[6])) result.set(box[6],[]);
      result.get(box[6])!.push(box);
    }
    return [...result.entries()];
  },[boxes]);
  return <>{groups.map(([c, group])=><instancedMesh key={c} args={[cube,material(c),group.length]} castShadow={shadows && !c.startsWith('!')} receiveShadow={!c.startsWith('!')} ref={m=>{
    if(!m) return;
    group.forEach(([x,y,z,w,h,d,,ry,rz],index)=>{
      temp.position.set(x,y,z); temp.scale.set(w,h,d); temp.rotation.set(0,ry??0,rz??0); temp.updateMatrix();
      m.setMatrixAt(index,temp.matrix);
    });
    m.instanceMatrix.needsUpdate=true;
    m.computeBoundingSphere();
  }}/>)}</>;
});
const modelA=press(true), modelB=press(false);
const modelTruckA=truck('#7a8d83'), modelTruckB=truck('#5e7776');
const ceo=person('#394b51','#d7a67f','#393938'), tech=person('#557b72','#af795b','#383c39',true);
const skyVertex='varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const skyFragment=`
varying vec3 v;
void main(){
 vec3 d=normalize(v);
 vec3 sun=normalize(vec3(.18,.39,-.90));
 vec3 c=mix(vec3(.74,.78,.68),vec3(.28,.51,.57),smoothstep(-.065,.71,d.y));
 c=mix(c,vec3(.89,.80,.61),pow(max(0.,dot(d,sun)),10.)*.63);
 c+=vec3(.24,.18,.09)*pow(max(0.,dot(d,sun)),125.);
 c=mix(c,vec3(1.,.87,.61),smoothstep(.9990,.99945,dot(d,sun)));
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

function signTexture(title:string,subtitle:string,kind:string) {
  const c=document.createElement('canvas');
  c.width=kind==='main'?1536:768;
  c.height=kind==='board'?452:kind==='poster'?544:kind==='main'?180:196;
  const g=c.getContext('2d')!;
  const W=c.width,H=c.height;
  g.fillStyle=kind==='board'?'#dedbc5':kind==='poster'?'#e6ddbf':'#203b40';
  g.fillRect(0,0,W,H);
  g.fillStyle=kind==='board'?'#30534f':'#e7ab56';
  if(kind==='main') {
    g.fillRect(30,26,6,124); g.fillRect(W-36,26,6,124);
    g.beginPath();g.moveTo(103,45);g.lineTo(143,113);g.lineTo(63,113);g.closePath();g.fill();
    g.fillStyle='#203b40';g.fillRect(99,69,8,23);g.fillRect(99,97,8,8);
    g.fillStyle='#efddb0';g.font='900 80px "Arial Narrow", Arial, sans-serif';g.fillText(title,171,111,W-200);
    g.fillStyle='#c0ad7f';g.font='bold 24px monospace';g.fillText(subtitle,176,148,W-220);
  } else if(kind==='poster') {
    g.fillRect(0,0,W,20);g.fillRect(0,H-20,W,20);
    g.fillStyle='#2b4c4e';g.font='900 61px Arial';g.fillText(title,48,104,W-96);
    g.fillStyle='#a66f3b';g.fillRect(48,132,W-96,5);
    g.font='bold 37px monospace';subtitle.split('|').forEach((line,i)=>{
      g.fillStyle='#526d62';g.fillText('0'+(i+1),49,214+i*85);
      g.fillStyle='#263b3d';g.fillText(line,135,214+i*85,W-178);
    });
  } else if(kind==='board') {
    g.fillRect(0,0,W,80);
    g.fillStyle='#f0e3bf';g.font='bold 39px Arial';g.fillText(title,30,54);
    const items=subtitle.split('|');
    items.forEach((item,i)=>{
      const checked=item.startsWith('1');
      g.strokeStyle='#5f7867';g.lineWidth=2;g.strokeRect(29,112+i*43,24,24);
      if(checked) {
        g.fillStyle='#47745c';g.fillRect(32,115+i*43,18,18);
        g.strokeStyle='#e9e4cc';g.beginPath();g.moveTo(35,124+i*43);g.lineTo(39,129+i*43);g.lineTo(47,119+i*43);g.stroke();
      }
      g.fillStyle='#263d3d';g.font='bold 24px Arial';g.fillText(item.slice(1),69,133+i*43,W-102);
    });
  } else {
    g.fillRect(16,22,8,H-44);
    g.fillStyle='#f1e4bd';g.font='bold 68px "Arial Narrow", Arial';g.fillText(title,55,96,W-95);
    g.fillStyle='#adbdab';g.font='bold 31px monospace';g.fillText(subtitle,56,151,W-95);
  }
  const texture=new T.CanvasTexture(c);
  texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
function Sign({position,w,h,title,sub='',kind='sign',rotation=0}:{position:[number,number,number];w:number;h:number;title:string;sub?:string;kind?:string;rotation?:number}) {
  const tex=useMemo(()=>signTexture(title,sub,kind),[title,sub,kind]);
  useEffect(()=>()=>tex.dispose(),[tex]);
  return <mesh position={position} rotation-y={rotation}><planeGeometry args={[w,h]}/><meshBasicMaterial map={tex} toneMapped={false}/></mesh>;
}
function GlowingBox({size,color,position}:{size:[number,number,number];color:string;position:[number,number,number]}) {
  return <mesh position={position} geometry={cube} scale={size} material={material(color)}/>;
}
function Door({s}:{s:Session}) {
  const left=useRef<T.Group>(null), right=useRef<T.Group>(null);
  useFrame((_,dt)=>{
    const x=T.MathUtils.damp(Math.abs(left.current!.position.x),s.safety.door?2.47:.823,8,dt);
    left.current!.position.x=-x; right.current!.position.x=x;
  });
  return <>{[-1,1].map(side=><group key={side} ref={side===-1?left:right} position={[side*.823,0,.51]}>
    <GlowingBox position={[0,1.324,0]} size={[1.63,2.64,.15]} color="#384f54"/>
    <GlowingBox position={[0,1.76,.082]} size={[1.36,1.18,.038]} color="#7caaab"/>
    <GlowingBox position={[0,2.14,.11]} size={[1.32,.27,.025]} color="#afc2b0"/>
    <GlowingBox position={[0,1.29,.114]} size={[1.43,.098,.048]} color={slate}/>
    <GlowingBox position={[0,.3,.102]} size={[1.43,.19,.057]} color={steel}/>
    <GlowingBox position={[-side*.58,1.12,.137]} size={[.057,.34,.087]} color={cream}/>
  </group>)}</>;
}

function truckPositions(s:Session,clock:number): [number,number,number,boolean][] {
  const f=s.film;
  if(f?.kind==='near') return [[s.pos[0]+f.side!*(28-16.05*f.time),f.lane!,f.side!,f.time<1.61]];
  if(f?.kind==='both') return [
    [25-f.time*15.7,13.7,1,f.time<3.18],
    [-27+(f.time-2.77)*16.7,9.2,-1,f.time>=2.77],
  ];
  if(s.roadClear && !s.safety.crossed) {
    return [[23+((clock*4.7)%16),13.7,1,true],[-23-((clock*4.4+8)%16),9.2,-1,true]];
  }
  return [[s.traffic[0],13.7,1,true],[s.traffic[1],9.2,-1,true]];
}
function Trucks({s,high}:{s:Session;high:boolean}) {
  const one=useRef<T.Group>(null),two=useRef<T.Group>(null), light=useRef<T.PointLight>(null);
  useFrame(({clock})=>{
    const transforms=truckPositions(s,clock.elapsedTime);
    [one,two].forEach((truck,i)=>{
      const g=truck.current!, p=transforms[i];
      g.visible=!!p?.[3];
      if(!p) return;
      g.position.set(p[0],-.05,p[1]);
      g.rotation.y=p[2]===1?Math.PI:0;
    });
    if(light.current) light.current.intensity=s.film?.kind==='near'&&s.film.time<1.6?37:0;
  });
  return <>
    <group ref={one} position={[25,-.05,13.7]}><Batch boxes={modelTruckA}/><Sign position={[-.7,1.69,.991]} w={2.31} h={.59} title="WORKS LOGISTICS" sub="FREIGHT 01" />{high&&<pointLight ref={light} position={[3.1,1.09,0]} distance={9} color="#ffdc9a" intensity={0}/>}</group>
    <group ref={two} position={[-29,-.05,9.2]}><Batch boxes={modelTruckB}/><Sign position={[-.7,1.69,.991]} w={2.31} h={.59} title="WORKS LOGISTICS" sub="FREIGHT 02" /></group>
  </>;
}
function Machines({s}:{s:Session}) {
  const ram=useRef<T.Group>(null), beacon=useRef<T.Mesh>(null);
  useFrame(({clock})=>{
    const t=s.pressTime;
    const stroke=s.pressMode==='cycling' ? Math.sin(Math.PI*T.MathUtils.clamp((t-.37)/2.45,0,1))**2 : 0;
    ram.current!.position.y=-stroke*.63;
    const m=beacon.current!;
    m.material=material(s.safety.tagged || (!s.stoppedA && Math.sin(clock.elapsedTime*13)>.1)?alert:'#87724d');
  });
  return <>{['a','b'].map((id,i)=><group key={id} position={[i===0?-7.65:-1.95,.105,-12.18]}>
    <Batch boxes={i===0?modelA:modelB}/>
    <Sign position={[0,3.117,1.22]} w={1.51} h={.385} title={i===0?'PRESS A':'PRESS B'} sub={i===0?'MECHANICAL / 01':'TRAINING / 02'}/>
    {i===0 ? <mesh ref={beacon} geometry={cube} position={[.8,3.91,.36]} scale={[.22,.1,.19]} material={material('#87724d')}/> :
    <GlowingBox position={[.8,3.91,.36]} size={[.22,.1,.19]} color={s.pressMode==='cycling'?lamp:tealLamp}/>}
    <group ref={i===1?ram:undefined}>
      <GlowingBox position={[0,2.15,.16]} size={[.31,.51,.36]} color="#a3a998"/>
      <GlowingBox position={[0,1.896,.16]} size={[.65,.16,.58]} color={slate}/>
      <GlowingBox position={[0,1.79,.16]} size={[.44,.086,.41]} color="#b8b7a4"/>
    </group>
    {i===0 && s.safety.tagged && <group position={[.97,1.36,1.39]} rotation-z={-.17}>
      <GlowingBox position={[0,0,0]} size={[.6,.43,.045]} color="#b35641"/>
      <Sign position={[0,0,.027]} w={.56} h={.31} title="OUT OF SERVICE" sub="DO NOT OPERATE"/>
    </group>}
  </group>)}</>;
}

function Office({s}:{s:Session}) {
  const arm=useRef<T.Group>(null), body=useRef<T.Group>(null), other=useRef<T.Group>(null);
  useFrame(({clock})=>{
    const phase=s.film?.kind==='incident' && !s.settings.reduced ? clock.elapsedTime : 0;
    arm.current!.rotation.x=-.27-Math.sin(phase*3.4)*.23;
    body.current!.rotation.y=.14+Math.sin(phase*1.6)*.052;
    other.current!.rotation.y=-.19+Math.sin(phase*1.7)*.074;
  });
  return <>
    <group ref={body} position={[6.44,.1,-25.05]}>
      <Batch boxes={ceo} shadows={false}/>
      <group position={[.38,1.47,0]} ref={arm}>
        <GlowingBox position={[0,-.26,.03]} size={[.21,.48,.25]} color="#394b51"/>
        <GlowingBox position={[0,-.52,.048]} size={[.17,.17,.18]} color="#d7a67f"/>
      </group>
      <GlowingBox position={[-.39,1.15,.03]} size={[.21,.62,.25]} color="#394b51"/>
    </group>
    <group ref={other} position={[9.16,.1,-25.18]}>
      <Batch boxes={tech} shadows={false}/>
      <GlowingBox position={[-.37,1.23,.19]} size={[.2,.27,.29]} color="#557b72"/>
      <GlowingBox position={[.37,1.23,.19]} size={[.2,.27,.29]} color="#557b72"/>
      <Sign position={[0,1.48,.565]} w={.53} h={.25} title="INCIDENT" sub="FILES LOCKED"/>
    </group>
  </>;
}

const projected=new T.Vector3(), cameraTarget=new T.Vector3(), viewPosition=new T.Vector3(), normalEuler=new T.Euler(0,0,0,'YXZ');
const ray=new T.Raycaster(), pointer=new T.Vector2();
const ground=new T.Plane(new T.Vector3(0,1,0),0);
const hit=new T.Vector3();
const targetList=Object.entries(positions) as [Target,(typeof positions)[Target]][];
function visibleFrom(s:Session,target:Target) {
  if (target==='crossing') return s.pos[1]>ROAD.near && !s.roadClear;
  if (target==='arrival') return s.pos[1]>ROAD.far && (s.roadClear || s.safety.crossed);
  if (target==='door') return s.pos[1]>-.65 && s.safety.crossed && !s.safety.door;
  if (s.pos[1]>-.65 || s.pos[1]<-19.5) return false;
  if (target==='mail') return hasMail(s.safety);
  if (target.length===2) return distance(s.pos,positions[target].point)<4.15;
  return true;
}
function blockedView(a:Point,b:Point) {
  for(let t=.1;t<.96;t+=.1) {
    const x=T.MathUtils.lerp(a[0],b[0],t), z=T.MathUtils.lerp(a[1],b[1],t);
    if(walls.some(([x0,x1,z0,z1])=>x>x0&&x<x1&&z>z0&&z<z1)) return true;
  }
  return false;
}

function Runner({session:s,keys,markers,update,touch}:Props) {
  const {camera,gl,size,setDpr}=useThree();
  const floor=useRef<T.Mesh>(null);
  const lastUI=useRef('');
  const smooth=useRef({yaw:s.yaw,pitch:s.pitch,x:s.pos[0],z:s.pos[1],y:1.71});
  const perf=useRef({time:0,frames:0,slow:false});
  const gesture=useRef<{id:number;x:number;y:number;lastX:number;lastY:number;moved:boolean}>();
  const probes=useMemo(()=>targetList.map(([id,p])=>{
    const obj=new T.Mesh(cube);
    obj.userData.target=id;
    obj.position.set(...p.anchor);
    const large=id==='door'?[3.5,2.85,1]:id==='crossing'?[3.55,2.9,1.55]:id==='arrival'?[3.25,2.5,1.6]:
      id==='ppe'?[3.1,2.3,.8]:id==='mail'?[2.7,1.95,.83]:id==='checklist'?[3.33,2,.8]:id.length===1?[2.58,2.8,1.24]:[.69,1.49,.68];
    obj.scale.set(...large as [number,number,number]);
    obj.updateMatrixWorld();
    return obj;
  }),[]);
  useEffect(()=>{
    if(camera instanceof T.PerspectiveCamera) {
      camera.fov=size.width/size.height<.7?67:55;
      camera.updateProjectionMatrix();
    }
  },[size.width,size.height,camera]);
  useEffect(()=>{
    perf.current={time:0,frames:0,slow:false};
    setDpr(Math.min(devicePixelRatio || 1,s.settings.quality==='low'?.85:touch?1.2:1.6));
  },[setDpr,s.settings.quality,touch]);
  useEffect(()=>{
    const el=gl.domElement;
    const press=(e:PointerEvent)=>{
      if(!s.started || s.panel || s.film || e.button!==0) return;
      if(e.pointerType==='mouse') {
        if(document.pointerLockElement!==el) void el.requestPointerLock?.()?.catch(()=>say(s,'Drag to look when mouse lock is unavailable.'));
      }
      gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
      if(e.pointerType!=='mouse') el.setPointerCapture(e.pointerId);
    };
    const look=(e:PointerEvent)=>{
      if(!s.started || s.panel || s.film) return;
      if(document.pointerLockElement===el && e.pointerType==='mouse') {
        s.look=null;
        s.yaw-=e.movementX*.00245;
        s.pitch=T.MathUtils.clamp(s.pitch-e.movementY*.00245,-1.18,1.18);
        return;
      }
      const g=gesture.current;
      if(!g || g.id!==e.pointerId) return;
      if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>9) g.moved=true;
      if(g.moved) {
        s.look=null;
        s.nav=null;
        const sensitivity=e.pointerType==='mouse'?.0039:.0059;
        s.yaw+=(e.clientX-g.lastX)*sensitivity;
        s.pitch=T.MathUtils.clamp(s.pitch+(e.clientY-g.lastY)*sensitivity,-1.18,1.18);
      }
      g.lastX=e.clientX;g.lastY=e.clientY;
    };
    const release=(e:PointerEvent)=>{
      const g=gesture.current;
      gesture.current=undefined;
      if(!g || g.id!==e.pointerId || g.moved || s.panel || s.film || e.pointerType==='mouse') return;
      if(s.nav) { s.nav=null; say(s,'Walk stopped.'); update(); return; }
      const rect=el.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);
      const picks=ray.intersectObjects(probes.filter(p=>visibleFrom(s,p.userData.target)),false);
      const picked=picks.find(p=>{
        const target=p.object.userData.target as Target;
        const [x,,z]=positions[target].anchor;
        return p.distance<26 && !blockedView(s.pos,[x,z]);
      });
      if(picked) navigate(s,picked.object.userData.target as Target);
      else if(ray.ray.intersectPlane(ground,hit) && hit.distanceTo(camera.position)<45 && !blockedView(s.pos,[hit.x,hit.z])) navigate(s,[hit.x,hit.z]);
      else say(s,'Tap a clear patch of ground to walk.');
      update();
    };
    const cancel=()=>{gesture.current=undefined;};
    el.addEventListener('pointerdown',press);
    window.addEventListener('pointermove',look);
    window.addEventListener('pointerup',release);
    el.addEventListener('pointercancel',cancel);
    return ()=>{
      el.removeEventListener('pointerdown',press); window.removeEventListener('pointermove',look);
      window.removeEventListener('pointerup',release); el.removeEventListener('pointercancel',cancel);
    };
  },[camera,gl,s,probes,update]);
  useFrame(({clock},elapsed)=>{
    const dt=Math.min(elapsed,.075);
    const p=perf.current;
    if(!p.slow && s.settings.quality==='auto' && elapsed<.4) {
      p.time+=elapsed; p.frames++;
      if(p.time>3 && p.frames>6) {
        if(p.time/p.frames>.031) {setDpr(Math.min(devicePixelRatio || 1,.82));p.slow=true;}
        p.time=0;p.frames=0;
      }
    }
    const changed=tick(s,dt,keys);
    const f=s.film, m=smooth.current;
    let yaw=s.yaw,pitch=s.pitch,x=s.pos[0],z=s.pos[1],y=1.72;
    if(s.panel==='welcome' && !s.started && s.checkpoint==='outside' && !s.safety.crossed) {
      y=2.16; pitch=.022;
    }
    if(!s.settings.reduced && !s.panel && !f && (s.nav || keys.size)) y+=Math.sin(clock.elapsedTime*10)*.026;
    if(s.panel==='mail') {
      z=Math.min(s.pos[1],-10.09);
      x=T.MathUtils.lerp(s.pos[0],7.6,.56);
      yaw=turnTo([x,z],[7.6,-11.48]); pitch=.11;
    }
    if(f?.kind==='both') {
      yaw=f.time<2.62?-1.02:f.time<5.37?1.04:0;
      pitch=-.072;
    } else if(f?.kind==='near' && f.time<1.7) {
      yaw=-f.side!*1.42;
      pitch=-.067;
    } else if(f?.kind==='incident' && f.time>1.1 && f.time<12.95) {
      x=f.time<8.4?7.42:8.55;z=f.time<8.4?-21.87:-22.76;y=1.86;
      yaw=f.time<8.4?.11:-.13;pitch=-.01;
    }
    const direct=changed && (Math.hypot(m.x-x,m.z-z)>1.5) || (f?.kind==='incident' && f.time>1.12 && f.time<1.27);
    const rate=s.settings.reduced?28:13;
    m.x=direct?x:T.MathUtils.damp(m.x,x,rate,dt);
    m.z=direct?z:T.MathUtils.damp(m.z,z,rate,dt);
    m.y=direct?y:T.MathUtils.damp(m.y,y,rate,dt);
    m.yaw+=Math.atan2(Math.sin(yaw-m.yaw),Math.cos(yaw-m.yaw))*(direct?1:1-Math.exp(-dt*rate));
    m.pitch=direct?pitch:T.MathUtils.damp(m.pitch,pitch,rate,dt);
    camera.position.set(m.x,m.y,m.z);
    normalEuler.set(m.pitch,m.yaw,0,'YXZ');
    camera.quaternion.setFromEuler(normalEuler);
    camera.updateMatrixWorld();
    viewPosition.set(0,0,-1).applyQuaternion(camera.quaternion);
    for(const [id,v] of targetList) {
      const el=markers.current[id];
      if(!el) continue;
      projected.set(...v.anchor);
      const forward=cameraTarget.copy(projected).sub(camera.position).dot(viewPosition)>0;
      projected.project(camera);
      const visible=s.started && !s.panel && !f && visibleFrom(s,id) && forward &&
        Math.abs(projected.x)<.91 && Math.abs(projected.y)<.86 && !blockedView(s.pos,[v.anchor[0],v.anchor[2]]) &&
        distance(s.pos,v.point)<27;
      el.style.visibility=visible?'visible':'hidden';
      if(visible) {
        el.style.left=`${(projected.x+1)*50}%`;
        el.style.top=`${(1-projected.y)*50}%`;
        el.dataset.primary=String(objective(s)===id);
      }
    }
    if(floor.current) {
      floor.current.visible=!!s.nav && !s.panel;
      if(s.nav) floor.current.position.set(s.nav.end[0],s.nav.end[1]<0?.131:.074,s.nav.end[1]);
    }
    const stage=f ? f.kind+ (f.kind==='incident'?(f.time<.58?'glitch':f.time<2.6?'black':f.time<5.9?'ceo':f.time<9.7?'it':f.time<12.45?'last':'end'):f.kind==='near'?(f.time<1.47?'near':'black'):f.kind==='failure'?(f.time<.43?'warning':'black'):f.time<2.75?'right':f.time<5.35?'left':'wait') : '';
    const fingerprint=[stage,s.toastId,s.nav?'walk':'',s.panel,nearest(s),objective(s),s.pressMode,s.pos[1]<-.55,s.safety.ppe.join(',')].join('|');
    if(changed || fingerprint!==lastUI.current) {
      lastUI.current=fingerprint;
      update();
    }
  });
  return <mesh ref={floor} visible={false} rotation-x={-Math.PI/2}><ringGeometry args={[.24,.305,28]}/><meshBasicMaterial color="#ffd08a" transparent opacity={.83} depthWrite={false}/></mesh>;
}
function Lights({s,high}:{s:Session;high:boolean}) {
  const point=useRef<T.PointLight>(null);
  const ambient=useRef<T.HemisphereLight>(null);
  useFrame((_,dt)=>{
    const indoors=s.pos[1]<-.35 || s.film?.kind==='incident'&&s.film.time>1;
    ambient.current!.intensity=T.MathUtils.damp(ambient.current!.intensity,indoors?1.46:1.83,4,dt);
    point.current!.intensity=T.MathUtils.damp(point.current!.intensity,s.safety.reported?73:31,2.3,dt);
  });
  return <>
    <hemisphereLight ref={ambient} args={['#e6edd1','#536f72',1.8]}/>
    <directionalLight position={[13,23,16]} intensity={2.03} color="#ffe0ab" castShadow={high} shadow-mapSize={[1024,1024]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={22} shadow-camera-bottom={-24} shadow-bias={-.00045} shadow-normalBias={.042}/>
    <pointLight position={[-4.8,4.1,-10.4]} distance={14} intensity={37} color="#ffce92"/>
    <pointLight ref={point} position={[6.7,3.8,-9.5]} distance={15} intensity={31} color="#ffd1a0"/>
    <pointLight position={[.2,3.3,-2.5]} distance={12} intensity={25} color="#a9dccc"/>
    <pointLight position={[8,3.85,-23.4]} distance={9} intensity={35} color="#ffe0b1"/>
  </>;
}
function Stage(props:Props & {high:boolean}) {
  const s=props.session;
  const board=checklist(s.safety).map(([text,done])=>(done?'1':'0')+text).join('|');
  return <>
    <fogExp2 attach="fog" args={['#bac6b3',.013]}/>
    <mesh><sphereGeometry args={[100,24,12]}/><shaderMaterial side={T.BackSide} depthWrite={false} vertexShader={skyVertex} fragmentShader={skyFragment}/></mesh>
    <Lights s={s} high={props.high}/>
    <Batch boxes={architecture}/>
    <Door s={s}/>
    <Trucks s={s} high={props.high}/>
    <Machines s={s}/>
    <Office s={s}/>
    <Sign position={[0,3.69,.769]} w={9.97} h={1.16} title="SAFETY TRAINING CENTER" sub="THE TRAINING WORKS   /   VISITOR ENTRANCE" kind="main"/>
    <Sign position={[-10.6,2.16,19.65]} w={2.34} h={.6} title="SECURITY" sub="VISITOR CHECK-IN"/>
    <Sign position={[-16.9,1.58,4.455]} w={1.75} h={.45} title="CONTAINER 04" sub="WORKS LOGISTICS"/>
    <Sign position={[8.58,3.78,.454]} w={2.17} h={.55} title="WORKS / 01" sub="MANUFACTURING"/>
    <Sign position={[6.9,2.2,-4.61]} w={2.62} h={.43} title="PPE STATION" sub="GLASSES / BOOTS / HEARING"/>
    <Sign position={[-8.5,1.91,-6.074]} w={3.26} h={1.92} title="SAFETY CHECKLIST" sub={board} kind="board"/>
    <Sign position={[3.69,2.22,-19.25]} w={2.27} h={1.65} title="PRESS BAY" sub="KEEP HANDS CLEAR|CHECK BOTH SIDES|REPORT DEFECTS" kind="poster"/>
    <Sign position={[10.55,2.25,-19.245]} w={1.85} h={1.41} title="PPE REQUIRED" sub="SAFETY GLASSES|SAFETY FOOTWEAR|HEARING PROTECTION" kind="poster"/>
    <Sign position={[7.42,3.65,-19.258]} w={2.08} h={.52} title="OPERATIONS OFFICE" sub="AUTHORIZED STAFF"/>
    <Sign position={[8.1,3.2,-27.626]} w={5.52} h={1.58} title="OPERATIONS / 01" sub="THE TRAINING WORKS   /   INTERNAL BRIEFING"/>
    <Sign position={[0,2.67,-.383]} rotation={Math.PI} w={1.64} h={.38} title="EXIT" sub="TO FORECOURT"/>
    {hasMail(s.safety) && <Sign position={[7.6,1.87,-11.438]} w={1.37} h={.72} title={s.safety.reported?'SECURE':'NEW MESSAGE'} sub={s.safety.reported?'PERSONNEL DIRECTORY':'WORKS MAIL / 01'}/>}
    {!s.started && <Html position={[0,.08,18.1]} center style={{pointerEvents:'none'}}><div className="world-beacon" aria-hidden="true"/></Html>}
    <Runner {...props}/>
  </>;
}
export default function World(props:Props) {
  const high=props.session.settings.quality==='high' || props.session.settings.quality==='auto' && !props.touch && (navigator.hardwareConcurrency || 4)>=6;
  return <Canvas className="scene" aria-label="First-person factory grounds and training facility" camera={{position:[0,2.16,22.7],near:.055,far:130,fov:55}} shadows={high} dpr={[.8,1.6]}
    gl={{powerPreference:props.touch?'low-power':'high-performance',antialias:!props.touch,alpha:false}}
    onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;}}>
    <Stage {...props} high={high}/>
  </Canvas>;
}
