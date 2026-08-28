import React from'react';

function formatMinor(value:number,currency:string,locale='tr-TR'){
 try{return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);}catch{return`${(value/100).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`;}
}

type Props={priceMinor:number;currency:string;compareAtPriceMinor?:number|null;className?:string};
export default function PriceDisplay({priceMinor,currency,compareAtPriceMinor,className=''}:Props){
 const hasCompare=typeof compareAtPriceMinor==='number'&&compareAtPriceMinor>priceMinor;
 return<div className={`go-price-display ${className}`.trim()} aria-label={hasCompare?`${formatMinor(priceMinor,currency)}; önceki fiyat ${formatMinor(compareAtPriceMinor!,currency)}`:formatMinor(priceMinor,currency)}>
  <strong>{formatMinor(priceMinor,currency)}</strong>
  {hasCompare?<span aria-hidden="true">{formatMinor(compareAtPriceMinor!,currency)}</span>:null}
 </div>;
}
