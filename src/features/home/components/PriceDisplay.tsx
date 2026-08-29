import React from'react';

function formatMinor(value:number,currency:string,locale='tr-TR'){
 const normalized=currency.trim().toUpperCase();
 const amount=(value/100).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2});
 if(normalized==='TRY')return`${amount} TL`;
 try{return new Intl.NumberFormat(locale,{style:'currency',currency:normalized,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);}catch{return`${amount} ${normalized}`;}
}

type Props={priceMinor:number;currency:string;compareAtPriceMinor?:number|null;className?:string};
export default function PriceDisplay({priceMinor,currency,compareAtPriceMinor=null,className=''}:Props){
 const current=formatMinor(priceMinor,currency);
 const compare=typeof compareAtPriceMinor==='number'&&Number.isSafeInteger(compareAtPriceMinor)&&compareAtPriceMinor>priceMinor?formatMinor(compareAtPriceMinor,currency):null;
 return<div className={`go-price-display ${className}`.trim()} aria-hidden="true">
  <strong>{current}</strong>
  {compare?<span>Önce {compare}</span>:null}
 </div>;
}
