import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import World, { type Markers } from './World';
import Portfolio from './Portfolio';
import { Action, Icon, Sheet } from './components';
import { Cabinet, Clipboard, Ending, FilmOverlay, InspectionFocus } from './ShiftPanels';
import { Workstation } from './Workstation';
import { audioStatus, onAudioStatus, play, setAudioLevel, unlock, warmMusic } from './audio';
import { gear, isGear, machinePart, positions, type Target } from './map';
import { equipped, objective, observed, reset, save, startSession, usingCrossing, type Panel, type PortfolioTab, type Session } from './state';
import { continueFilm, gearAction, interact, nearest, openNearby, say, skipFilm, turnHead } from './engine';
import './style.css';

function label(target:Target) {
  if(target==='arrival'||target==='arrival-south') return 'Opposite curb';
  if(target==='door') return 'Training entrance';
  if(target==='ppe') return 'PPE cabinet';
  return positions[target].name;
}

function direction(s:Session) {
  const active=objective(s);
  if(usingCrossing(s)) {
    if(s.roadClear) return 'Road clear. Cross now.';
    if(s.trafficSide) return `Truck approaching from the ${s.trafficSide}. Wait at the curb.`;
    return 'Look left and right from the curb.';
  }
  if(active==='crossing') return 'Approach the zebra crossing.';
  if(active==='door') return 'Follow the entrance sign.';
  if(active==='ppe') return 'Find the PPE cabinet inside.';
  if(s.safety.reported) return 'The training works are open to explore.';
  if(active==='mail') return s.safety.mailDisposition?'Review your inspection clipboard.':'A message arrived at the workstation.';
  return label(active);
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
  const monitor=useRef<HTMLDivElement>(null);
  const paper=useRef<HTMLDivElement>(null);
  useEffect(()=>onAudioStatus(update),[update]);
  const resumePanel=useRef<Panel|null>(null);
  const wasLocked=useRef(false);
  const action=useCallback((fn:()=>void)=>{
    setAudioLevel(s.settings.sound,s.settings.volume);
    if(s.settings.sound) unlock();
    fn();
    setAudioLevel(s.settings.sound,s.settings.volume);
    if((s.panel || s.film) && document.pointerLockElement) document.exitPointerLock();
    update();
  },[s,update]);
  const close=useCallback(()=>action(()=>{
    if(s.panel==='clipboard') {
      s.panel=s.clipboardBack;
      s.clipboardBack=null;
      play('paper',s.settings.sound);
    } else if(s.panel==='portfolio') s.panel=s.portfolioBack;
    else if(s.panel==='settings'||s.panel==='restart') s.panel='pause';
    else if(s.panel==='pause') s.panel=resumePanel.current;
    else {
      s.panel=null;
      s.focus=null;
      s.look=null;
    }
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
  const raiseClipboard=useCallback(()=>action(()=>{
    if(!s.safety.clipboard || s.film || !s.started) return;
    play('paper',s.settings.sound);
    if(s.panel==='clipboard') {
      s.panel=s.clipboardBack;
      s.clipboardBack=null;
      return;
    }
    s.nav=null;
    s.focus=null;
    s.look=null;
    s.clipboardBack=s.panel;
    s.panel='clipboard';
  }),[action,s]);
  const switchControl=()=>action(()=>{
    s.settings.control=s.settings.control==='trackpad'?'mouse':'trackpad';
    if(document.pointerLockElement) {
      wasLocked.current=false;
      document.exitPointerLock();
    }
    save(s);
    if(s.started) say(s,s.settings.control==='trackpad'?'Trackpad controls: drag to look and click to walk.':'Mouse look: click open space to capture the pointer.');
  });
  useEffect(()=>{
    const media=matchMedia('(pointer: coarse)');
    const change=()=>setTouch(media.matches || navigator.maxTouchPoints>0 && innerWidth<800);
    media.addEventListener('change',change);window.addEventListener('resize',change);
    return ()=>{media.removeEventListener('change',change);window.removeEventListener('resize',change);};
  },[]);
  useEffect(()=>{
    if(!s.toastId) return;
    setToast(s.notification);
    const timer=setTimeout(()=>setToast(''),s.notification.includes('mail')?4300:3400);
    return ()=>clearTimeout(timer);
  },[s.toastId,s.notification]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      const key=e.key.toLowerCase();
      if(e.altKey || e.ctrlKey || e.metaKey || (e.target instanceof HTMLInputElement && key!=='escape' && key!=='c')) return;
      if(s.started && s.settings.sound && audioStatus()!=='running') unlock();
      if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(key) && !s.panel && !s.film) {
        e.preventDefault();
        keys.add(key);
      }
      if(e.repeat) return;
      if(key==='escape') {
        e.preventDefault();
        if(s.film) return;
        if(s.panel==='clipboard' || s.panel==='cabinet' || s.panel==='mail' || s.panel==='ending' || s.focus) close();
        else pause();
      }
      if(key==='c' && s.started && !s.film && (!s.panel || s.panel==='clipboard')) {
        e.preventDefault();
        raiseClipboard();
      }
      if(key==='f' && s.started && !s.panel && !s.film) {
        e.preventDefault();
        action(()=>{
          if(s.focus && isGear(s.focus.target)) gearAction(s,s.focus.target);
          else openNearby(s,nearest(s));
        });
      }
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
  },[s,keys,pause,action,close,raiseClipboard]);
  const panel=s.panel;
  const playing=s.started && !panel && !s.film;
  useEffect(()=>{if(!playing) {
    keys.clear();
    if(document.pointerLockElement) document.exitPointerLock();
  }},[playing,keys]);
  const near=nearest(s);
  const atCurb=usingCrossing(s);
  const portfolio=(tab:PortfolioTab,back:Session['portfolioBack'])=>action(()=>{s.portfolioTab=tab;s.portfolioBack=back;s.panel='portfolio';});
  const to=(target:Target)=>action(()=>openNearby(s,target));
  const toggleSound=()=>action(()=>{
    s.settings.sound=!s.settings.sound;
    setAudioLevel(s.settings.sound,s.settings.volume);
    if(s.settings.sound) {unlock();play('ui',true);}
    if(s.panel==='ending') warmMusic(s.settings.sound);
    save(s);
  });
  const skip=()=>action(()=>skipFilm(s));
  const next=()=>action(()=>continueFilm(s));
  const keyHint=s.settings.lookKeys==='arrows'?'ARROWS':'Q/E + ↑↓';
  return <main className={'game '+(touch?'touch':'desktop')+(s.settings.reduced?' reduced':'')} aria-label="Safety Quest">
    <SceneBoundary><World session={s} keys={keys} markers={markers} update={update} touch={touch} monitor={monitor} paper={paper}/></SceneBoundary>
    <div className={'grade '+(panel==='welcome'?'welcome-grade':'')} aria-hidden="true"/>
    <header className="hud-top">
      <div className="brand"><span className="brand-mark"><Icon name="warning" size={20}/></span><span><b>SAFETY QUEST</b><small>THE TRAINING WORKS</small></span></div>
      <div className="hud-actions">
        {!touch&&(playing||panel==='welcome')&&<button className="control-toggle" aria-label="Switch control mode" onClick={switchControl}>
          <Icon name={s.settings.control==='trackpad'?'finger':'aim'} size={16}/><span>{s.settings.control==='trackpad'?'Trackpad':'Mouse look'}</span>
        </button>}
        {s.settings.sound && audioStatus()==='blocked' ?
          <button className="control-toggle" onClick={()=>action(()=>unlock())}><Icon name="speaker" size={16}/>Enable Sound</button>:
          <button className="icon-button" aria-pressed={s.settings.sound} aria-label={s.settings.sound?'Mute audio':'Unmute audio'} onClick={toggleSound}><Icon name={s.settings.sound?'speaker':'mute'}/></button>}
        <button className="icon-button" aria-label="Pause menu" disabled={!!s.film} onClick={pause}><Icon name="menu"/></button>
      </div>
    </header>
    {panel==='welcome'&&<div className="welcome">
      <div className="welcome-inner">
        <div className="eyebrow"><span/> AN INTERACTIVE PORTFOLIO EXPERIENCE</div>
        <h1>Safety<span>Quest<span className="title-stop">.</span></span></h1>
        <p className="welcome-subtitle">A first-person manufacturing safety simulation</p>
        <p className="creator">Created by <strong>Aulia Ilham Nur Alfian</strong></p>
        <div className="welcome-actions">
          <Action kind="primary" onClick={()=>action(()=>{
            s.started=true;s.panel=null;
            say(s,direction(s));
          })}>{s.checkpoint==='outside'&&!s.safety.crossed?'Enter the factory':'Continue the shift'} <Icon name="arrow"/></Action>
          <button className="text-button" onClick={()=>portfolio('About Me','welcome')}>View professional portfolio <span aria-hidden>↗</span></button>
          <a className="creator-link" href="https://ilhmnra.github.io/" target="_blank" rel="noreferrer">ilhmnra.github.io <span aria-hidden>↗</span></a>
        </div>
        <div className="control-hints">
          {touch?<><span><Icon name="finger" size={16}/> Tap to walk</span><span><Icon name="move" size={16}/> Swipe to look</span></>:
          <><span><kbd>WASD</kbd> Walk</span><span><kbd>{s.settings.control==='trackpad'?keyHint:'CLICK'}</kbd> {s.settings.control==='trackpad'?'Look':'Capture mouse'}</span><span><kbd>F</kbd> Interact</span></>}
        </div>
      </div>
    </div>}
    <div className="markers" aria-label="World interactions">
      {(Object.keys(positions) as Target[]).map(id=>{
        const part=machinePart(id)?.[1];
        return <button key={id} className={'marker '+(isGear(id)||part&&part!=='front'?'detail-marker':'')} ref={el=>{if(el)markers.current[id]=el;else delete markers.current[id];}}
          aria-label={positions[id].name} title={positions[id].name} onClick={()=>{if(s.started && !s.panel && !s.film) to(id);}}>
          <span className="marker-sigil"><Icon name={id==='mail'?'mail':'aim'} size={part&&part!=='front'?14:19}/></span>
          <span className="marker-name">{part==='start'?'START':part==='stop'?'STOP':label(id)}</span>
        </button>;
      })}
    </div>
    {playing&&<div className="hud-play">
      {!touch&&<div className="reticle" aria-hidden="true"/>}
      {!touch&&near&&!s.focus&&<div className="interact-hint"><kbd>F</kbd> {label(near)}</div>}
      {atCurb&&<div className="gaze-rail" aria-label="Look along the roadway">
        {(['left','center','right'] as const).map(side=>{
          const selected=s.gazeSelection===side, seen=side!=='center'&&observed(s,side), moving=selected&&!!s.look;
          return <button key={side} aria-label={'Look '+side} aria-pressed={selected} data-observed={seen} onClick={()=>action(()=>turnHead(s,side))}>
            <span aria-hidden>{side==='left'?'‹':side==='right'?'›':'·'}</span>
            <span>{side.toUpperCase()}<small>{moving?'Turning':seen?'Checked':selected?'Facing':'Look'}</small></span>
          </button>;
        })}
      </div>}
      {s.pos[1]<-.65&&(s.safety.collectedPpe.length>0||s.safety.tagHeld||s.safety.tagged)&&<div className="ppe-chip" aria-label="Equipment">
        {s.safety.ppe.map(id=><span key={id} data-damaged={!gear[id].sound} title={positions[id].name}>{gear[id].slot==='eyes'?'◉':gear[id].slot==='ears'?'Ω':'▰'}</span>)}
        {equipped(s.safety)&&<span>PPE</span>}
        {s.safety.tagHeld&&<span className="held-tag" title="Out-of-service tag carried">TAG</span>}
        {!s.safety.ppe.length&&!s.safety.tagHeld&&<span>Equipment</span>}
      </div>}
      {atCurb&&!s.focus&&<div className="guide"><div className="guide-text" role="status"><Icon name={s.trafficSide?'warning':'aim'} size={16}/> {direction(s)}</div></div>}
    </div>}
    {s.safety.clipboard&&(playing||panel==='clipboard')&&<button className="clipboard-key" aria-pressed={panel==='clipboard'} title="Raise or lower the clipboard (C)" onClick={raiseClipboard}><span aria-hidden="true">▤</span><span>CLIPBOARD<small>{panel==='clipboard'?'Open':'Closed'}</small></span></button>}
    {playing&&s.focus&&<InspectionFocus s={s} act={action} close={close}/>}
    {toast&&s.started&&!s.film&&!s.focus&&panel!=='ending'&&<div className="toast" role="status" key={s.toastId}><Icon name={toast.includes('mail')?'mail':'aim'} size={18}/>{toast}</div>}
    {s.film&&<FilmOverlay s={s} next={next} skip={skip}/>}
    {panel==='pause'&&<Sheet code="VISITOR TERMINAL / PAUSED" title="Safety Quest" close={close} extra="pause-sheet">
      <div className="buttons"><Action kind="primary" onClick={close}>Resume <Icon name="arrow"/></Action></div>
      <div className="pause-links">{(['About Me','CV / Résumé','Projects','Contact'] as PortfolioTab[]).map(tab=><Action key={tab} onClick={()=>portfolio(tab,'pause')}>{tab}</Action>)}</div>
      <div className="buttons"><Action onClick={()=>action(()=>{s.panel='settings';})}>Controls &amp; Settings</Action><Action onClick={()=>action(()=>{s.panel='restart';})}>Restart Experience</Action></div>
      <p className="fine-print">Created by Aulia Ilham Nur Alfian</p>
    </Sheet>}
    {panel==='settings'&&<Sheet code="VISITOR TERMINAL / PREFERENCES" title="Controls & Settings" close={close}>
      <p>{touch?'Tap ground to walk. Drag to look. Tap objects or markers to approach and interact.':
        'WASD moves. Drag to look, or use the look keys. Press F to interact, C for the clipboard, and Esc to pause.'}</p>
      {!touch&&<>
        <div className="settings-row"><span>Control mode</span><button className="switch" onClick={switchControl}>{s.settings.control==='trackpad'?'Trackpad':'Mouse look'}</button></div>
        <label className="settings-row">Horizontal look keys<select value={s.settings.lookKeys} onChange={e=>action(()=>{s.settings.lookKeys=e.target.value as typeof s.settings.lookKeys;save(s);})}><option value="arrows">Arrow left / right</option><option value="qe">Q / E</option></select></label>
        <p className="fine-print">Arrow up and down control pitch in either mode. Mouse look captures the pointer when you click the scene.</p>
      </>}
      <div className="settings-row"><span>Audio</span><button className="switch" aria-pressed={s.settings.sound} onClick={toggleSound}>{s.settings.sound?'On':'Off'}</button></div>
      <label className="settings-row">Volume<input aria-label="Volume" type="range" min="0" max="1" step=".05" value={s.settings.volume} onChange={e=>action(()=>{s.settings.volume=Number(e.target.value);save(s);})}/></label>
      <div className="settings-row"><span>Reduced motion</span><button className="switch" aria-pressed={s.settings.reduced} onClick={()=>action(()=>{s.settings.reduced=!s.settings.reduced;save(s);})}>{s.settings.reduced?'On':'Off'}</button></div>
      <label className="settings-row">Field of view <input aria-label="Field of view" type="range" min="65" max="90" step="1" value={s.settings.fov} onChange={e=>action(()=>{s.settings.fov=Number(e.target.value);save(s);})}/></label>
      <label className="settings-row">Graphics<select value={s.settings.quality} onChange={e=>action(()=>{s.settings.quality=e.target.value as typeof s.settings.quality;save(s);})}><option value="auto">Automatic</option><option value="low">Low</option><option value="high">High</option></select></label>
      {document.fullscreenEnabled&&<Action onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else void document.documentElement.requestFullscreen().catch(()=>{});}}>Toggle fullscreen</Action>}
      <p className="fine-print">Fictional workplace simulation. Servicing real equipment requires authorized isolation and lockout/tagout.</p>
    </Sheet>}
    {panel==='restart'&&<Sheet code="VISITOR TERMINAL / RESTART" title="Restart this shift?" close={close}>
      <p>Return to the outdoor arrival point and clear this shift’s training record.</p>
      <div className="buttons"><Action kind="danger" onClick={()=>action(()=>{reset(s);warmMusic(false);setToast('');resumePanel.current=null;})}>Restart from arrival</Action><Action onClick={close}>Keep current shift</Action></div>
    </Sheet>}
    {panel==='cabinet'&&<Cabinet s={s} act={action} close={close} inspect={id=>action(()=>interact(s,id))} tag={()=>action(()=>interact(s,'tag'))}/>}
    {s.started&&s.safety.clipboard&&<Clipboard s={s} act={action} close={close} paper={paper}/>}
    {panel==='mail'&&<Workstation s={s} act={action} close={close} monitor={monitor} clipboard={raiseClipboard}/>}
    {panel==='ending'&&<Ending explore={close} open={tab=>portfolio(tab,'ending')}/>}
    {panel==='portfolio'&&<div className="terminal-layer"><Portfolio tab={s.portfolioTab} change={tab=>action(()=>{s.portfolioTab=tab;})} close={close}/></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
