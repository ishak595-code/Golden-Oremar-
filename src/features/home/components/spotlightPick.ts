import type{CatalogItem}from'../../catalog/api';
import{currentSeason,namesOtherSeason,namesSeason}from'../../customer-experience/customerCopy';

/**
 * "Bugünün Önerisi": the first thing a visitor meets is one product, in large.
 * It comes from the seasonal showcase: in stock now, never one whose name ties
 * it to another season, a product named for this season first. The pick turns
 * over each day, so a returning visitor meets something new. Title, note and
 * button text are the super admin's ("Ana vitrin metni").
 */
export function pickSpotlight(seasonal:CatalogItem[],fallback:CatalogItem[],date=new Date()):CatalogItem|null{
 const season=currentSeason(date);
 const inStock=(item:CatalogItem)=>item.stockMode!=='preorder'&&(item.availableQuantity===null||item.availableQuantity===undefined||item.availableQuantity>0);
 const pool=seasonal.filter(item=>inStock(item)&&!namesOtherSeason(item.name,season));
 const ordered=[...pool.filter(item=>namesSeason(item.name,season)),...pool.filter(item=>!namesSeason(item.name,season))];
 const list=ordered.length?ordered:fallback.filter(inStock);
 if(!list.length)return null;
 const day=Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(date.getFullYear(),0,0))/86400000);
 return list[day%list.length];
}

