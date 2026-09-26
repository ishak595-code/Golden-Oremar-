import React from'react';
import{Box,Cherry,Coffee,Droplet,Fish,Gem,Leaf,Mountain,Sun,type LucideIcon}from'lucide-react';

// Icons named by categories.icon in the database. Only these are bundled; an
// unknown or missing name falls back to the leaf, so a new category never
// breaks the card. Previously every category showed the leaf, whatever its icon.
const CATEGORY_ICONS:Record<string,LucideIcon>={Box,Cherry,Coffee,Droplet,Fish,Gem,Leaf,Mountain,Sun};
export function categoryIcon(name:string|null|undefined):LucideIcon{return(name&&CATEGORY_ICONS[name])||Leaf;}
import PremiumImage from'./PremiumImage';

type Props={name:string;subtitle?:string|null;imageUrl?:string|null;icon?:string|null;onClick:()=>void};
export default function CategoryCard({name,subtitle,imageUrl,icon,onClick}:Props){const Icon=categoryIcon(icon);return<button type="button" onClick={onClick} className="go-category-card" aria-label={subtitle?`${name}, ${subtitle}`:name}>
 <span className="go-category-card__media" aria-hidden="true">{imageUrl?<PremiumImage src={imageUrl} alt="" aspectClassName="go-category-card__image"/>:<span className="go-category-card__icon"><Icon/></span>}</span>
 <span className="go-category-card__copy"><strong>{name}</strong>{subtitle?<span>{subtitle}</span>:null}</span>
 </button>;}
