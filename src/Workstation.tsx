import { useState, type RefObject } from 'react';
import { Icon } from './components';
import Portfolio from './Portfolio';
import { mailDecision } from './engine';
import { hasMail, type Session } from './state';
import type { Act } from './ShiftPanels';

type Props={s:Session;act:Act;close:()=>void;monitor:RefObject<HTMLDivElement>;compact:boolean;clipboard:()=>void};
const pdf=new URL(import.meta.env.BASE_URL+'Aulia-Ilham-Resume.pdf',document.baseURI).href;
export function Workstation({s,act,close,monitor,compact,clipboard}:Props) {
  const [start,setStart]=useState(false);
  const [minimized,setMinimized]=useState(false);
  const desktop=s.desktop;
  const go=(screen:Session['desktop'])=>{
    setStart(false);
    setMinimized(false);
    act(()=>{s.desktop=screen;});
  };
  const unread=hasMail(s.safety)&&!s.safety.mailDisposition;
  const showWindow=desktop!=='home'&&!minimized;
  const hideIcons=start||showWindow;
  const mailOpen=['inbox','message','report'].includes(desktop);
  const title=mailOpen?'Works Mail':desktop==='security'?'Security Desk':desktop==='cv'?'Document Viewer':desktop==='contact'?'Address Book':'Personnel Directory';
  return <div className={'crt-layer '+(compact?'crt-portable':'crt-projected')}>
    <div className="crt-screen" ref={monitor}>
      <section className="retro-desktop" role="dialog" aria-modal="true" aria-label="Works OS workstation">
        <div className="retro-icons" aria-label="Desktop icons" aria-hidden={hideIcons}>
          <button disabled={hideIcons} onClick={()=>go('inbox')}><Icon name="mail" size={29}/><span>Works Mail</span>{unread&&<small>1 new</small>}</button>
          <button disabled={hideIcons} onClick={()=>go('portfolio')}><span className="retro-folder" aria-hidden="true"/>Portfolio</button>
          <button disabled={hideIcons} onClick={()=>go('cv')}><span className="retro-document" aria-hidden="true">PDF</span>Résumé</button>
          <button disabled={hideIcons} onClick={()=>go('contact')}><span className="retro-document" aria-hidden="true">@</span>Contact</button>
        </div>
        <div className="retro-watermark" aria-hidden="true"><span>✦</span><strong>WORKS DESKTOP</strong><small>TRAINING TERMINAL · 98</small></div>
        {showWindow&&<article className="retro-window" aria-hidden={start}>
          <header className="retro-title"><strong>{title}</strong><div>
            <button onClick={()=>{setMinimized(true);act(()=>{});}} aria-label={'Minimize '+title}>_</button>
            <button onClick={()=>go('home')} aria-label={'Close '+title}>×</button>
          </div></header>
          <div className="retro-body" key={desktop}>
            {desktop==='inbox'&&<>
              <div className="retro-toolbar"><span>File</span><span>Mail</span><span>Inbox</span></div>
              {unread?<button className="retro-message" onClick={()=>go('message')}><Icon name="mail" size={20}/><span><strong>URGENT · Signed audit form required</strong><small>Compliance Desk · External sender</small></span></button>:
              <p className="retro-copy">You're caught up. There are no unread messages.</p>}
            </>}
            {desktop==='message'&&<>
              <div className="retro-toolbar">
                <button onClick={()=>go('inbox')}>‹ Inbox</button>
                <button onClick={()=>act(()=>mailDecision(s,'ignore'))}>Archive unopened</button>
                <button onClick={()=>go('report')}>Report phishing</button>
              </div>
              <div className="retro-copy">
                <h2>URGENT · Signed audit form required</h2>
                <p className="retro-sender">From Compliance Desk &lt;compliance@works-audit.example&gt;</p>
                <p>Open the attached form within ten minutes to keep your site access. Do not forward this message.</p>
                <button className="retro-attachment" onClick={()=>act(()=>mailDecision(s,'open'))}>
                  <span className="retro-document" aria-hidden="true">PDF</span><span>Audit_Form_Immediate.pdf<small>Click to open attachment</small></span>
                </button>
              </div>
            </>}
            {desktop==='report'&&<div className="retro-copy"><h2>Report phishing</h2>
              <p>Send the message and its headers to the site security team. The attachment stays closed.</p>
              <div className="retro-buttons"><button onClick={()=>act(()=>mailDecision(s,'report'))}>Send to Security</button><button onClick={()=>go('message')}>Back</button></div>
            </div>}
            {desktop==='security'&&<div className="retro-copy"><h2>{s.safety.mailDisposition==='report'?'Report received':'Message archived'}</h2>
              <p>The attachment stayed closed.</p><button onClick={s.safety.reported?()=>go('portfolio'):clipboard}>{s.safety.reported?'Open personnel directory':'Open inspection clipboard'}</button>
            </div>}
            {(desktop==='portfolio'||desktop==='contact')&&<Portfolio embedded tab={desktop==='contact'?'Contact':s.portfolioTab} change={tab=>act(()=>{
              s.portfolioTab=tab;s.desktop=tab==='CV / Résumé'?'cv':'portfolio';
            })} close={()=>go('home')}/>}
            {desktop==='cv'&&<div className="retro-viewer">
              <div className="retro-toolbar"><a href={pdf} target="_blank" rel="noreferrer">Open PDF ↗</a><a href={pdf} download>Save a copy ↓</a></div>
              <iframe title="Aulia Ilham Nur Alfian résumé" src={pdf}/>
            </div>}
          </div>
          <footer className="retro-status">Local workstation · Works 98</footer>
        </article>}
        {start&&<nav className="retro-start" aria-label="Start menu">
          <div>WORKS 98</div><button onClick={()=>go('inbox')}>Works Mail</button><button onClick={()=>go('portfolio')}>Personnel directory</button>
          <button onClick={()=>go('cv')}>Résumé viewer</button><button onClick={()=>go('contact')}>Contact</button>
          {s.safety.mailDisposition&&<button onClick={()=>go('security')}>Security Desk</button>}
          <button onClick={close}>Leave workstation</button>
        </nav>}
        <footer className="retro-taskbar">
          <button className="retro-start-key" aria-pressed={start} onClick={()=>{setStart(!start);act(()=>{});}}><span aria-hidden="true">▦</span> Start</button>
          {desktop!=='home'&&<button className="retro-task" aria-label={(minimized?'Restore ':'Minimize ')+title+' from taskbar'} aria-pressed={showWindow} onClick={()=>{setStart(false);setMinimized(!minimized);act(()=>{});}}>{title}</button>}
          <button className="retro-exit" onClick={close} aria-label="Close workstation">Exit CRT</button>
        </footer>
      </section>
    </div>
  </div>;
}
