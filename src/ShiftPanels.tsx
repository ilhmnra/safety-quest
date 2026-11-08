import { Action, Icon } from './components';
import { gear, isGear, machinePart, positions, ROAD, type Part } from './map';
import { checklist, filmStage, inaccurateRecords, type PortfolioTab, type Session } from './state';
import { gearAction, mailDecision, markRecord, reviewRecords } from './engine';

export type Act = (fn:()=>void)=>void;
type Props={s:Session;act:Act;close:()=>void};

export function Clipboard({s,act,close}:Props) {
  const press=s.pressPage;
  const ready=!!s.safety.mailDisposition && !s.safety.reported;
  return <div className="clipboard-layer">
    <section className="clipboard" role="dialog" aria-label="Inspection clipboard">
      <div className="clipboard-clip" aria-hidden="true"/>
      <header>
        <div><div className="form-kicker">THE TRAINING WORKS · FORM SQ-02</div><h2>Press inspection record</h2></div>
        <button className="icon-button" aria-label="Lower clipboard" onClick={close}><Icon name="close"/></button>
      </header>
      <nav aria-label="Inspection forms">{(['a','b'] as const).map(id=>
        <button key={id} aria-pressed={press===id} onClick={()=>act(()=>{s.pressPage=id;})}>Press {id.toUpperCase()}</button>)}</nav>
      <fieldset>
        <legend>Mark what you personally verified.</legend>
        {checklist(press).map(([key,label])=><label key={key} className="form-check">
          <input type="checkbox" checked={!!s.safety.recorded[press][key]} onChange={e=>act(()=>markRecord(s,press,key,e.target.checked))}/>
          <span>{label}</span>
        </label>)}
      </fieldset>
      <footer>
        <span>VISITOR RECORD · PRESS {press.toUpperCase()}</span>
        {ready&&<button className="form-submit" onClick={()=>act(()=>reviewRecords(s))}>Submit records <Icon name="arrow" size={17}/></button>}
      </footer>
    </section>
  </div>;
}

