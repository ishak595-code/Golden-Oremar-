import{ArrowRight,X}from'lucide-react';
import{publicCatalogUrl}from'../../catalog/api';
import{CUSTOMER_COPY}from'../../customer-experience/customerCopy';
import{useAccessibleDialog}from'../../accessibility/useAccessibleDialog';
import type{HomeExperience}from'../homeExperienceApi';
import CategoryCard from'./CategoryCard';

/**
 * The categories, behind the menu button at the top left of the home header:
 * a panel from the left, in the order and with the titles the super admin set
 * in "Koleksiyon kartları". Escape, the Android back button and the backdrop
 * close it; focus stays inside while it is open.
 */
type Entry={category:HomeExperience['categories'][number];config:HomeExperience['categoryOrder'][number]|null};
type Props={title:string;categories:Entry[];onClose:()=>void;onPick:(slug?:string)=>void};
export default function CategoryMenu({title,categories,onClose,onPick}:Props){
 const dialogRef=useAccessibleDialog<HTMLDivElement>(true,onClose);
 return<div className="go-category-menu__backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="home-category-menu-title" tabIndex={-1} className="go-category-menu">
   <div className="go-category-menu__head"><div><span className="go-category-menu__eyebrow">Kategoriler</span><h2 id="home-category-menu-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Kapat" className="go-category-menu__close"><X aria-hidden="true"/></button></div>
   <div className="go-category-menu__list" role="list" aria-label="Kategoriler">
    {categories.map(({category,config})=>{const image=category.imagePath||config?.image||null;return<div role="listitem" key={category.id}><CategoryCard name={config?.title||category.name} subtitle={config?.subtitle||null} imageUrl={image?publicCatalogUrl(image):null} icon={config?.icon||category.icon} onClick={()=>onPick(category.slug)}/></div>;})}
   </div>
   <button type="button" className="go-category-menu__all" onClick={()=>onPick()}><span>{CUSTOMER_COPY.home.discoverAll}</span><ArrowRight aria-hidden="true"/></button>
  </div>
 </div>;
}
