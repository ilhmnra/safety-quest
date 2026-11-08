import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as T from 'three';
import { architecture, officeArchitecture, press, truck, person, skin, uniform, type Box, ink, steel, amber, ochre, lamp, alert, tealLamp, cream, slate } from './models';
import { distance, gear, isGear, machinePart, onRoad, positions, PREP_TABLE, PRESS_Z, ROAD, pressX, props, route, walls, type Gear, type Point, type Press, type Target } from './map';
import { hasMail, nearCrossing, objective, observed, usingCrossing, type Session } from './state';
import { filmStage, OFFICE_SHIFT, PPE_CUES, ppeBeat, REACH_CUT, REACH_JOLT, ROAD_IMPACT_LEAD, ROAD_REACTION_DELAY } from './cinematics';
import { encounterTruck, fromSouth, truckMotion } from './traffic';
import { audioStatus, play, setAudioLevel, unlock, updateAmbience } from './audio';
import { angleDelta, navigate, nearest, observeView, openNearby, say, targetAvailable, tick, turnTo, walkingRoute } from './engine';

export type Markers = Partial<Record<Target,HTMLButtonElement>>;
type Props = { session:Session; keys:Set<string>; markers:MutableRefObject<Markers>; update:()=>void; touch:boolean; monitor:MutableRefObject<HTMLDivElement|null>; paper:MutableRefObject<HTMLDivElement|null> };
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
const manager=person('manager'), engineering=person('engineering'), support=person('support');
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
  c.width=kind==='main'||kind==='poster'?1536:768;
  c.height=kind==='board'?452:kind==='poster'?950:kind==='main'?180:196;
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
    g.fillRect(0,0,W,36);g.fillRect(0,H-36,W,36);
    g.fillStyle='#2b4c4e';g.font='900 116px Arial';g.fillText(title,95,180,W-190);
    g.fillStyle='#a66f3b';g.fillRect(95,226,W-190,8);
    const lines=subtitle.split('|'), gap=Math.min(138,560/lines.length);
    g.font='bold 63px monospace';
    lines.forEach((line,i)=>{
      g.fillStyle='#526d62';g.fillText('0'+(i+1),96,348+i*gap);
      g.fillStyle='#263b3d';g.fillText(line,237,348+i*gap,W-322);
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

const tireGeometry=new T.CylinderGeometry(.357,.357,.30,12);
const hubGeometry=new T.CylinderGeometry(.163,.163,.055,12);
const headGlow=(()=>{
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d')!, gradient=g.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'#fff4c4dd');gradient.addColorStop(.24,'#ffc87086');gradient.addColorStop(1,'#ffc87000');
  g.fillStyle=gradient;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);
})();
function TruckRig({s,lane,encounter=false}:{s:Session;lane:0|1;encounter?:boolean}) {
  const rig=useRef<T.Group>(null), wheels=useRef<T.Group[]>([]);
  const lights=useRef<T.Group>(null);
  useFrame(()=>{
    const p=encounter?encounterTruck(s):truckMotion(s,lane), g=rig.current!;
    g.visible=!!p?.visible;
    if(!p?.visible) return;
    g.position.set(p.x,-.05,p.z);
    g.rotation.y=p.direction===1?Math.PI:0;
    for(const wheel of wheels.current) if(wheel) wheel.rotation.z=p.x*p.direction/.357;
    const bright=s.film?.kind==='near' && (encounter || s.film.useAmbient&&s.film.side===p.direction);
    lights.current!.visible=p.visible;
    lights.current!.scale.setScalar(bright?1:.53);
  });
  return <group ref={rig} visible={false}>
    <Batch boxes={lane===0?modelTruckA:modelTruckB}/>
    <Sign position={[-.7,1.69,.991]} w={2.31} h={.59} title="WORKS LOGISTICS" sub={lane===0?'FREIGHT 01':'FREIGHT 02'}/>
    {[-1,1].flatMap(side=>[-2.02,-1.22,1.91].map((x,index)=>
      <group key={side+':'+x} position={[x,.38,side*.925]} ref={g=>{if(g) wheels.current[(side===1?3:0)+index]=g;}}>
        <mesh geometry={tireGeometry} rotation-x={Math.PI/2} material={material('#252f31')}/>
        <mesh geometry={hubGeometry} rotation-x={Math.PI/2} position={[0,0,.17*side]} material={material(steel)}/>
        <GlowingBox position={[.072,.062,.205*side]} size={[.058,.058,.037]} color={cream}/>
      </group>))}
    <group ref={lights}>
      {[-.695,.695].map(z=><sprite key={z} position={[2.902,1.04,z]} scale={[1.8,1.8,1.8]}>
        <spriteMaterial map={headGlow} transparent depthWrite={false} blending={T.AdditiveBlending}/>
      </sprite>)}
      <pointLight position={[3.2,1.08,0]} intensity={27} distance={11} color="#ffdf9f"/>
    </group>
  </group>;
}

function equipmentModel(id:Gear):Box[] {
  const boxes:Box[]=[];
  const add=(...piece:Box)=>boxes.push(piece);
  if(id==='glasses'||id==='scratched') {
    for(const x of [-.15,.15]) {
      add(x,0,0,.265,.156,.058,'#74b5ad');
      add(x,.067,.036,.27,.038,.047,ink);
      add(x,-.069,.038,.26,.029,.045,ink);
      add(x-.123,0,.043,.027,.143,.044,ink);
      add(x+.123,0,.043,.027,.143,.044,ink);
      add(x*1.84,.025,-.055,.045,.055,.21,steel);
    }
    add(0,.038,.044,.10,.036,.056,ink);
    if(id==='scratched') {
      add(.15,.007,.052,.181,.018,.016,'!#eadaba',0,-.63);
      add(.132,-.034,.054,.122,.011,.018,'!#ffe4d0',0,-.43);
    } else add(-.19,.019,.048,.056,.015,.013,'#c6ddd2',0,.3);
  } else if(id==='hearing'||id==='broken') {
    for(const side of [-1,1]) {
      add(side*.219,.038,-.02,.072,.25,.102,ink,0,-side*.1);
      add(side*.126,.159,-.02,.154,.048,.10,ink,0,-side*.44);
      if(id==='hearing'||side===-1) {
        add(side*.222,-.083,.012,.165,.19,.177,ochre);
        add(side*.15,-.083,.015,.048,.169,.151,'#374346');
      } else add(.221,-.067,.012,.084,.125,.133,'#ab6445');
    }
    if(id==='hearing')add(0,.192,-.02,.162,.053,.102,steel);
    else {
      add(-.05,.187,-.022,.092,.055,.102,ink,0,-.29);
      add(.073,.134,-.023,.068,.049,.102,'#ae6753',0,-.43);
    }
  } else {
    for(const x of [-.16,.16]) {
      const boot=id==='boots';
      add(x,-.105,0,.25,.063,.34,boot?'#363d37':'#bba88e');
      add(x,-.031,.008,.236,.116,.32,boot?'#785540':'#9d655a');
      add(x,boot?.075:.022,-.077,.224,boot?.236:.087,.16,boot?'#a5724d':'#b7796d');
      add(x,-.036,.136,.222,.089,.106,boot?'#5d5043':'#c4ab91');
      for(const z of [.014,.068])add(x,.036,z,.125,.02,.025,cream);
    }
  }
  return boxes;
}
const equipmentModels=Object.fromEntries((Object.keys(gear) as Gear[]).map(id=>[id,equipmentModel(id)])) as Record<Gear,Box[]>;

function TagModel({at,tilt=0}:{at:[number,number,number];tilt?:number}) {
  const tag=useRef<T.Group>(null);
  useFrame((_,dt)=>{
    if(!tilt || !tag.current) return;
    tag.current.position.y=T.MathUtils.damp(tag.current.position.y,at[1],9,dt);
    tag.current.rotation.z=T.MathUtils.damp(tag.current.rotation.z,tilt,8,dt);
  });
  return <group ref={tag} position={[at[0],at[1]+(tilt?.20:0),at[2]]} rotation-z={tilt?tilt+.48:0}>
    <GlowingBox position={[0,.193,0]} size={[.055,.16,.042]} color={ink}/>
    <GlowingBox position={[0,0,0]} size={[.35,.32,.037]} color="#a04c38"/>
    <Sign position={[0,-.013,.025]} w={.327} h={.232} title="OUT OF SERVICE" sub="DO NOT OPERATE"/>
  </group>;
}

const boardBoxes:Box[]=[
  [0,0,0,.415,.535,.038,'#856a52'],[0,-.01,.022,.357,.44,.015,'#e1d5b3'],
  [0,.218,.034,.172,.07,.043,steel],[0,.244,.051,.109,.021,.028,cream],
  ...Array.from({length:7},(_,i):Box=>[0,.12-i*.041,.033,.267,.006,.007,'#a69576']),
];
function CabinetItem({s,id}:{s:Session;id:Gear}) {
  const item=useRef<T.Group>(null);
  const [x,y,z]=gear[id].anchor;
  useFrame((_,dt)=>{
    const g=item.current!, held=s.focus?.target===id;
    g.visible=!s.safety.ppe.includes(id);
    g.position.y=T.MathUtils.damp(g.position.y,y+(held?.07:0),9,dt);
    g.position.z=T.MathUtils.damp(g.position.z,z+(held?.10:0),9,dt);
    g.rotation.y=T.MathUtils.damp(g.rotation.y,held?.14:0,8,dt);
  });
  return <>
    <group ref={item} position={[x,y,z]}><Batch boxes={equipmentModels[id]} shadows={false}/></group>
    {s.safety.ppe.includes(id)&&<Sign position={[x,y,z+.018]} w={.55} h={.13} title="EQUIPPED" sub="SELECT TO REVIEW"/>}
  </>;
}
function Preparation({s}:{s:Session}) {
  return <>
    {(Object.keys(gear) as Gear[]).map(id=><CabinetItem key={id} s={s} id={id}/>)}
    {!s.safety.tagHeld&&!s.safety.tagged&&<TagModel at={[8.78,1.74,-4.41]}/>}
    {!s.safety.clipboard&&<group position={[PREP_TABLE[0],1.15,PREP_TABLE[1]]} rotation-x={-1.23}><Batch boxes={boardBoxes}/></group>}
  </>;
}
const handBoxes:Box[]=[
  [.04,-.15,.10,.12,.13,.30,'#455d5c'],
  [.035,-.125,-.069,.115,.076,.114,'#bc9274'],
  ...Array.from({length:4},(_,i):Box=>[-.005+i*.027,-.121,-.145,.024,.056,.10-(i===0?.021:0),'#d0a386']),
  [.102,-.121,-.074,.037,.060,.071,'#c3997b',0,-.3],
];
const injuryPixels:[number,number,number][]=[[.07,.015,-.15],[.11,-.026,-.18],[-.05,-.02,-.16],[-.02,.025,-.19],[.13,-.015,-.13],[.015,.055,-.17]];
function HeldProps({s}:{s:Session}) {
  const hand=useRef<T.Group>(null);
  const sparks=useRef<T.Group>(null);
  const offset=useMemo(()=>new T.Vector3(),[]);
  useFrame(({camera})=>{
    const f=s.film, h=hand.current!;
    h.visible=f?.kind==='failure' && f.reason==='reach' && f.time<REACH_CUT;
    if(h.visible && f) {
      const reach=T.MathUtils.smoothstep(f.time,.23,2.65);
      const trapped=T.MathUtils.smoothstep(f.time,REACH_JOLT,REACH_JOLT+.18);
      const anchor=positions['a-reach'].anchor;
      const depth=Math.max(.28,Math.min(.89,camera.position.distanceTo(offset.set(...anchor))-.32));
      h.position.copy(offset.set(.19-reach*.115,-.37+reach*.25-trapped*.095,-T.MathUtils.lerp(.28,depth,reach)).applyQuaternion(camera.quaternion).add(camera.position));
      h.quaternion.copy(camera.quaternion);
      h.scale.set(1,1-trapped*.73,1);
      const burst=sparks.current!;
      const splash=f.time-REACH_JOLT;
      burst.visible=splash>=0 && splash<.34;
      if(burst.visible) {
        burst.position.copy(h.position);burst.quaternion.copy(h.quaternion);
        burst.scale.setScalar(.7+splash*5);
      }
    } else if(sparks.current) sparks.current.visible=false;
  });
  return <>
    <group ref={hand} visible={false}><Batch boxes={handBoxes} shadows={false}/></group>
    <group ref={sparks} visible={false}>{injuryPixels.map((bit,i)=><GlowingBox key={i} position={bit} size={[.017,.014,.02]} color={i%2===0?"#b74739":"#8f3631"}/>)}</group>
  </>;
}

const gearTeeth:Box[]=Array.from({length:12},(_,i)=>{
  const angle=i*Math.PI/6;
  return [Math.sin(angle)*.34,0,Math.cos(angle)*.34,.115,.105,.135,'#748283',angle];
});
const fragmentShapes=Array.from({length:15},(_,i)=>({
  x:Math.sin(i*2.39)*(.38+i*.04),y:Math.cos(i*2.39)*(.32+i*.04),scale:.018+(i%4)*.011,
}));

function PpeEffects({s}:{s:Session}) {
  const feet=useRef<T.Group>(null), shoe=useRef<T.Group>(null), falling=useRef<T.Group>(null), blood=useRef<T.Group>(null);
  const debris=useRef<T.Group>(null), flash=useRef<T.PointLight>(null);
  const canvas=s.film?.kind==='ppe'&&s.film.footwear==='canvas';
  const footTone=canvas?'#ab9272':'#c39a80';
  useFrame(({camera})=>{
    const film=s.film, beat=ppeBeat(film);
    if(film?.kind!=='ppe') return;
    const yaw=turnTo(s.pos,[pressX[film.press],PRESS_Z]);
    const foot=feet.current!, metal=falling.current!;
    foot.visible=beat?.slot==='feet';
    if(foot.visible&&beat) {
      foot.position.set(s.pos[0]-Math.sin(yaw)*1.05,.126,s.pos[1]-Math.cos(yaw)*1.05);
      foot.rotation.y=yaw;
      const fall=T.MathUtils.clamp((beat.time-.10)/(PPE_CUES.feet-.10),0,1);
      metal.position.set(.04,T.MathUtils.lerp(2.08,.10,fall**2),-.22);
      metal.rotation.set(.47*(1-fall),beat.time*4,.31*(1-fall));
      shoe.current!.scale.y=T.MathUtils.lerp(1,.27,T.MathUtils.smoothstep(beat.time,PPE_CUES.feet-.025,PPE_CUES.feet+.10));
      blood.current!.visible=beat.time>=PPE_CUES.feet&&beat.time<PPE_CUES.feet+.48;
    }
    const burst=debris.current!;
    const age=beat?.slot==='eyes'?beat.time-PPE_CUES.eyes:-1;
    burst.visible=age>=0&&age<.62;
    const sourceX=pressX[film.press]+Math.sin(yaw)*1.30,sourceZ=PRESS_Z+Math.cos(yaw)*1.30;
    flash.current!.position.set(sourceX,1.48,sourceZ);
    flash.current!.intensity=burst.visible&&!s.settings.reduced?12*(1-Math.min(1,age/.17)):0;
    if(burst.visible) burst.children.forEach((bit,i)=>{
      const fragment=fragmentShapes[i],flight=T.MathUtils.clamp(age/(.36+(i%5)*.06),0,1);
      bit.visible=flight<1;
      bit.position.set(T.MathUtils.lerp(sourceX,camera.position.x+fragment.x,flight),T.MathUtils.lerp(1.48,camera.position.y+fragment.y,flight),T.MathUtils.lerp(sourceZ,camera.position.z,flight));
      bit.rotation.set(age*9+i,age*11,age*8+i);
    });
  });
  return <>
    <group ref={feet} visible={false}>
      <group ref={shoe} position={[.13,0,0]}>
        <GlowingBox position={[0,.058,.14]} size={[.24,.116,.52]} color={footTone}/>
        {canvas&&<GlowingBox position={[0,.015,.13]} size={[.25,.030,.54]} color="#3c3731"/>}
        <GlowingBox position={[0,.15,.34]} size={[.17,.23,.15]} color="#506364"/>
      </group>
      <group ref={falling}><mesh geometry={tireGeometry} scale={[.91,.40,.91]} material={material('#4e6064')}/><Batch boxes={gearTeeth} shadows={false}/>
        <mesh geometry={hubGeometry} position={[0,.09,0]} material={material('#9ba7a0')}/>
      </group>
      <group ref={blood} visible={false}>
        {[[-.21,.16],[.29,.29],[.39,.13],[.24,.40],[.44,.25]].map(([x,z],i)=><GlowingBox key={i} position={[x,.013,z]} size={[.039,.018,.035]} color={i%2?'#a9443e':'#c15c4a'}/>)}
      </group>
    </group>
    <group ref={debris} visible={false}>{fragmentShapes.map(({scale},i)=><mesh key={i} geometry={cube} scale={[scale,scale*.58,scale*1.5]} material={material(i%4===0?lamp:'#a4a99c')}/>)}</group>
    <pointLight ref={flash} intensity={0} distance={5} color="#ffc584"/>
  </>;
}

function Machines({s}:{s:Session}) {
  const ram=useRef<Partial<Record<Press,T.Group>>>({});
  const beacon=useRef<T.Mesh>(null);
  const controls=useRef<Partial<Record<Target,T.Group>>>({});
  useFrame(({clock})=>{
    const t=s.pressTime;
    const stroke=s.pressMode==='cycling' ? Math.sin(Math.PI*T.MathUtils.clamp((t-.37)/2.45,0,1))**2 : 0;
    ram.current.b!.position.y=-stroke*.63;
    const f=s.film;
    if(f?.kind==='failure'&&f.reason==='reach') {
      const strike=T.MathUtils.smoothstep(f.time,REACH_JOLT,REACH_JOLT+.19);
      ram.current.a!.position.y=-.10*Math.sin(Math.min(1,f.time/2.5)*Math.PI)-.61*strike;
    } else ram.current.a!.position.y=s.stoppedA?0:-(Math.sin(Math.min(1,s.faultTime)*Math.PI)**2)*(.10+.03*Math.sin(s.faultTime*42));
    for(const [id,button] of Object.entries(controls.current)) {
      const pressed=s.controlPress?.target===id && s.controlPress.until>s.time;
      button.position.z=T.MathUtils.lerp(button.position.z,pressed?1.29:1.338,.34);
    }
    beacon.current!.material=material(s.safety.tagged || (!s.stoppedA && Math.sin(clock.elapsedTime*13)>.1)?alert:'#87724d');
  });
  return <>{(['a','b'] as const).map(id=>{
    const a=id==='a';
    const status=a?(s.safety.tagged?'TAGGED':s.stoppedA?'STOPPED':'FAULT'):
      s.pressMode==='cycling'?'CYCLING':s.pressMode==='cycled'?'RAM HOME':'STOPPED';
    return <group key={id} position={[pressX[id],.105,PRESS_Z]}>
      <Batch boxes={a?modelA:modelB}/>
      <Sign position={[0,3.117,1.22]} w={1.51} h={.385} title={a?'PRESS A':'PRESS B'} sub={a?'MECHANICAL / 01':'TRAINING / 02'}/>
      <Sign position={[.86,2.235,1.298]} w={.47} h={.19} title={status} sub="SIMULATION"/>
      {(['start','stop'] as const).map(part=>{
        const running=a?!s.stoppedA:s.pressMode==='cycling';
        return <group key={part} position={[.91,part==='start'?1.705:1.225,1.338]} ref={g=>{if(g)controls.current[(id+'-'+part) as Target]=g;}}>
          <GlowingBox position={[0,0,0]} size={[.22,.128,.045]} color={part==='start'?(running?tealLamp:'#719782'):(running?'#ae594b':alert)}/>
        </group>;
      })}
      <Sign position={[.91,1.53,1.257]} w={.29} h={.065} title="START"/>
      <Sign position={[.91,1.05,1.257]} w={.29} h={.065} title="STOP"/>
      {a ? <mesh ref={beacon} geometry={cube} position={[.8,3.91,.36]} scale={[.22,.1,.19]} material={material('#87724d')}/> :
        <GlowingBox position={[.8,3.91,.36]} size={[.22,.1,.19]} color={s.pressMode==='cycling'?lamp:tealLamp}/>}
      <group ref={g=>{if(g)ram.current[id]=g;}}>
        <GlowingBox position={[0,2.15,.16]} size={[.31,.51,.36]} color="#a3a998"/>
        <GlowingBox position={[0,1.896,.16]} size={[.65,.16,.58]} color={slate}/>
        <GlowingBox position={[0,1.79,.16]} size={[.44,.086,.41]} color="#b8b7a4"/>
      </group>
      {a&&<Sign position={[-.95,1.54,1.29]} w={.39} h={.115} title="TAG HOOK" sub="REPORT DEFECTS"/>}
      {a&&s.safety.tagged&&<TagModel at={[-.95,1.19,1.38]} tilt={-.17}/>}
    </group>;
  })}</>;
}

function Office({s}:{s:Session}) {
  const arm=useRef<T.Group>(null), report=useRef<T.Group>(null);
  const audit=s.film?.kind==='audit';
  const role=audit?'engineering':'support';
  useFrame(()=>{
    const f=s.film;
    if(!f || (f.kind!=='audit'&&f.kind!=='incident')) return;
    const t=s.settings.reduced?1:f.time;
    const talk=f.beat===1?Math.sin(Math.min(3,t)*1.65)*.22:0;
    arm.current!.rotation.x=-.16-talk;
    const opening=f.beat>=2?T.MathUtils.smoothstep(t,.14,1.55):0;
    report.current!.rotation.x=audit?.60-opening*.66:1.31-opening*1.44;
    report.current!.position.y=audit?.94+opening*.16:1.09;
  });
  return <group position={[0,0,OFFICE_SHIFT]}>
    <Batch boxes={officeArchitecture}/>
    <pointLight position={[8,3.85,-23.4]} distance={11} intensity={42} color="#ffe0b1"/>
    <Sign position={[8.1,3.2,-27.626]} w={5.52} h={1.58} title="OPERATIONS" sub="THE TRAINING WORKS   /   INTERNAL BRIEFING"/>
    <Sign position={[6.37,1.20,-23.37]} w={1.10} h={.18} title="OPERATIONS MANAGER" sub="FACTORY OPERATIONS"/>
    <group position={[6.44,.1,-25.05]} rotation-y={.045}>
      <Batch boxes={manager} shadows={false}/>
      <group position={[.39,1.47,0]} ref={arm}>
        <GlowingBox position={[0,-.26,.03]} size={[.21,.48,.25]} color={uniform.manager}/>
        <GlowingBox position={[0,-.45,.065]} size={[.18,.061,.21]} color="#e4d6c3"/>
        <GlowingBox position={[0,-.52,.081]} size={[.17,.155,.178]} color={skin.manager}/>
      </group>
      <GlowingBox position={[-.39,1.15,.03]} size={[.21,.62,.25]} color={uniform.manager}/>
    </group>
    <group position={[9.16,.1,-25.18]} rotation-y={-.12}>
      <Batch boxes={audit?engineering:support} shadows={false}/>
      <Sign position={[-.22,1.50,.234]} w={.32} h={.105} title={audit?'ENGINEERING':'IT SUPPORT'} sub="WORKS STAFF"/>
      {[-1,1].map(side=><group key={side} position={[side*.39,1.19,.09]} rotation-x={-.38}>
        <GlowingBox position={[0,-.07,.11]} size={[.19,.42,.2]} color={uniform[role]}/>
        <GlowingBox position={[0,-.14,.24]} size={[.155,.19,.15]} color={skin[role]}/>
      </group>)}
      {!audit&&<GlowingBox position={[.13,1.09,.5]} size={[.64,.072,.43]} color={ink}/>}
      <group ref={report} position={[.13,1.09,.36]}>
        {audit?<>
          <group position={[0,.23,.064]} scale={[1.27,1.15,1]}><Batch boxes={boardBoxes} shadows={false}/></group>
          <Sign position={[0,.29,.103]} w={.42} h={.17} title="INSPECTION REPORT" sub="DISCREPANCY FOUND"/>
        </>:<>
          <GlowingBox position={[0,.22,.015]} size={[.67,.43,.064]} color={slate}/>
          <GlowingBox position={[0,.218,.052]} size={[.60,.357,.026]} color="#5a3638"/>
          <Sign position={[0,.218,.071]} w={.57} h={.33} title="SECURITY INCIDENT" sub="SHARED FILES LOCKED"/>
        </>}
      </group>
    </group>
  </group>;
}

const projected=new T.Vector3(), cameraTarget=new T.Vector3(), viewPosition=new T.Vector3(), normalEuler=new T.Euler(0,0,0,'YXZ');
const ray=new T.Raycaster(), pointer=new T.Vector2();
const ground=new T.Plane(new T.Vector3(0,1,0),0);
const hit=new T.Vector3();
const targetList=Object.entries(positions) as [Target,(typeof positions)[Target]][];
const PAPER_WIDTH=.437, PAPER_HEIGHT=.525, PAPER_Y=-.014, PAPER_Z=.035;
const heldBoard:Box[]=[
  [0,0,0,.47,.59,.042,'#856a52'],
  [0,PAPER_Y,.023,PAPER_WIDTH,PAPER_HEIGHT,.016,'#d7c7a2'],
  [0,.273,.038,.184,.06,.046,steel],
  [0,.293,.055,.116,.016,.028,cream],
  [.18,-.266,-.011,.105,.122,.072,'#c3997b'],
];
const DOT_CAPACITY=100;
const guideSurfaces=architecture.filter(([,y,,,height,,,turn,tilt])=>!turn&&!tilt&&y+height/2<=.21&&y+height/2>=-.07);

function guideHeight(x:number,z:number) {
  let height=-.06;
  for(const [cx,y,cz,width,depthY,depth] of guideSurfaces) {
    if(Math.abs(cx-x)<=width/2&&Math.abs(cz-z)<=depth/2) height=Math.max(height,y+depthY/2);
  }
  return height+.005;
}

function placeSurface(el:HTMLDivElement,a:T.Vector3,b:T.Vector3,width:number,height:number,interactive:boolean) {
  el.style.left=((a.x+1)*width*.5)+'px';
  el.style.top=((1-a.y)*height*.5)+'px';
  el.style.width=((b.x-a.x)*width*.5)+'px';
  el.style.height=((a.y-b.y)*height*.5)+'px';
  el.dataset.aligned=String(interactive);
}

function plotGuide(mesh:T.InstancedMesh,start:Point,path:Point[],lead:number) {
  const stamp=new T.Object3D();
  stamp.rotation.x=-Math.PI/2;
  let origin=start, skip=lead, count=0;
  for(const point of path) {
    const length=distance(origin,point);
    for(;skip<length && count<DOT_CAPACITY;skip+=.49) {
      const x=T.MathUtils.lerp(origin[0],point[0],skip/length);
      const z=T.MathUtils.lerp(origin[1],point[1],skip/length);
      stamp.position.set(x,guideHeight(x,z),z);
      stamp.updateMatrix();
      mesh.setMatrixAt(count++,stamp.matrix);
    }
    skip-=length;
    origin=point;
  }
  mesh.count=count;
  mesh.instanceMatrix.needsUpdate=true;
}

function guideTarget(s:Session,active:Target):Target {
  if(onRoad(s.pos)&&s.crossingHeading!==null) return s.crossingHeading===0?'arrival':'arrival-south';
  if(!nearCrossing(s.pos)) return active;
  const south=fromSouth(s.pos);
  if(s.roadClear) return south?'arrival':'arrival-south';
  if(south) return 'crossing';
  return s.gaze.checked||observed(s,'left')||observed(s,'right')?'crossing-north':active;
}
function visibleFrom(s:Session,target:Target) {
  if(!targetAvailable(s,target)) return false;
  const d=distance(s.pos,positions[target].point);
  if(isGear(target)) return d<5.3;
  const machine=machinePart(target);
  if(!machine) return true;
  const [press,part]=machine;
  if(part==='front') return d<13;
  const localX=s.pos[0]-pressX[press], localZ=s.pos[1]-PRESS_Z;
  if(part==='rear') return localZ<-.9 && d<4.3;
  if(part==='left') return localX<-1.05 && d<4.1;
  if(part==='right') return localX>1.05 && d<4.1;
  return localZ>.75 && d<3.7;
}
const sightBlockers=[...walls,...props.slice(0,4)];
function blockedView(a:Point,b:Point,object=false) {
  for(let t=.1;t<.96;t+=.1) {
    const x=T.MathUtils.lerp(a[0],b[0],t), z=T.MathUtils.lerp(a[1],b[1],t);
    if(sightBlockers.some(([x0,x1,z0,z1])=>{
      const endpointInside=object && b[0]>x0 && b[0]<x1 && b[1]>z0 && b[1]<z1;
      return !endpointInside && x>x0 && x<x1 && z>z0 && z<z1;
    })) return true;
  }
  return false;
}

function Runner({session:s,keys,markers,update,touch,monitor,paper}:Props) {
  const {camera,gl,size,setDpr}=useThree();
  const floor=useRef<T.Mesh>(null);
  const trail=useRef<T.InstancedMesh>(null);
  const board=useRef<T.Group>(null);
  const lift=useRef(0);
  const guideCache=useRef<{at:Point;key:string}|null>(null);
  const highlight=useRef<T.Mesh>(null);
  const soundClock=useRef({elapsed:0,walked:0});
  const screenCorners=useMemo(()=>[new T.Vector3(),new T.Vector3()],[]);
  const lastUI=useRef('');
  const smooth=useRef({yaw:s.yaw,pitch:s.pitch,x:s.pos[0],z:s.pos[1],y:1.71});
  const perf=useRef({time:0,frames:0,slow:false});
  const gesture=useRef<{id:number;x:number;y:number;lastX:number;lastY:number;moved:boolean}>();
  const probes=useMemo(()=>targetList.map(([id,p])=>{
    const obj=new T.Mesh(cube);
    obj.userData.target=id;
    obj.position.set(...p.anchor);
    obj.scale.set(...(p.hit??[.6,.6,.6]));
    obj.updateMatrixWorld();
    return obj;
  }),[]);
  useEffect(()=>{
    if(camera instanceof T.PerspectiveCamera) {
      camera.fov=size.width/size.height<.7?74:s.settings.fov;
      camera.updateProjectionMatrix();
    }
  },[size.width,size.height,camera,s.settings.fov]);
  useEffect(()=>{
    perf.current={time:0,frames:0,slow:false};
    setDpr(Math.min(devicePixelRatio || 1,s.settings.quality==='low'?.85:touch?1.2:1.6));
  },[setDpr,s.settings.quality,touch]);
  useEffect(()=>{
    const el=gl.domElement;
    const press=(e:PointerEvent)=>{
      if(!s.started || s.panel || s.film || e.button!==0) return;
      if(s.settings.sound&&audioStatus()!=='running') {setAudioLevel(true,s.settings.volume);unlock();}
      if(document.pointerLockElement===el) return;
      gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
      el.setPointerCapture(e.pointerId);
    };
    const look=(e:PointerEvent)=>{
      if(!s.started || s.panel || s.film) return;
      if(document.pointerLockElement===el && e.pointerType==='mouse') {
        s.look=null;
        s.gazeSelection=null;
        s.focus=null;
        s.yaw-=e.movementX*.00245;
        s.pitch=T.MathUtils.clamp(s.pitch-e.movementY*.00245,-1.18,1.18);
        return;
      }
      const g=gesture.current;
      if(!g || g.id!==e.pointerId) return;
      if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>(e.pointerType==='mouse'?4:8)) g.moved=true;
      if(g.moved) {
        s.look=null;
        s.gazeSelection=null;
        s.nav=null;
        s.focus=null;
        const sensitivity=e.pointerType==='mouse'?.0039:.0059;
        s.yaw+=(e.clientX-g.lastX)*sensitivity;
        s.pitch=T.MathUtils.clamp(s.pitch+(e.clientY-g.lastY)*sensitivity,-1.18,1.18);
      }
      g.lastX=e.clientX;g.lastY=e.clientY;
    };
    const release=(e:PointerEvent)=>{
      const g=gesture.current;
      gesture.current=undefined;
      if(!g || g.id!==e.pointerId || g.moved || s.panel || s.film) return;
      if(e.pointerType==='mouse' && s.settings.control==='mouse' && el.requestPointerLock) {
        try { void el.requestPointerLock()?.catch(()=>say(s,'Mouse lock unavailable. Drag to look.')); } catch { say(s,'Mouse lock unavailable. Drag to look.'); }
        return;
      }
      if(s.nav) { s.nav=null; say(s,'Walk stopped.'); update(); return; }
      if(s.focus) {s.focus=null;s.look=null;}
      const rect=el.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);
      const picks=ray.intersectObjects(probes.filter(p=>visibleFrom(s,p.userData.target)),false);
      const picked=picks.find(p=>{
        const target=p.object.userData.target as Target;
        const [x,,z]=positions[target].anchor;
        return p.distance<26 && !blockedView(s.pos,[x,z],true);
      });
      if(picked) openNearby(s,picked.object.userData.target as Target);
      else if(ray.ray.intersectPlane(ground,hit) && hit.distanceTo(camera.position)<45 && !blockedView(s.pos,[hit.x,hit.z])) navigate(s,[hit.x,hit.z]);
      else say(s,'Choose a clear patch of ground to walk.');
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
    const before=s.pos;
    // Keep vehicle and film timing in real seconds while capping collision steps.
    const changed=tick(s,dt,keys,Math.min(elapsed,.28));
    const f=s.film, m=smooth.current;
    let yaw=s.yaw,pitch=s.pitch,x=s.pos[0],z=s.pos[1],y=1.72;
    if(s.panel==='welcome' && !s.started && s.checkpoint==='outside' && !s.safety.crossed) {
      y=2.16; pitch=.022;
    }
    if(!s.settings.reduced && !s.panel && !f && (s.nav || keys.size)) y+=Math.sin(clock.elapsedTime*10)*.026;
    const fov=camera instanceof T.PerspectiveCamera?camera.fov:74;
    const viewSlope=2*Math.tan(T.MathUtils.degToRad(fov*.5));
    const screenWidth=Math.min(size.width*.89,Math.max(160,(size.height-112)*4/3),650);
    const crtZ=-11.409+1.476*size.height/(viewSlope*screenWidth);
    if(s.panel==='mail') {
      x=7.6;z=crtZ;y=1.92;yaw=0;pitch=0;
    } else if(s.panel==='cabinet'&&s.look) {
      [yaw,pitch]=s.look;
    }
    if(s.focus && !f && !s.panel) {
      const [ax,ay,az]=positions[s.focus.target].anchor;
      const d=distance(s.pos,[ax,az]), gearFocus=isGear(s.focus.target);
      const framing=gearFocus?1.35:1.2;
      const lean=Math.min(.075,Math.max(0,d-framing));
      x+=(ax-x)/Math.max(.1,d)*lean;
      z+=(az-z)/Math.max(.1,d)*lean;
      y+=T.MathUtils.clamp((ay-y)*.22,-.14,.13);
      yaw=turnTo([x,z],[ax,az]);
      pitch=Math.atan2(ay-y,Math.max(.34,d-lean));
    }
    if(f?.kind==='near') {
      if(f.time<(f.holdView?f.horn+ROAD_REACTION_DELAY:.42)) { yaw=m.yaw; pitch=m.pitch; }
      else {
        const truck=encounterTruck(s)!;
        yaw=turnTo([x,z],[truck.x-f.side*2.55,truck.z]);
        pitch=-.055;
      }
      if(!s.settings.reduced) {
        z+=(f.curb===ROAD.near?-1:1)*T.MathUtils.smoothstep(f.time,.4,2.5)*.44;
        y+=.02*Math.sin(f.time*7)*Math.min(f.time,1);
        if(f.time>=f.cut-ROAD_IMPACT_LEAD) pitch-=.23*T.MathUtils.smoothstep(f.time,f.cut-ROAD_IMPACT_LEAD,f.cut);
      }
    } else if(f?.kind==='ppe') {
      const beat=ppeBeat(f);
      yaw=turnTo(s.pos,[pressX[f.press],PRESS_Z]);
      pitch=beat?.slot==='feet'?T.MathUtils.lerp(-.26,-.88,T.MathUtils.smoothstep(beat.time,.07,.61)):-.07;
      if(beat&&!s.settings.reduced&&beat.time>=PPE_CUES[beat.slot]) {
        const age=beat.time-PPE_CUES[beat.slot];
        y+=Math.sin(age*32)*Math.max(0,.06-age*.17);
      }
    } else if(f?.kind==='failure' && f.reason==='reach') {
      const [ax,ay,az]=positions['a-reach'].anchor;
      yaw=turnTo([x,z],[ax,az]);pitch=Math.atan2(ay-y,distance([x,z],[ax,az]));
      if(!s.settings.reduced && f.time>REACH_JOLT && f.time<REACH_JOLT+.35)
        pitch-=.12*Math.sin(Math.PI*(f.time-REACH_JOLT)/.35);
    } else if(f?.kind==='incident'||f?.kind==='audit') {
      const staff=f.beat>=2;
      const move=T.MathUtils.smoothstep(f.time,0,2);
      x=staff?8.97:6.47;
      z=(staff?-22.66-move*.22:-21.28-move*.24)+OFFICE_SHIFT;
      y=staff?1.74:1.69;
      yaw=staff?-.06:.015;pitch=staff?-.027:-.078;
    }
    const direct=Math.hypot(m.x-x,m.z-z)>12 || (changed && Math.hypot(m.x-x,m.z-z)>1.5);
    const rate=s.settings.reduced?22:f?.kind==='near'?4.9:f?.kind==='audit'||f?.kind==='incident'?2.9:s.panel==='mail'?6:10;
    m.x=direct?x:T.MathUtils.damp(m.x,x,rate,dt);
    m.z=direct?z:T.MathUtils.damp(m.z,z,rate,dt);
    m.y=direct?y:T.MathUtils.damp(m.y,y,rate,dt);
    m.yaw+=Math.atan2(Math.sin(yaw-m.yaw),Math.cos(yaw-m.yaw))*(direct?1:1-Math.exp(-dt*rate));
    m.pitch=direct?pitch:T.MathUtils.damp(m.pitch,pitch,rate,dt);
    if(camera instanceof T.PerspectiveCamera && size.width/size.height<.7) {
      const viewingCabinet=s.pos[1]<-.58 && s.pos[1]>-4.42 && Math.abs(s.pos[0]-6.9)<2.25 && !f && !s.focus;
      const fov=T.MathUtils.damp(camera.fov,viewingCabinet?77:74,7,dt);
      if(Math.abs(fov-camera.fov)>.01) {camera.fov=fov;camera.updateProjectionMatrix();}
    }
    camera.position.set(m.x,m.y,m.z);
    normalEuler.set(m.pitch,m.yaw,0,'YXZ');
    camera.quaternion.setFromEuler(normalEuler);
    camera.updateMatrixWorld();
    viewPosition.set(0,0,-1).applyQuaternion(camera.quaternion);
    const observedNow=observeView(s,m.yaw,m.pitch,dt);
    if(s.panel==='mail'&&monitor.current) {
      const [a,b]=screenCorners;
      a.set(6.862,2.474,-11.409).project(camera);
      b.set(8.338,1.366,-11.409).project(camera);
      const aligned=Math.abs(m.x-7.6)+Math.abs(m.z-crtZ)+Math.abs(m.y-1.92)+Math.abs(angleDelta(m.yaw,0))+Math.abs(m.pitch)<.045;
      placeSurface(monitor.current,a,b,size.width,size.height,aligned);
    }
    lift.current=T.MathUtils.damp(lift.current,s.panel==='clipboard'?1:0,14,dt);
    const clipboard=board.current!;
    clipboard.visible=lift.current>.04;
    if(paper.current) {
      paper.current.dataset.visible=String(clipboard.visible);
      paper.current.inert=s.panel!=='clipboard'||lift.current<=.86;
    }
    if(clipboard.visible) {
      const [a,b]=screenCorners;
      const pixelWidth=Math.min(size.width-42,440,Math.max(146,(size.height-165)*.8));
      const depth=PAPER_Z+PAPER_WIDTH*size.height/(viewSlope*pixelWidth);
      const drop=(size.height*.54*(1-lift.current)+24)*depth*viewSlope/size.height;
      clipboard.position.copy(a.set(0,-drop,-depth).applyQuaternion(camera.quaternion).add(camera.position));
      clipboard.quaternion.copy(camera.quaternion);
      if(paper.current) {
        a.set(-PAPER_WIDTH/2,PAPER_Y+PAPER_HEIGHT/2,PAPER_Z).applyQuaternion(clipboard.quaternion).add(clipboard.position).project(camera);
        b.set(PAPER_WIDTH/2,PAPER_Y-PAPER_HEIGHT/2,PAPER_Z).applyQuaternion(clipboard.quaternion).add(clipboard.position).project(camera);
        placeSurface(paper.current,a,b,size.width,size.height,!paper.current.inert);
      }
    }
    if(highlight.current) {
      const focus=s.focus;
      highlight.current.visible=!!focus && !isGear(focus.target) && !s.panel && !f;
      if(focus&&highlight.current.visible) {
        highlight.current.position.set(...positions[focus.target].anchor).lerp(camera.position,.045);
        highlight.current.quaternion.copy(camera.quaternion);
      }
    }
    const audio=soundClock.current;
    audio.elapsed+=dt;
    const step=distance(before,s.pos);
    if(step>0&&step<.33&&!f&&!s.panel) {
      audio.walked+=step;
      if(audio.walked>=.88) {
        audio.walked=0;
        play('step',s.settings.sound);
      }
    }
    if(audio.elapsed>=.09) {
      audio.elapsed=0;
      const active=s.started&&!s.panel&&filmStage(s)!=='near-black'&&filmStage(s)!=='machine-black'&&f?.kind!=='incident'&&f?.kind!=='audit'&&f?.kind!=='ppe';
      updateAmbience(active,s.pos[1]>0,([0,1] as const).map(lane=>{
        const truck=f?.kind==='near'&&lane===(f.side===1?0:1)?encounterTruck(s)!:truckMotion(s,lane);
        const p:[number,number]=[truck.x,truck.z];
        return {distance:truck.visible||f?.kind==='near'?distance([m.x,m.z],p):100,pan:-Math.sin(angleDelta(m.yaw,turnTo([m.x,m.z],p)))};
      }));
    }
    const active=objective(s);
    const guide=trail.current!;
    guide.visible=s.started&&!s.panel&&!f&&!s.focus&&!s.safety.reported;
    if(guide.visible) {
      const target=guideTarget(s,active);
      const key=[target,s.roadClear,s.safety.door,Math.round(fov)].join('|');
      if(!guideCache.current || guideCache.current.key!==key || distance(s.pos,guideCache.current.at)>.32) {
        const point=positions[target].point;
        const path=s.roadClear?walkingRoute(s,point):route(s.pos,point,s.safety.door);
        plotGuide(guide,s.pos,path??[],1.72/(viewSlope*.44));
        guideCache.current={at:[...s.pos],key};
      }
    }
    for(const [id,v] of targetList) {
      const el=markers.current[id];
      if(!el) continue;
      projected.set(...v.anchor);
      const forward=cameraTarget.copy(projected).sub(camera.position).dot(viewPosition)>0;
      projected.project(camera);
      const visible=s.started && !s.panel && !f && (!s.focus || s.focus.target!==id) && visibleFrom(s,id) && forward &&
        Math.abs(projected.x)<.91 && Math.abs(projected.y)<.86 && !blockedView(s.pos,[v.anchor[0],v.anchor[2]],true) &&
        distance(s.pos,v.point)<27;
      el.style.visibility=visible?'visible':'hidden';
      if(visible) {
        el.style.left=`${(projected.x+1)*50}%`;
        el.style.top=`${(1-projected.y)*50}%`;
        el.dataset.primary=String(active===id);
      }
    }
    if(floor.current) {
      floor.current.visible=!!s.nav && !s.panel;
      if(s.nav) floor.current.position.set(s.nav.end[0],s.nav.end[1]<0?.131:.074,s.nav.end[1]);
    }
    const fingerprint=[filmStage(s),s.toastId,!!s.nav,s.panel,nearest(s),active,s.pressMode,s.pos[1]<-.55,
      s.focus?.target,usingCrossing(s),observed(s,'left'),observed(s,'right'),s.trafficSide,s.roadClear,s.gazeSelection,!!s.look].join('|');
    if(changed || observedNow || fingerprint!==lastUI.current) {
      lastUI.current=fingerprint;
      update();
    }
  });
  return <>
    <group ref={board} visible={false}><Batch boxes={heldBoard} shadows={false}/></group>
    <instancedMesh ref={trail} args={[undefined,undefined,DOT_CAPACITY]} visible={false} frustumCulled={false}>
      <circleGeometry args={[.053,8]}/><meshBasicMaterial color="#ffd28b" transparent opacity={.67} depthWrite={false}/>
    </instancedMesh>
    <mesh ref={floor} visible={false} rotation-x={-Math.PI/2}><ringGeometry args={[.24,.305,28]}/><meshBasicMaterial color="#ffd08a" transparent opacity={.83} depthWrite={false}/></mesh>
    <mesh ref={highlight} visible={false}><ringGeometry args={[.115,.125,24]}/><meshBasicMaterial color="#ffd08a" transparent opacity={.7} depthWrite={false}/></mesh>
  </>;
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

  </>;
}
function Stage(props:Props & {high:boolean}) {
  const s=props.session;
  const office=s.film?.kind==='incident'||s.film?.kind==='audit';
  return <>
    <fogExp2 attach="fog" args={['#bac6b3',.013]}/>
    <mesh><sphereGeometry args={[100,24,12]}/><shaderMaterial side={T.BackSide} depthWrite={false} vertexShader={skyVertex} fragmentShader={skyFragment}/></mesh>
    <Lights s={s} high={props.high}/>
    <Batch boxes={architecture}/>
    <Door s={s}/>
    <TruckRig s={s} lane={0}/>
    <TruckRig s={s} lane={1}/>
    <TruckRig s={s} lane={0} encounter/>
    <Machines s={s}/>
    <Preparation s={s}/>
    <HeldProps s={s}/>
    {s.film?.kind==='ppe'&&<PpeEffects s={s}/>}
    {office&&<Office s={s}/> }
    <Sign position={[0,3.69,.769]} w={9.97} h={1.16} title="SAFETY TRAINING CENTER" sub="THE TRAINING WORKS   /   VISITOR ENTRANCE" kind="main"/>
    <Sign position={[-10.6,2.16,19.65]} w={2.34} h={.6} title="SECURITY" sub="VISITOR CHECK-IN"/>
    <Sign position={[-16.9,1.58,4.455]} w={1.75} h={.45} title="CONTAINER 04" sub="WORKS LOGISTICS"/>
    <Sign position={[8.58,3.78,.454]} w={2.17} h={.55} title="WORKS / 01" sub="MANUFACTURING"/>
    <Sign position={[6.9,2.47,-4.576]} w={2.89} h={.27} title="SAFETY PREPARATION" sub="CHECK CONDITION BEFORE USE"/>
    <Sign position={[0,2.67,-.383]} rotation={Math.PI} w={1.64} h={.38} title="EXIT" sub="TO FORECOURT"/>
    {s.panel!=='mail'&&<Sign position={[7.6,1.92,-11.405]} w={1.46} h={1.09} title={hasMail(s.safety)&&!s.safety.mailDisposition?'NEW MESSAGE':'WORKS 98'} sub="LOCAL TRAINING TERMINAL"/>}
    {!s.started && <Html position={[0,.08,18.1]} center style={{pointerEvents:'none'}}><div className="world-beacon" aria-hidden="true"/></Html>}
    <Runner {...props}/>
  </>;
}
export default function World(props:Props) {
  const high=props.session.settings.quality==='high' || props.session.settings.quality==='auto' && !props.touch && (navigator.hardwareConcurrency || 4)>=6;
  return <Canvas className="scene" aria-label="First-person factory grounds and training facility" camera={{position:[0,2.16,22.7],near:.055,far:150,fov:79}} shadows={high} dpr={[.8,1.6]}
    gl={{powerPreference:props.touch?'low-power':'high-performance',antialias:!props.touch,alpha:false}}
    onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;}}>
    <Stage {...props} high={high}/>
  </Canvas>;
}
