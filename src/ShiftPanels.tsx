import { Action, Icon } from './components';
import { gear, isGear, machinePart, positions, ROAD, type Part } from './map';
import { checklist, preparationPerformed, preparationRows, recordIssues, recordName, type PortfolioTab, type Session } from './state';
import { filmStage, PPE_CUES, ppeBeat } from './cinematics';
import { gearAction, markPreparation, markRecord, reviewRecords } from './engine';
import { play } from './audio';
import type { RefObject } from 'react';

export type Act = (fn:()=>void)=>void;
type Props={s:Session;act:Act;close:()=>void};

export function Clipboard({s,act,close,paper}:Props&{paper:RefObject<HTMLDivElement>}) {
  const page=s.pressPage;
  const ready=!!s.safety.mailDisposition && !s.safety.reported;
  const turn=(next:Session['pressPage'])=>act(()=>{s.pressPage=next;play('paper',s.settings.sound);});
  const rows=page==='ppe'?preparationRows.map(([key,label])=>({label,key,done:preparationPerformed(s.safety,key),
    marked:!!s.safety.recordedPpe[key],mark:(checked:boolean)=>markPreparation(s,key,checked)})):
    checklist(page).map(([key,label])=>({label,key,done:!!s.safety.inspected[page][key],
      marked:!!s.safety.recorded[page][key],mark:(checked:boolean)=>markRecord(s,page,key,checked)}));
  const next=rows.find(row=>!row.done||!row.marked);
  return <div className="clipboard-layer" aria-hidden={s.panel!=='clipboard'}><div className="clipboard-surface" ref={paper}>
    <section className="clipboard" role="dialog" aria-label="Inspection clipboard">
      <header>
        <div><div className="form-kicker">THE TRAINING WORKS · FORM SQ-02</div><h2>Safety inspection</h2></div>
        <button className="icon-button" aria-label="Lower clipboard" onClick={close}><Icon name="close"/></button>
      </header>
      <nav aria-label="Inspection pages">
        <button aria-pressed={page==='ppe'} onClick={()=>turn('ppe')}>01 · PPE</button>
        <button aria-pressed={page!=='ppe'} onClick={()=>turn(page==='b'?'b':'a')}>02 · Press machines</button>
      </nav>
      <div className="clipboard-paper" key={page}>
        <h3>{page==='ppe'?'PERSONAL PROTECTIVE EQUIPMENT':'MACHINE PRESS SAFETY INSPECTION'}</h3>
        <p>{page==='ppe'?'Select equipment directly from the shelves. Inspect each item before putting it on.':
          'Inspect in order. Keep clear of the tooling and follow authorized isolation procedures.'}</p>
        {page!=='ppe'&&<nav aria-label="Press inspection records" className="press-tabs">
          <button aria-pressed={page==='a'} onClick={()=>turn('a')}>Press A</button>
          <button aria-pressed={page==='b'} onClick={()=>turn('b')}>Press B</button>
        </nav>}
        <fieldset>
          <legend>Mark only what you personally verified.</legend>
          {rows.map((row,i)=><label key={row.key} className="form-check" aria-current={row===next?'step':undefined}>
            <span className="step-number" aria-hidden="true">{i+1}</span>
            <input type="checkbox" checked={row.marked} onChange={e=>act(()=>row.mark(e.target.checked))}/>
            <span>{row.label}{row===next&&<small className="step-next" aria-hidden="true">{row.done?'NEXT · MARK THIS STEP':'NEXT · DO THIS STEP'}</small>}{row!==next&&row.done&&<small className="step-next">PERFORMED</small>}</span>
          </label>)}
        </fieldset>
      </div>
      <footer>
        <span>VISITOR RECORD · {page==='ppe'?'PREPARATION':'PRESS '+page.toUpperCase()}</span>
        {ready&&<button className="form-submit" onClick={()=>act(()=>reviewRecords(s))}>Submit records <Icon name="arrow" size={17}/></button>}
      </footer>
    </section>
  </div></div>;
}

