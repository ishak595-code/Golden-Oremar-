import React from'react';
import{Apple,Beef,Cherry,CupSoda,Droplets,Drumstick,Egg,Fish,Flame,Gem,Grape,Hammer,Hexagon,Leaf,Milk,Mountain,Nut,Salad,Sprout,TreePine,Wheat,type LucideIcon}from'lucide-react';

/**
 * Artwork for products that have no photograph yet.
 *
 * Every product without a photo used to show the Golden Oremar logo, so a
 * showcase of twelve products was twelve identical logos. Until real photos
 * are uploaded, each product gets a drawn tile instead: the colours of its
 * category, an icon for what it is, and the mountain line of Hakkâri. It is
 * clearly an illustration, never presented as a photo of the product.
 */

const BRAND_FALLBACK=/(^|\/)brand\/official-store\/golden-oremar-(profile|cover)\.webp(\?|#|$)|\/brand\/golden-oremar-official-store-(profile|cover)\.webp(\?|#|$)/;

/** True for the store logo the catalogue uses when a product has no photo. */
export function isBrandFallbackImage(src:unknown):boolean{
 return typeof src==='string'&&BRAND_FALLBACK.test(src.trim());
}

type Theme={from:string;to:string;glow:string;ink:string};
const THEMES:Record<string,Theme>={
 'bal-sifa':{from:'#3a2a08',to:'#120c02',glow:'#f0c75e',ink:'#f6d77f'},
 'sut-sarkuteri':{from:'#2c2a22',to:'#0f0e0a',glow:'#f3ead2',ink:'#f5ecd4'},
 'et-balik':{from:'#3b1418',to:'#140507',glow:'#e0806f',ink:'#f2b2a3'},
 'meyve-sebze':{from:'#3a1420',to:'#0f1a0c',glow:'#ef6f7c',ink:'#f7a7ae'},
 'kiler':{from:'#33220f',to:'#110b04',glow:'#d99a4e',ink:'#efc58c'},
 'dag-mahsulleri':{from:'#1c2a15',to:'#080f06',glow:'#a7c27a',ink:'#c9dda4'},
 'dogal-tas-enerji':{from:'#1f2428',to:'#090b0d',glow:'#b9c6cf',ink:'#d6dee4'},
 'yoresel-icecekler':{from:'#2e1027',to:'#0d050c',glow:'#d07aa8',ink:'#eab0cf'},
 'icecekler-su':{from:'#0e2a33',to:'#03100f',glow:'#7cc6d8',ink:'#b5e3ee'},
};
const DEFAULT_THEME:Theme={from:'#123326',to:'#06130e',glow:'#d3b45a',ink:'#e0c46e'};

const has=(text:string,...words:string[])=>words.some(word=>text.includes(word));

/** The icon that says what the product is, from its handling profile and name. */
export function productArtworkIcon({name='',productType='',safetyClass='',categorySlug=''}:{name?:string;productType?:string|null;safetyClass?:string|null;categorySlug?:string|null}):LucideIcon{
 const n=name.toLocaleLowerCase('tr-TR'),cls=String(safetyClass||''),type=String(productType||'');
 const byClass:Record<string,LucideIcon>={egg:Egg,honey:Hexagon,fish:Fish,poultry:Drumstick,lamb:Beef,goat:Beef,red_meat:Beef,animal_fat:Flame,raw_milk:Milk,dairy:Milk,water:Droplets,wild_mushroom:Sprout,salt:Gem,distillate:Leaf};
 if(byClass[cls])return byClass[cls];
 if(has(n,'yumurta'))return Egg;
 if(has(n,'balık','alabalı'))return Fish;
 if(has(n,' bal','balı'))return Hexagon;
 if(has(n,'horoz','tavuk'))return Drumstick;
 if(has(n,'kuzu','oğlak'))return Beef;
 if(has(n,'mantar'))return Sprout;
 if(has(n,'odun','yarığı'))return TreePine;
 if(has(n,'kaşık','tokmağ'))return Hammer;
 if(has(n,'tuz','taş'))return Gem;
 if(has(n,'ceviz','çağla','badem'))return Nut;
 if(has(n,'biber'))return Flame;
 if(has(n,'üzüm','dut','hardaliye'))return Grape;
 if(has(n,'çilek','vişne','kızılcık','kuşburnu'))return Cherry;
 if(has(n,'elma','hurma'))return Apple;
 if(has(n,'domates','bamya'))return Salad;
 if(has(n,'kekik','zahter','çörek otu'))return Leaf;
 if(type==='dairy')return Milk;
 if(type==='beverage')return CupSoda;
 if(has(n,'ekmek','tarhana','pekmez')||cls==='dry_pantry')return Wheat;
 if(categorySlug==='dag-mahsulleri')return Mountain;
 return Leaf;
}

type Props={
 name:string;
 categorySlug?:string|null;
 categoryName?:string|null;
 productType?:string|null;
 safetyClass?:string|null;
 /** 'tile' for small thumbnails, 'card' for cards, 'hero' for the product page. */
 variant?:'tile'|'card'|'hero';
 className?:string;
 /** Spoken name; omit when the surrounding control already names the product. */
 label?:string;
};

export default function ProductArtwork({name,categorySlug,categoryName,productType,safetyClass,variant='card',className='',label}:Props){
 const theme=THEMES[String(categorySlug||'')]||DEFAULT_THEME;
 const Icon=productArtworkIcon({name,productType,safetyClass,categorySlug:categorySlug||''});
 const style={'--art-from':theme.from,'--art-to':theme.to,'--art-glow':theme.glow,'--art-ink':theme.ink} as React.CSSProperties;
 const a11y=label?{role:'img','aria-label':label}:{'aria-hidden':true as const};
 return<span className={`go-artwork go-artwork--${variant} ${className}`} style={style} data-product-artwork="true" {...a11y}>
  <svg className="go-artwork__ridge" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 L0 86 L48 60 L82 74 L130 30 L170 58 L206 40 L250 76 L292 48 L338 70 L372 52 L400 64 L400 120 Z"/><path className="go-artwork__ridge-line" d="M0 96 L54 76 L96 88 L140 56 L186 80 L224 66 L268 92 L312 70 L356 86 L400 78" fill="none"/></svg>
  <span className="go-artwork__seal"><Icon aria-hidden="true"/></span>
  {variant!=='tile'?<span className="go-artwork__caption">{variant==='hero'?<><small>{categoryName||'Golden Oremar'}</small><strong>{name}</strong></>:<small>{categoryName||'Golden Oremar'}</small>}</span>:null}
 </span>;
}
