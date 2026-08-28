import React from'react';
import{Leaf}from'lucide-react';
import PremiumImage from'./PremiumImage';

type Props={name:string;subtitle?:string|null;imageUrl?:string|null;onClick:()=>void};
export default function CategoryCard({name,subtitle,imageUrl,onClick}:Props){return<button type="button" onClick={onClick} className="go-category-card" aria-label={subtitle?`${name}, ${subtitle}`:name}>
 <span className="go-category-card__media" aria-hidden="true">{imageUrl?<PremiumImage src={imageUrl} alt="" aspectClassName="go-category-card__image"/>:<span className="go-category-card__icon"><Leaf/></span>}</span>
 <span className="go-category-card__copy"><strong>{name}</strong>{subtitle?<span>{subtitle}</span>:null}</span>
 </button>;}