const details:Partial<Record<Part,string>>={
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
    const replacing=s.safety.ppe.some(id=>id!==target&&gear[id].slot===item.slot);
    return <aside className="focus-card gear-focus" aria-label="Equipment close-up">
      <div><div className="record-label">CABINET / {worn?(item.sound?'EQUIPPED':'EQUIPPED / REPLACE'):item.sound?'READY TO FIT':'DAMAGED / DO NOT USE'}</div><h2>{item.name}</h2><p>{item.detail}</p></div>
      <div className="focus-actions">
        <button className="focus-wear" onClick={()=>act(()=>gearAction(s,target))}>{worn?'Unequip':replacing?'Replace':'Equip'}</button>
        <button onClick={close}>Back</button>
      </div>
    </aside>;
  }
  const [press,part]=machinePart(target)!;
  const detail=part==='status'?
    press==='a'&&s.pressMode!=='idle'?'RAM HOME. Use STOP before verifying.':press==='b'&&s.safety.tagged?'OUT OF SERVICE. The tag identifies the reported defect.':'STOPPED. This display does not verify energy isolation.':
    part==='guard'&&press==='b'?'A metal offcut is wedged beneath the displaced guard. Keep hands clear.':details[part];
  return <aside className="focus-card" aria-label="Machine inspection">
    <div><div className="record-label">MACHINE INSPECTION</div><h2>{positions[target].name}</h2><p>{detail}</p></div>
    <button className="icon-button" aria-label="Step back from machine" onClick={close}><Icon name="close"/></button>
  </aside>;
}

