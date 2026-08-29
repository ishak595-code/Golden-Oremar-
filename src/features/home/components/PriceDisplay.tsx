import React from'react';

function formatMinor(value:number,currency:string,locale='tr-TR'){
 try{return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);}catch{return`${(value/100).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`;}
}

type Props={priceMinor:number;currency:string;className?:string};
export default function PriceDisplay({priceMinor,currency,className=''}:Props){
 const current=formatMinor(priceMinor,currency);
 return<div className={`go-price-display ${className}`.trim()} aria-label={current}>
  <strong>{current}</strong>
 </div>;
}
