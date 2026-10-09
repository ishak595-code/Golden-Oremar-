import type{CatalogItem}from'../../catalog/api';
import{currentSeason,namesOtherSeason,namesSeason}from'../../customer-experience/customerCopy';

/**
 * "Bugünün Önerisi" band: up to six products, in stock now. Seasonal ones
 * first (a product named for this season leads; one whose name ties it to
 * another season is left out), then the featured ones. The order turns over
 * each day, so a returning visitor starts on something new.
 */
export function pickSpotlights(seasonal:CatalogItem[],featured:CatalogItem[],date=new Date(),limit=6):CatalogItem[]{
 const season=currentSeason(date);
 const inStock=(item:CatalogItem)=>item.stockMode!=='preorder'&&(item.availableQuantity===null||item.availableQuantity===undefined||item.availableQuantity>0);
 const pool=seasonal.filter(item=>inStock(item)&&!namesOtherSeason(item.name,season));
 const seen=new Set<string>();
 const list=[...pool.filter(item=>namesSeason(item.name,season)),...pool.filter(item=>!namesSeason(item.name,season)),...featured.filter(inStock)].filter(item=>!seen.has(item.id)&&seen.add(item.id)).slice(0,limit);
 if(!list.length)return[];
 const day=Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(date.getFullYear(),0,0))/86400000);
 const start=day%list.length;
 return[...list.slice(start),...list.slice(0,start)];
}
