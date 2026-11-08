import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import World, { type Markers } from './World';
import Portfolio from './Portfolio';
import { unlock, warmMusic } from './audio';
import { distance, positions, type Target } from './map';
import { checklist, equipment, equipped, hasMail, objective, reset, save, startSession, type Panel, type PortfolioTab, type Session } from './state';
import { checkTraffic, endFilm, mailDecision, navigate, nearest, openNearby, reachInside, record, say, startPress, stopPress, tagPress } from './engine';
import './style.css';

type IconName='warning'|'menu'|'speaker'|'mute'|'arrow'|'aim'|'finger'|'move'|'check'|'mail'|'close';
function Icon({name,size=20}:{name:IconName;size?:number}) {
  const paths:Record<IconName,ReactNode>={
    warning:<><path d="M12 3 2.4 20h19.2L12 3Z"/><path d="M12 9v4m0 3v.5"/></>,
    menu:<path d="M5 7h14M5 12h14M5 17h14"/>,
    speaker:<><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/></>,
    mute:<><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m16 10 5 5m0-5-5 5"/></>,
    arrow:<path d="M4 12h15m-6-6 6 6-6 6"/>,
    aim:<><path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M12 10v4m-2-2h4"/></>,
    finger:<path d="M10 16V6a2 2 0 0 1 4 0v6l1-1 2 1 3 2v3a5 5 0 0 1-5 5h-2l-6-6a1.6 1.6 0 0 1 2-2l1 2Z"/>,
    move:<path d="M12 3v18M3 12h18m-3-3 3 3-3 3M6 9l-3 3 3 3m3-9 3-3 3 3m-6 12 3 3 3-3"/>,
    check:<path d="m5 12 4 4L19 6"/>,
    mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    close:<path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Action({children,onClick,kind='neutral',disabled=false}:{children:ReactNode;onClick:()=>void;kind?:'neutral'|'primary'|'danger';disabled?:boolean}) {
  return <button type="button" className={'action '+kind} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Sheet({code,title,children,close,extra='',hideClose=false}:{code:string;title:string;children:ReactNode;close:()=>void;extra?:string;hideClose?:boolean}) {
  return <div className="sheet-layer"><section className={'sheet '+extra} role="dialog" aria-modal="true" aria-label={title}>
    <div className="sheet-grip"/>
    <header className="sheet-header"><div><div className="eyebrow"><span/>{code}</div><h2>{title}</h2></div>
      {!hideClose && <button className="icon-button close" aria-label="Close panel" onClick={close}><Icon name="close"/></button>}</header>
    <div className="sheet-body">{children}</div>
  </section></div>;
}

function PressPanel({s,panel,act,close}:{s:Session;panel:string;act:(fn:()=>void)=>void;close:()=>void}) {
  const press=panel[0]==='a'?'a':'b';
  const name=press.toUpperCase(), a=press==='a', status=s.safety.inspected[press], side=panel[1], failed=a&&!s.stoppedA;
  const right=side==='r';
  if(side) {
    const checked=right?status.right:status.left;
    return <Sheet code={'PRESS '+name+' / WALKAROUND'} title={right?'Right-side inspection':'Left-side inspection'} close={close}>
      <div className={'readout '+(a&&right?'danger-text':'')}><span className="status-light"/>
        {a&&right?'Guard rail is visibly bent and misaligned.':right?'Guard rail sits flush. Fasteners look intact.':'This side is unobstructed. The frame and fittings look intact.'}
      </div>
      <div className="buttons">
        <Action kind="primary" onClick={()=>act(()=>{record(s,press,right?'right':'left');if(a&&right)record(s,'a','guard');navigate(s,press);})}>
          {checked?'Back to controls':a&&right?'Document defect':'Record inspection'} <Icon name="arrow" size={17}/>
        </Action>
        <Action onClick={()=>act(()=>navigate(s,(press+(right?'l':'r')) as Target))}>Walk to {right?'left':'right'} side</Action>
      </div>
    </Sheet>;
  }
  const cycling=!a&&s.pressMode==='cycling', cycled=!a&&s.pressMode==='cycled';
  if(cycling || cycled) {
    return <Sheet code="PRESS B / SIMULATOR" title={cycling?'Cycle in motion':'Ram returned'} close={close} extra="cycle-sheet">
      <div className="readout"><span className="status-light"/>{cycling?'Keep hands clear and watch the ram.':'Safe position confirmed. Perform the simulated shutdown.'}</div>
      <Action kind={cycled?'primary':'neutral'} onClick={()=>act(()=>stopPress(s,'b'))}>{cycling?'Stop early':'Confirm shutdown'}</Action>
    </Sheet>;
  }
  return <Sheet code={'TRAINING BAY / '+(a?'01':'02')} title={'Press '+name+' controls'} close={close}>
    <div className={'readout '+(failed?'danger-text':'')}><span className="status-light"/>
      {a&&s.safety.tagged?'OUT OF SERVICE · guard defect reported':failed?'FAULT · press failed to cycle':!a&&s.safety.completed?'STOPPED · training operation recorded':'STOPPED · training simulator'}
    </div>
    {!equipped(s.safety) && <p className="panel-note">The marked bay requires safety glasses, safety footwear, and hearing protection.</p>}
    <div className="inspection-grid">
      <Action onClick={()=>act(()=>record(s,press,'stopped'))}><span className="flag">{status.stopped?'✓':'□'}</span>Confirm stopped</Action>
      <Action onClick={()=>act(()=>record(s,press,'area'))}><span className="flag">{status.area?'✓':'□'}</span>Inspect surroundings</Action>
      <Action onClick={()=>act(()=>navigate(s,(press+'l') as Target))}><span className="flag">{status.left?'✓':'□'}</span>Inspect left side</Action>
      <Action onClick={()=>act(()=>navigate(s,(press+'r') as Target))}><span className="flag">{status.right?'✓':'□'}</span>Inspect right side</Action>
      {!a && <><Action onClick={()=>act(()=>record(s,'b','guard'))}><span className="flag">{status.guard?'✓':'□'}</span>Verify guards</Action>
      <Action onClick={()=>act(()=>record(s,'b','clear'))}><span className="flag">{status.clear?'✓':'□'}</span>Keep hands clear</Action></>}
    </div>
    <div className="machine-buttons">
      <Action kind="primary" disabled={a&&(failed||s.safety.tagged)} onClick={()=>act(()=>startPress(s,press))}>Start simulation</Action>
      {a&&<Action disabled={s.safety.tagged} onClick={()=>act(()=>stopPress(s,'a'))}>Stop</Action>}
    </div>
    {a && <div className="buttons report-buttons">
      <Action disabled={s.safety.tagged} onClick={()=>act(()=>tagPress(s))}>Report &amp; attach tag</Action>
      {failed&&<Action kind="danger" onClick={()=>act(()=>reachInside(s))}>Reach into tooling</Action>}
    </div>}
    <p className="fine-print">Fictional training controls. Servicing requires authorized lockout/tagout.</p>
  </Sheet>;
}

function FilmOverlay({s,skip}:{s:Session;skip:()=>void}) {
  const f=s.film!;
  if(f.kind==='both') return <div className="film"><div className="film-caption"><span className="eyebrow">CROSSING SIGNAL</span><strong>{f.time<2.75?'Traffic from the right.':f.time<5.35?'Traffic from the left.':'Wait for the road to clear.'}</strong></div></div>;
  if(f.kind==='near' && f.time<1.47) return <div className="film near-flash"><div className="film-caption"><Icon name="warning"/> <strong>Truck approaching</strong></div></div>;
  if(f.kind==='failure' && f.time<.43) return <div className="film near-flash"/>;
  if(f.kind==='near' || f.kind==='failure') {
    const road=f.kind==='near', reach=f.reason==='reach';
    return <div className="film black"><div className="film-message"><Icon name="warning" size={34}/><h2>{road?'That was dangerous.':reach?'Never reach inside malfunctioning equipment.':'The press wasn’t ready.'}</h2>
      <p>{road?'Always use designated pedestrian crossings.':reach?'Stop, report, and follow authorized isolation procedures.':'Finish the inspections, verify the guards, and keep hands clear before starting.'}</p>
      <button className="text-button" onClick={skip}>Return to checkpoint <Icon name="arrow" size={17}/></button></div></div>;
  }
  if(f.time<.58) return <div className="film glitch"><b>WORKSTATION CONNECTION LOST</b></div>;
  if(f.time<2.6 || f.time>=12.45) return <div className="film black"><div className="film-message"><span className="eyebrow">THE TRAINING WORKS</span><h2>{f.time<2.6?'ONE WEEK LATER...':'Think before you click.'}</h2><button className="text-button" onClick={skip}>Skip scene <Icon name="arrow" size={17}/></button></div></div>;
  return <div className="film incident">
    <div className="letterbox"/>
    <div className="film-caption">
      <span className="eyebrow">{f.time<5.9?'CEO':f.time<9.7?'IT RESPONSE':'CEO'}</span>
      <strong>{f.time<5.9?'The training files are locked. Who opened the attachment?':f.time<9.7?'We traced it to the fake compliance email. The incident team is isolating affected systems.':'Next time, report the email before opening anything.'}</strong>
      <button className="text-button" onClick={skip}>Skip scene <Icon name="arrow" size={16}/></button>
    </div>
  </div>;
}

const label:Record<Target,string>={crossing:'Zebra crossing',arrival:'Cross the road',door:'Open the entrance',ppe:'PPE station',checklist:'Checklist',a:'Press A',al:'Left side',ar:'Right side',b:'Press B',bl:'Left side',br:'Right side',mail:'Workstation'};
function direction(s:Session) {
  const target=objective(s);
  if(s.safety.reported) return 'Explore the training center.';
  if(target==='crossing') return 'Find your way to the training center.';
  if(target==='arrival') return 'The road is clear. Use the zebra stripes.';
  if(target==='door') return 'Follow the walkway to the entrance.';
  if(target==='ppe') return s.pos[1]>-.5?'Walk through the entrance.':'Find the PPE station.';
  if(target==='mail') return 'Check the workstation.';
  if(s.safety.completed&&!s.safety.tagged) return 'Inspect and report the fault on Press A.';
  return 'Inspect the presses in the training bay.';
}

class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() {return this.state.failed?<div className="scene-fallback">The 3D scene needs a browser with WebGL 2 enabled. You can still open the portfolio.</div>:this.props.children;}
}
function App() {
  const [s]=useState(startSession);
  const [,setRevision]=useState(0);
  const update=useCallback(()=>setRevision(n=>n+1),[]);
  const [touch,setTouch]=useState(()=>matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints>0 && innerWidth<800);
  const [toast,setToast]=useState('');
  const keys=useRef(new Set<string>()).current;
  const markers=useRef<Markers>({});
  const resumePanel=useRef<Panel|null>(null);
  const wasLocked=useRef(false);
  const action=useCallback((fn:()=>void)=>{
    if(s.settings.sound) unlock();
    fn();
    if(s.panel || s.film) document.exitPointerLock?.();
    update();
  },[s,update]);
  const close=useCallback(()=>action(()=>{
    if(s.panel==='portfolio') s.panel=s.portfolioBack;
    else if(s.panel==='settings'||s.panel==='restart') s.panel='pause';
    else if(s.panel==='pause') s.panel=resumePanel.current;
    else s.panel=null;
  }),[s,action]);
  const pause=useCallback(()=>action(()=>{
    if(s.panel==='pause') s.panel=resumePanel.current;
    else if(s.panel==='settings'||s.panel==='restart') s.panel='pause';
    else if(s.panel==='portfolio') s.panel=s.portfolioBack;
    else {
      resumePanel.current=s.panel;
      s.nav=null;
      s.panel='pause';
    }
  }),[s,action]);
  useEffect(()=>{
    const media=matchMedia('(pointer: coarse)');
    const change=()=>setTouch(media.matches || navigator.maxTouchPoints>0 && innerWidth<800);
    media.addEventListener('change',change);window.addEventListener('resize',change);
    return ()=>{media.removeEventListener('change',change);window.removeEventListener('resize',change);};
  },[]);
  useEffect(()=>{
    if(!s.toastId || !s.notification) return;
    setToast(s.notification);
    const timer=setTimeout(()=>setToast(''),s.notification.includes('MAIL')?4300:3500);
    return ()=>clearTimeout(timer);
  },[s.toastId,s.notification]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      const key=e.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key) && !s.panel && !s.film) {
        e.preventDefault();
        keys.add(key);
      }
      if(e.repeat) return;
      if(key==='escape') {e.preventDefault(); pause();}
      if(key==='e' && s.started && !s.panel && !s.film) action(()=>openNearby(s,nearest(s)));
    };
    const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
    const clear=()=>keys.clear();
    const lock=()=>{
      const now=!!document.pointerLockElement;
      if(!now && wasLocked.current && s.started && !s.panel && !s.film) pause();
      wasLocked.current=now;
    };
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
    document.addEventListener('pointerlockchange',lock);
    return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('pointerlockchange',lock);};
  },[s,keys,pause,action]);
  useEffect(()=>{if(s.panel || s.film) {keys.clear();document.exitPointerLock?.();}},[s.panel,s.film,keys]);
  const panel=s.panel;
  const active=objective(s);
  const near=nearest(s);
  const live=s.started && !panel && !s.film;
  const portfolio=(tab:PortfolioTab,back:'pause'|'mail'|'welcome')=>action(()=>{s.portfolioTab=tab;s.portfolioBack=back;s.panel='portfolio';});
  const to=(target:Target)=>action(()=>openNearby(s,target));
  const toggleSound=()=>action(()=>{
    s.settings.sound=!s.settings.sound;
    if(s.settings.sound) unlock();
    if(s.safety.reported) warmMusic(s.settings.sound);
    save(s);
  });
  const skip=()=>action(()=>endFilm(s));
  const back=()=>action(()=>{s.panel=null;});
  return <main className={'game '+(touch?'touch':'desktop')+(s.settings.reduced?' reduced':'')} aria-label="Safety Quest">
    <SceneBoundary><World session={s} keys={keys} markers={markers} update={update} touch={touch}/></SceneBoundary>
    <div className={'grade '+(panel==='welcome'?'welcome-grade':'')} aria-hidden="true"/>
    <header className="hud-top">
      <div className="brand"><span className="brand-mark"><Icon name="warning" size={20}/></span><span><b>SAFETY QUEST</b><small>THE TRAINING WORKS</small></span></div>
      <div className="hud-actions">
        <button className="icon-button" aria-label={s.settings.sound?'Mute audio':'Unmute audio'} onClick={toggleSound}><Icon name={s.settings.sound?'speaker':'mute'}/></button>
        <button className="icon-button" aria-label="Pause menu" onClick={pause}><Icon name="menu"/></button>
      </div>
    </header>
    {panel==='welcome'&&<div className="welcome">
      <div className="welcome-inner">
        <div className="eyebrow"><span/> VISITOR SIMULATION <i/> WORKS / 01</div>
        <h1>Safety<span>Quest<span className="title-stop">.</span></span></h1>
        <p>Clock in at a voxel factory. A few ordinary decisions can change how your shift ends.</p>
        <div className="welcome-actions">
          <Action kind="primary" onClick={()=>action(()=>{
            s.started=true;s.panel=null;
            if(s.safety.reported) warmMusic(s.settings.sound);
            else say(s,direction(s));
          })}>{s.checkpoint==='outside'&&!s.safety.crossed?'Enter the grounds':'Continue the shift'} <Icon name="arrow"/></Action>
          <button className="text-button" onClick={()=>portfolio('About Me','welcome')}>Developer portfolio <span aria-hidden>↗</span></button>
        </div>
        <div className="control-hints">
          {touch?<><span><Icon name="finger" size={16}/> Tap to walk</span><span><Icon name="move" size={16}/> Swipe to look</span></>:
          <><span><kbd>WASD</kbd> Walk</span><span><kbd>MOUSE</kbd> Look</span><span><kbd>E</kbd> Interact</span></>}
        </div>
      </div>
      <div className="welcome-credit">DESIGNED &amp; DEVELOPED BY AULIA ILHAM NUR ALFIAN</div>
    </div>}
    <div className="markers" aria-label="World interactions">
      {(Object.keys(positions) as Target[]).map(id=><button key={id} className="marker" ref={el=>{if(el)markers.current[id]=el;else delete markers.current[id];}} aria-label={positions[id].name} onClick={()=>{if(s.started && !s.panel && !s.film) to(id);}}>
        <span className="marker-sigil"><Icon name={id==='mail'?'mail':'aim'} size={19}/></span><span className="marker-name">{label[id]}</span>
      </button>)}
    </div>
    {live&&<div className="hud-play">
      {!touch&&<div className="reticle" aria-hidden="true"/>}
      {!touch&&near&&<div className="interact-hint"><kbd>E</kbd> {label[near]}</div>}
      {equipped(s.safety)&&<div className="ppe-chip" title="Safety glasses, safety footwear, and hearing protection equipped"><Icon name="check" size={14}/> PPE</div>}
      <div className="guide">
        {s.nav?<button className="guide-button" onClick={()=>action(()=>{s.nav=null;say(s,'Walk stopped.');})}><span className="guide-dot"/> Stop walking</button>:
         touch&&!s.safety.reported ? <button className="guide-button" aria-label={'Navigate to '+label[active]} onClick={()=>to(active)}><Icon name="aim" size={17}/>{direction(s)}<span aria-hidden>›</span></button>:
         <div className="guide-text"><Icon name="aim" size={16}/>{direction(s)}</div>}
      </div>
    </div>}
    {toast&&s.started&&!s.film&&<div className={'toast '+(toast.includes('MAIL')?'mail-toast':'')} role="status" key={s.toastId}><Icon name={toast.includes('MAIL')?'mail':'aim'} size={18}/>{toast}</div>}
    {s.film&&<FilmOverlay s={s} skip={skip}/>}
    {panel==='pause'&&<Sheet code="VISITOR TERMINAL / PAUSED" title="Safety Quest" close={close} extra="pause-sheet">
      <div className="buttons"><Action kind="primary" onClick={close}>Resume <Icon name="arrow"/></Action></div>
      <div className="pause-links">{(['About Me','CV / Résumé','Projects','Contact'] as PortfolioTab[]).map(tab=><Action key={tab} onClick={()=>portfolio(tab,'pause')}>{tab}</Action>)}</div>
      <div className="buttons"><Action onClick={()=>action(()=>{s.panel='settings';})}>Controls &amp; Settings</Action><Action onClick={()=>action(()=>{s.panel='restart';})}>Restart Experience</Action></div>
      <p className="fine-print">Designed &amp; Developed by Aulia Ilham Nur Alfian</p>
    </Sheet>}
    {panel==='settings'&&<Sheet code="VISITOR TERMINAL / PREFERENCES" title="Controls & Settings" close={close}>
      <p>{touch?'Tap ground to walk, tap again to stop. Drag the view to look. Tap a door, object, or glowing marker to approach and interact.':'WASD to move. Click the scene to capture the mouse, then look around. Press E near an object to interact, or Esc to pause.'}</p>
      <div className="settings-row"><span>Audio</span><button className="switch" aria-pressed={s.settings.sound} onClick={toggleSound}>{s.settings.sound?'On':'Off'}</button></div>
      <div className="settings-row"><span>Reduced motion</span><button className="switch" aria-pressed={s.settings.reduced} onClick={()=>action(()=>{s.settings.reduced=!s.settings.reduced;save(s);})}>{s.settings.reduced?'On':'Off'}</button></div>
      <label className="settings-row">Graphics<select value={s.settings.quality} onChange={e=>action(()=>{s.settings.quality=e.target.value as typeof s.settings.quality;save(s);})}><option value="auto">Automatic</option><option value="low">Low</option><option value="high">High</option></select></label>
      {document.fullscreenEnabled&&<Action onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else void document.documentElement.requestFullscreen().catch(()=>{});}}>Toggle fullscreen</Action>}
      <p className="fine-print">Fictional workplace simulation. Follow site rules and authorized procedures around real equipment.</p>
    </Sheet>}
    {panel==='restart'&&<Sheet code="VISITOR TERMINAL / RESTART" title="Restart this shift?" close={close}>
      <p>Return to the outdoor arrival point and clear this shift’s training record.</p>
      <div className="buttons"><Action kind="danger" onClick={()=>action(()=>{reset(s);warmMusic(false);setToast('');resumePanel.current=null;})}>Restart from arrival</Action><Action onClick={close}>Keep current shift</Action></div>
    </Sheet>}
    {panel==='traffic'&&<Sheet code="PEDESTRIAN ROUTE / ZEBRA CROSSING" title="Check the road" close={back}>
      <p>Trucks use both lanes. How will you check for traffic?</p>
      <div className="buttons traffic-buttons">
        <Action kind="primary" onClick={()=>action(()=>checkTraffic(s,'both'))}>Look both directions <Icon name="arrow" size={18}/></Action>
        <div className="two"><Action onClick={()=>action(()=>checkTraffic(s,'left'))}>← Look left</Action><Action onClick={()=>action(()=>checkTraffic(s,'right'))}>Look right →</Action></div>
        <Action kind="danger" onClick={()=>action(()=>checkTraffic(s,'none'))}>Cross without checking</Action>
      </div>
    </Sheet>}
    {panel==='ppe'&&<Sheet code="EQUIPMENT / TRAINING BAY" title="PPE station" close={back}>
      <p>Choose the equipment posted for this bay.</p>
      <div className="equipment">{equipment.map(([id,name,symbol,feedback],i)=>{
        const checked=s.safety.ppe.includes(id);
        return <button className="equipment-item" key={id} type="button" aria-pressed={checked} onClick={()=>action(()=>{
          if(i>=3) say(s,feedback);
          else {
            s.safety.ppe=checked?s.safety.ppe.filter(item=>item!==id):[...s.safety.ppe,id];
            save(s);
            if(equipped(s.safety)) say(s,'PPE fitted. The press bay is ready to inspect.');
          }
        })}><span className="equipment-icon">{symbol}</span><b>{name}</b><span aria-hidden>{checked?'✓':'+'}</span></button>;
      })}</div>
      <Action kind="primary" onClick={back}>Close cabinet <Icon name="arrow" size={17}/></Action>
    </Sheet>}
    {panel==='checklist'&&<Sheet code="TRAINING BAY / WORK INSTRUCTIONS" title="Safety checklist" close={back}>
      <ul className="checklist">{checklist(s.safety).map(([text,done])=><li key={text}><span className={done?'checked':''} aria-label={done?'Confirmed':'Pending'}>{done?'✓':'□'}</span>{text}</li>)}</ul>
      <p className="fine-print">Press servicing is restricted to personnel authorized for isolation and lockout/tagout.</p>
    </Sheet>}
    {panel&&/^[ab][lr]?$/.test(panel)&&<PressPanel s={s} panel={panel} act={action} close={back}/>}
    {panel==='mail'&&<Sheet code="WORKS OS / LOCAL WORKSTATION" title={s.safety.reported?'Message secured':hasMail(s.safety)?'Works Mail':'Works Terminal'} close={back} extra="mail-sheet">
      {s.safety.reported ? <>
        <div className="readout success-text"><span className="status-light"/> {s.safety.mailDisposition==='ignore'?'Suspicious attachment left unopened.':'Suspicious message sent to security.'}</div>
        <h3>Curious who built this experience?</h3><p>A personnel directory is available on this workstation.</p>
        <Action kind="primary" onClick={()=>portfolio('About Me','mail')}>Meet the Developer <Icon name="arrow" size={17}/></Action>
      </> : hasMail(s.safety) ? <>
        <div className="email"><div className="record-label">UNREAD / EXTERNAL</div><h3>URGENT · Signed audit form required</h3>
        <p className="sender">From: compliance@works-audit.example</p>
        <p>Open the attached form within 10 minutes. Your site access will be suspended if you delay. Keep this request confidential.</p>
        <div className="attachment"><span>▧</span><div><b>Audit_Form_Immediate.pdf</b><small>Unexpected attachment · simulated</small></div></div></div>
        <div className="buttons"><Action kind="primary" onClick={()=>action(()=>mailDecision(s,'report'))}>Report suspicious email</Action>
        <Action onClick={()=>action(()=>mailDecision(s,'ignore'))}>Ignore attachment</Action>
        <Action kind="danger" onClick={()=>action(()=>mailDecision(s,'open'))}>Open attachment</Action></div>
      </>:<div className="readout"><span className="status-light"/> No unread mail. The workstation is on standby.</div>}
    </Sheet>}
    {panel==='portfolio'&&<div className="terminal-layer"><Portfolio tab={s.portfolioTab} change={tab=>action(()=>{s.portfolioTab=tab;})} close={close}/></div>}
    <div className="lower-code" aria-hidden="true"><span/> FICTIONAL TRAINING SITE <i/> 01</div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
