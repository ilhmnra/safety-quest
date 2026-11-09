import { useRef, useEffect } from 'react';
import type { PortfolioTab } from './state';

const original='https://ilhmnra.github.io/';
const resume=new URL('./Aulia-Ilham-Resume.pdf',document.baseURI).href;
export const tabs:PortfolioTab[]=['About Me','Work Experience','Projects','Skills','CV / Résumé','Contact','Project Case Study'];

function Link({href,children}:{href:string;children:React.ReactNode}) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden>↗</span></a>;
}
const skills = [
  ['Business analysis','Requirements gathering','Stakeholder interviews','Process mapping','Data modeling','UAT'],
  ['Software and data','C#','ASP.NET MVC','Python','SQL','SQL Server'],
  ['Delivery and quality','Agile development','Functional testing','AI evaluation','Rubric design','RL environment QA'],
];
export default function Portfolio({tab,change,close,embedded=false}:{tab:PortfolioTab;change:(tab:PortfolioTab)=>void;close:()=>void;embedded?:boolean}) {
  const content=useRef<HTMLElement>(null);
  useEffect(()=>{content.current?.scrollTo(0,0);},[tab]);
  return <div className={embedded?"terminal embedded-directory":"terminal"} role={embedded?undefined:"dialog"} aria-modal={embedded?undefined:true} aria-label="Works OS Personnel Directory">
    {!embedded&&<header className="terminal-top"><span className="terminal-dot"/><b>WORKS OS</b><span> / PERSONNEL DIRECTORY</span><button className="icon-button close" aria-label="Close personnel directory" onClick={close}>×</button></header>}
    <div className="terminal-grid">
      <nav aria-label="Portfolio sections" className="terminal-tabs">{tabs.map((t,i)=><button type="button" key={t} aria-pressed={t===tab} onClick={()=>change(t)}><span aria-hidden>{['◉','▤','◇','▦','▧','↗'][i]}</span>{t}</button>)}</nav>
      <section className="terminal-content" ref={content} aria-label={tab}>
        <div className="terminal-kicker">PERSONNEL FILE / {String(tabs.indexOf(tab)+1).padStart(2,'0')}</div>
        {tab==='About Me' && <>
          <div className="identity"><span aria-hidden="true">AI</span><div><h2>Aulia Ilham<br/>Nur Alfian</h2><p className="terminal-role">Business systems &amp; software</p></div></div>
          <p>I’m an Applied Informatics graduate based in Surabaya. I work across business systems analysis, full-stack software delivery, and structured quality evaluation.</p>
          <div className="record"><span className="record-label">EDUCATION / 2022–2026</span><h3>Politeknik Elektronika Negeri Surabaya</h3><p>Bachelor of Applied Informatics Technology (D4). Panasonic Scholarship Indonesia diploma program awardee, 2025.</p></div>
          <Link href={original+'about/'}>Original About page</Link>
        </>}
        {tab==='Work Experience' && <>
          <h2>Work Experience</h2>
          <div className="record"><span className="record-label">JAN–DEC 2025 · 12-MONTH INTERNSHIP</span><h3>PT Panasonic Manufacturing Indonesia</h3><p>Software Engineer / Full Stack Developer</p><p>Worked with HR and business units on requirements and full-stack delivery for Etrained, from process mapping and data models through functional testing and user acceptance testing.</p><Link href={original+'projects/etrained/'}>Etrained case study</Link></div>
          <div className="record"><span className="record-label">2026 · CONTRACT WORK</span><h3>AI evaluation and quality assurance</h3><p>Work across rubric-based LLM evaluation, agentic coding, and reinforcement-learning environment QA. Reviewed edge cases and documented findings for consistent evaluation.</p><Link href={original+'about/'}>Published experience</Link></div>
        </>}
        {tab==='Projects' && <>
          <h2>Selected Projects</h2>
          <div className="record"><span className="record-label">01 / INTERNAL BUSINESS SYSTEM</span><h3>Etrained</h3><p>An employee training administration system that brings scheduling, registration, approvals, records, and reporting into one workflow.</p><Link href={original+'projects/etrained/'}>Read the case study</Link></div>
          <div className="record"><span className="record-label">02 / PENS AGILE TEAM PRODUCT</span><h3>Countlorie</h3><p>A mobile and web calorie tracker for daily targets, meals, and portions. The team delivered it through Agile Product-Based Learning and published it on Google Play.</p><Link href={original+'projects/countlorie/'}>Read the case study</Link></div>
          <div className="record"><span className="record-label">03 / INTERACTIVE WEB EXPERIENCE</span><h3>Safety Quest</h3><p>This explorable voxel factory uses a continuous 3D world to teach fictional workplace safety decisions and introduce the portfolio.</p><button onClick={()=>change('Project Case Study')}>Project Case Study</button></div>
        </>}
        {tab==='Project Case Study' && <>
          <h2>Safety Quest — Reimagining Manufacturing Safety Training Through Interactive Learning</h2>
          <p>Independent concept by Aulia Ilham Nur Alfian, inspired by exposure to training administration at PT Panasonic Manufacturing Indonesia.</p>
          <div className="record"><h3>Design</h3><p>A reusable browser prototype for recurring onboarding. Players explore a fictional factory, practice on a functional press before inspecting a defective one, and manually document their actions. Short simulated incidents explain risky decisions and offer checkpoint retries.</p></div>
          <div className="record"><h3>Technology and limits</h3><p>React, TypeScript, Three.js and React Three Fiber power the simulation. It requires a compatible WebGL browser. Learning outcomes have yet to be validated, and the prototype does not provide certification.</p></div>
          <Link href={original+'projects/safety-quest/'}>Read Full Case Study</Link>
        </>}
        {tab==='Skills' && <><h2>Tools &amp; Skills</h2>{skills.map(([group,...tags])=><div className="record" key={group}><h3>{group}</h3><ul className="chips">{tags.map(tag=><li key={tag}>{tag}</li>)}</ul></div>)}</>}
        {tab==='CV / Résumé' && <>
          <h2>CV / Résumé</h2>
          <div className="record document"><span aria-hidden>▧</span><div><h3>Aulia Ilham Nur Alfian</h3><p>Original résumé · PDF</p></div></div>
          <div className="terminal-actions"><a href={resume} target="_blank" rel="noopener noreferrer">Open PDF ↗</a><a href={resume} download>Download PDF ↓</a></div>
          <Link href={original}>Original portfolio</Link>
        </>}
        {tab==='Contact' && <>
          <h2>Contact</h2><p>Get in touch about business systems, software delivery, or AI quality.</p>
          <div className="record terminal-links"><a href="mailto:ilhmnra@gmail.com">ilhmnra@gmail.com ↗</a><Link href="https://www.linkedin.com/in/auliailham/">LinkedIn</Link><Link href="https://github.com/ilhmnra">GitHub</Link><Link href={original}>Original portfolio</Link></div>
        </>}
      </section>
    </div>
    {!embedded&&<footer className="terminal-footer"><span className="terminal-dot"/> LOCAL DIRECTORY <span>WORKS / 01</span></footer>}
  </div>;
}