export function FilmOverlay({s,next,skip}:{s:Session;next:()=>void;skip:()=>void}) {
  const f=s.film!, stage=filmStage(s);
  const continueButton=<button className="text-button film-next" onClick={next}>Continue <Icon name="arrow" size={17}/></button>;
  const replaySkip=s.seenFilms.has(f.kind) && <button className="text-button film-skip" onClick={skip}>Skip scene</button>;
  if(f.kind==='ppe') {
    const beat=ppeBeat(f);
    if(!beat) {
      const remedies={feet:'Wear suitable safety footwear.',eyes:'Replace damaged eye protection and put it on before entering.',ears:'Wear intact hearing protection in the press bay.'};
      return <div className="film black" role="dialog" aria-label="PPE safety feedback"><div className="film-message">
        <Icon name="warning" size={34}/><h2>Check your PPE before entering.</h2>
        <ul className="ppe-remedies">{f.hazards.map(slot=><li key={slot}>{remedies[slot]}</li>)}</ul>
        {continueButton}
      </div></div>;
    }
    if(stage==='ppe-fade') return <div className="film ppe-fade" aria-hidden="true"/>;
    const hit=beat.time>=PPE_CUES[beat.slot];
    const captions={feet:hit?'The falling gear hits your foot.':'A heavy gear comes loose.',eyes:hit?'A metal fragment hits your eye.':'The press spits metal fragments.',ears:hit?'The ringing drowns out the room.':'Machinery noise surges.'};
    return <div key={stage} className={`film ppe-scene ppe-${beat.slot}${hit?' ppe-impact':''}`}>
      <div className="film-caption ppe-caption">
        <div className="ppe-caption-text" role="status"><Icon name="warning"/><strong>{captions[beat.slot]}</strong></div>
        {replaySkip&&<div className="ppe-caption-actions">{replaySkip}</div>}
      </div>
    </div>;
  }
  if(stage==='near-impact') return <div className="film road-impact" aria-hidden="true"/>;
  if(stage==='near-quiet'||stage==='near-horn') {
    const side=f.kind==='near'&&(f.side===1)===(f.curb===ROAD.near)?'right':'left';
    return <div className={'film '+(stage==='near-horn'?'near-flash':'anticipation')}>
      <div className="film-caption" role="status"><Icon name="warning"/> <strong>{stage==='near-horn'?'Truck air horn · '+side:'Heavy engine approaching'}</strong>{replaySkip}</div>
    </div>;
  }
  if(stage==='machine-tension'||stage==='machine-danger') {
    const reaching=f.kind==='failure'&&f.reason==='reach';
    const caption=reaching?(stage==='machine-tension'?'The press shudders.':'The ram drops.'):'The start circuit is unsafe.';
    return <div className={'film '+(stage==='machine-danger'?'near-flash':'anticipation')}><div className="film-caption"><Icon name="warning"/> <strong>{caption}</strong>{replaySkip}</div></div>;
  }
  if(stage==='near-black'||stage==='machine-black') {
    const reach=f.kind==='failure'&&f.reason==='reach';
    const title=f.kind==='near'?'That was dangerous.':reach?'Never reach into malfunctioning machinery.':'The press wasn’t ready.';
    const line=f.kind==='near'?(f.unchecked?'Check both directions and wait for a clear road.':'Always use the designated pedestrian crossing.'):
      reach?'Stop, report, and follow authorized isolation procedures.':'Verify stopped status, all four sides, and the guard before starting.';
    return <div className="film black" role="dialog" aria-label="Safety feedback"><div className="film-message"><Icon name="warning" size={34}/><h2>{title}</h2><p>{line}</p>{continueButton}</div></div>;
  }
  const audit=f.kind==='audit';
  const issues=audit?recordIssues(s.safety):[];
  const flagged=[...new Set(issues.map(issue=>recordName(issue.page)))].join(' and ');
  if(stage==='office-intro'||stage==='office-close') {
    const title=stage==='office-intro'?(audit?'END OF SHIFT REVIEW':'ONE WEEK LATER…'):(audit?'Review '+flagged:'Think before you click.');
    return <div className="film black" key={stage} role="dialog" aria-label="Office briefing">
      <div className="film-message"><span className="eyebrow">THE TRAINING WORKS</span><h2>{title}</h2>
        {stage==='office-close'&&<p>{audit?'Compare the entries with your actual work. Your completed work is saved.':'Check the sender and report unexpected attachments to IT Support.'}</p>}
        {continueButton}{stage==='office-intro'&&replaySkip}
      </div>
    </div>;
  }
  const staff=stage==='office-staff';
  const speaker=staff?(audit?'ENGINEERING':'IT SUPPORT'):'OPERATIONS MANAGER';
  const dialogue=audit?(staff?'This report shows where the record and the work differ. Accurate records tell the next shift which machines are safe to use.':
    'The inspection records need a second look. Engineering found gaps between the checks you marked and the work on the floor.'):
    staff?'The attachment came from a fake sender. It locked shared training files, and we had to isolate the workstation.':
    'We lost access to our training files after an unexpected attachment was opened. IT Support traced the incident to this workstation.';
  return <div className="film incident" key={stage}><div className="letterbox"/><div className="film-caption">
    <span className="eyebrow">{speaker}</span><strong>{dialogue}</strong>
    {staff&&audit&&<div className="audit-report" aria-label="Inspection discrepancies">{issues.map(issue=><div key={issue.page+issue.label}><b>{recordName(issue.page)}</b><span>{issue.label}</span><em>{issue.reason}</em></div>)}</div>}
    {staff&&!audit&&<div className="incident-report">SHARED FILES LOCKED · WORKSTATION ISOLATED</div>}
    {continueButton}{replaySkip}
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
      <div className="ending-links"><button onClick={()=>open('Project Case Study')}>Project Case Study</button><button onClick={explore}>Explore Again</button><button onClick={()=>open('CV / Résumé')}>View CV</button><button onClick={()=>open('Contact')}>Contact</button></div>
    </div>
  </section>;
}
