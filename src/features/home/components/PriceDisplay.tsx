import React from'react';

function formatMinor(value:number,currency:string,locale='tr-TR'){
 try{return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);}catch{return`${(value/100).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`;}
}

type Props={priceMinor:number;currency:string;compareAtPriceMinor?:number|null;className?:string};
export default function PriceDisplay({priceMinor,currency,compareAtPriceMinor,className=''}:Props){
 const hasCompare=typeof compareAtPriceMinor==='number'&&compareAtPriceMinor>priceMinor;
 const current=formatMinor(priceMinor,currency);const previous=hasCompare?formatMinor(compareAtPriceMinor!,currency):null;
 return<div className={`go-price-display ${className}`.trim()} aria-label={previous?`${current}; önceki fiyat ${previous}`:current}>
  <strong>{current}</strong>
  {previous?<span aria-hidden="true">Önce {previous}</span>:null}
 </div>;
}