export function Workstation({s,act,close,portfolio}:Props&{portfolio:()=>void}) {
  const desktop=s.desktop;
  const go=(screen:Session['desktop'])=>act(()=>{s.desktop=screen;});
  return <div className="terminal-layer monitor-layer">
    <section className="terminal workstation" role="dialog" aria-label="Works OS workstation">
      <header className="terminal-top"><span className="terminal-dot"/><b>WORKS OS</b><span> / TRAINING TERMINAL</span>
        <button className="icon-button close" aria-label="Close workstation" onClick={close}><Icon name="close"/></button>
      </header>
      <nav className="desktop-taskbar" aria-label="Workstation applications">
        <button aria-pressed={desktop==='home'} onClick={()=>go('home')}>▦ Desktop</button>
        <button aria-pressed={desktop==='inbox'||desktop==='message'||desktop==='report'} onClick={()=>go('inbox')}><Icon name="mail" size={16}/> Works Mail</button>
        {s.safety.mailDisposition&&<button aria-pressed={desktop==='security'} onClick={()=>go('security')}>◈ Security</button>}
      </nav>
      <div className="desktop-screen">
        {desktop==='home'&&<div className="desktop-wallpaper">
          <span className="terminal-kicker">TRAINING TERMINAL / LOCAL USER</span>
          <h2>Good shift.</h2>
          <button className="desktop-icon" onClick={()=>go('inbox')}><Icon name="mail" size={32}/>Works Mail
            {!s.safety.mailDisposition&&s.safety.completed&&s.safety.tagged&&<small>1 unread</small>}
          </button>
          {s.safety.reported&&<button className="desktop-icon" onClick={portfolio}>▤ Personnel directory</button>}
        </div>}
        {desktop==='inbox'&&<div className="inbox">
          <div className="terminal-kicker">WORKS MAIL / INBOX</div><h2>Inbox</h2>
          {s.safety.tagged&&s.safety.completed&&!s.safety.mailDisposition?
            <button className="mail-row" onClick={()=>go('message')}><span className="unread-dot"/><span><strong>URGENT · Signed audit form required</strong><small>Compliance Desk · External sender</small></span><span aria-hidden="true">›</span></button>:
            <p className="fine-print">You're caught up. There are no unread messages.</p>}
        </div>}
        {desktop==='message'&&<article className="mail-message">
          <div className="message-tools">
            <button onClick={()=>go('inbox')}>‹ Inbox</button>
            <button onClick={()=>act(()=>mailDecision(s,'ignore'))}>Archive unopened</button>
            <button onClick={()=>go('report')}>Report phishing</button>
          </div>
          <div className="terminal-kicker">WORKS MAIL / EXTERNAL</div>
          <h2>URGENT · Signed audit form required</h2>
          <p className="sender">Compliance Desk &lt;compliance@works-audit.example&gt;</p>
          <p>Open the attached form within ten minutes to keep your site access. Do not forward this message.</p>
          <button className="mail-attachment" onClick={()=>act(()=>mailDecision(s,'open'))}>
            <span className="pdf-icon" aria-hidden="true">PDF</span><span><strong>Audit_Form_Immediate.pdf</strong><small>Click to open attachment</small></span><span aria-hidden="true">↗</span>
          </button>
        </article>}
        {desktop==='report'&&<article className="mail-message">
          <div className="terminal-kicker">WORKS MAIL / SECURITY DESK</div><h2>Report phishing</h2>
          <p>Send the message and its headers to the site security team. The attachment stays closed.</p>
          <div className="buttons"><Action kind="primary" onClick={()=>act(()=>mailDecision(s,'report'))}>Send to Security</Action>
            <Action onClick={()=>go('message')}>Back to message</Action></div>
        </article>}
        {desktop==='security'&&<article className="mail-message">
          <div className="terminal-kicker">SECURITY DESK / INBOX CLOSED</div><h2>{s.safety.mailDisposition==='report'?'Report received':'Message archived'}</h2>
          <p>The attachment stayed closed.</p>
          {s.safety.reported?<Action kind="primary" onClick={portfolio}>Open personnel directory</Action>:
            <Action onClick={()=>act(()=>{s.panel='clipboard';})}>Open inspection clipboard</Action>}
        </article>}
      </div>
      <footer className="terminal-footer"><span className="terminal-dot"/> LOCAL WORKSTATION <span>WORKS / 01</span></footer>
    </section>
  </div>;
}

const details:Record<string,string>={
  front:'Check the faceplate, fasteners, and exposed housing.',
  rear:'The rear cover and its ventilation panel are in place.',
  left:'The left frame is seated and its visible fasteners are intact.',
  right:'The right frame and external fasteners are in place.',
  guard:'The guard is seated and the tooling area is clear.',
};

export function InspectionFocus({s,act,close}:Props) {
  const target=s.focus?.target;
  if(!target) return null;
  if(isGear(target)) {
    const item=gear[target], worn=s.safety.ppe.includes(target);
    return <aside className="focus-card gear-focus" aria-label="Equipment close-up">
      <div><div className="record-label">CABINET / {worn?(item.sound?'WORN':'WORN / REPLACE'):item.sound?'READY TO FIT':'DO NOT USE'}</div><h2>{item.name}</h2><p>{item.detail}</p></div>
      <div className="focus-actions">
        <button className="focus-wear" onClick={()=>act(()=>gearAction(s,target))}>{worn?'Remove':'Wear'}</button>
        <button onClick={close}>{item.sound?'Step back':'Return to shelf'}</button>
      </div>
    </aside>;
  }
  const [press,part]=machinePart(target)!;
  const detail=part==='status'?
    (press==='a'?!s.stoppedA:s.pressMode!=='idle')?'Machine is not in its initial stopped state.':'Panel confirms the training press is stopped.':
    part==='guard'&&press==='a'?'A metal offcut is wedged beneath the displaced guard. Keep hands clear.':details[part as Part];
  return <aside className="focus-card" aria-label="Machine close-up">
    <div><div className="record-label">MACHINE INSPECTION</div><h2>{positions[target].name}</h2><p>{detail}</p></div>
    <button className="icon-button" aria-label="Step back from machine" onClick={close}><Icon name="close"/></button>
  </aside>;
}

export function FilmOverlay({s,skip}:{s:Session;skip:()=>void}) {
  const f=s.film!, stage=filmStage(s);
  if(stage==='near-quiet') return null;
  if(stage==='near-horn' && f.kind==='near') {
    const side=(f.side===1)===(f.curb===ROAD.near)?'right':'left';
    return <div className="film near-flash"><div className="film-caption" role="status"><Icon name="warning"/> <strong>Truck air horn · {side}</strong></div></div>;
  }
  if(stage==='machine-danger') return <div className="film near-flash"><div className="film-caption"><Icon name="warning"/> <strong>{f.kind==='failure'&&f.reason==='reach'?'Mechanical strain':'Unsafe start'}</strong></div></div>;
  if(stage==='near-black'||stage==='machine-black') {
    const road=f.kind==='near', reach=f.kind==='failure'&&f.reason==='reach';
    const title=road?'That was dangerous.':reach?'Keep hands out of the tooling.':'The press wasn’t ready.';
    const line=f.kind==='near'?(f.unchecked?'Check both directions and wait for a clear road.':'Always use the designated pedestrian crossing.'):
      reach?'Stop, report, and follow authorized isolation procedures.':'Verify stopped status, all four sides, and the guard before starting.';
    return <div className="film black"><div className="film-message"><Icon name="warning" size={34}/><h2>{title}</h2><p>{line}</p>
      <button className="text-button" onClick={skip}>Return to checkpoint <Icon name="arrow" size={17}/></button></div></div>;
  }
  if(stage==='incident-glitch') return <div className="film glitch"><b>WORKSTATION CONNECTION LOST</b></div>;
  const audit=f.kind==='audit';
  const flagged=inaccurateRecords(s.safety).map(p=>'Press '+p.toUpperCase()).join(' and ');
  if(stage.endsWith('intro') || stage.endsWith('close')) {
    const title=stage==='incident-intro'?'ONE WEEK LATER':stage==='incident-close'?'Think before you click.':
      stage==='audit-intro'?'END OF SHIFT REVIEW':'Review '+flagged;
    return <div className="film black"><div className="film-message"><span className="eyebrow">THE TRAINING WORKS</span><h2>{title}</h2>
      {stage==='audit-close'&&<p>Compare the entries with your actual work. Your completed work is saved.</p>}
      <button className="text-button" onClick={skip}>{stage.endsWith('close')?'Return to the factory':'Skip scene'} <Icon name="arrow" size={17}/></button></div></div>;
  }
  const staff=stage.endsWith('staff'), speaker=staff?(audit?'TRAINING SUPERVISOR':'IT RESPONSE'):'CEO';
  const dialogue=audit?(staff?`${flagged} needs review. Recheck the work and correct the inspection form before you submit it again.`:
    'These forms don’t match what happened on the floor. We rely on these records to know which equipment is safe to use.'):
    staff?'We traced it to the fake audit email. IT is isolating the affected systems.':
    stage.endsWith('last')?'Next time, report a suspicious message before opening its attachment.':'The training files are locked. Who opened the attachment?';
  return <div className="film incident"><div className="letterbox"/><div className="film-caption">
    <span className="eyebrow">{speaker}</span><strong>{dialogue}</strong>
    <button className="text-button" onClick={skip}>Skip scene <Icon name="arrow" size={16}/></button>
  </div></div>;
}

export function Ending({explore,open}:{explore:()=>void;open:(tab:PortfolioTab)=>void}) {
  return <section className="ending" role="dialog" aria-modal="true" aria-label="Shift complete">
    <div className="ending-card">
      <div className="ending-mark" aria-hidden="true"><Icon name="check" size={34}/></div>
      <div className="eyebrow"><span/> THE TRAINING WORKS / SHIFT COMPLETE</div>
      <h1>You made it<span>.</span></h1>
      <p>Your first day at the factory is complete.</p>
      <div className="ending-credit"><small>AN INTERACTIVE EXPERIENCE BY</small><strong>Aulia Ilham Nur Alfian</strong></div>
      <Action kind="primary" onClick={()=>open('About Me')}>Meet the Developer <Icon name="arrow"/></Action>
      <div className="ending-links"><button onClick={explore}>Explore Again</button><button onClick={()=>open('CV / Résumé')}>View CV</button><button onClick={()=>open('Contact')}>Contact</button></div>
    </div>
  </section>;
}
