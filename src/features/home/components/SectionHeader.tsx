import React from'react';
import{ArrowRight}from'lucide-react';

type Props={id:string;eyebrow?:string|null;title:string;subtitle?:string|null;actionLabel?:string;onAction?:()=>void};
export default function SectionHeader({id,eyebrow,title,subtitle,actionLabel,onAction}:Props){return<div className="go-section-header">
 <div className="go-section-header__copy">
  {eyebrow?<span className="go-section-header__eyebrow">{eyebrow}</span>:null}
  <h2 id={id}>{title}</h2>
  {subtitle?<p>{subtitle}</p>:null}
 </div>
 {actionLabel&&onAction?<button type="button" onClick={onAction} className="go-section-header__action"><span>{actionLabel}</span><ArrowRight aria-hidden="true"/></button>:null}
 </div>;}
