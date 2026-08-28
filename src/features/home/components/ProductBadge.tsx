import React from'react';
import{BadgeCheck,Gem,Leaf,Snowflake,Timer}from'lucide-react';

type Tone='official'|'verified'|'seasonal'|'preorder'|'cold';
const icons={official:Gem,verified:BadgeCheck,seasonal:Leaf,preorder:Timer,cold:Snowflake};
export default function ProductBadge({tone,label}:{tone:Tone;label:string}){const Icon=icons[tone];return<span className="go-product-badge" data-tone={tone}><Icon aria-hidden="true"/><span>{label}</span></span>;}
