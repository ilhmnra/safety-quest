import type { ReactNode } from 'react';

type IconName='warning'|'menu'|'speaker'|'mute'|'arrow'|'aim'|'finger'|'move'|'check'|'mail'|'close';
export function Icon({name,size=20}:{name:IconName;size?:number}) {
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

export function Action({children,onClick,kind='neutral',disabled=false}:{children:ReactNode;onClick:()=>void;kind?:'neutral'|'primary'|'danger';disabled?:boolean}) {
  return <button type="button" className={'action '+kind} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function Sheet({code,title,children,close,extra='',hideClose=false}:{code:string;title:string;children:ReactNode;close:()=>void;extra?:string;hideClose?:boolean}) {
  return <div className="sheet-layer"><section className={'sheet '+extra} role="dialog" aria-modal="true" aria-label={title}>
    <div className="sheet-grip"/>
    <header className="sheet-header"><div><div className="eyebrow"><span/>{code}</div><h2>{title}</h2></div>
      {!hideClose && <button className="icon-button close" aria-label="Close panel" onClick={close}><Icon name="close"/></button>}</header>
    <div className="sheet-body">{children}</div>
  </section></div>;
}
