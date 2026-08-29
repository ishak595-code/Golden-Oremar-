type CardAccessibilityInput={
 name:string;
 price:number|null;
 currency:string|null;
 compareAtPrice?:number|null;
 statuses?:Array<string|null|undefined|false>;
};

export function formatAccessibleMoney(value:number,currency:string){
 try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
 catch{return`${value.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`;}
}

export function buildProductCardAccessibilityLabel({name,price,currency,compareAtPrice=null,statuses=[]}:CardAccessibilityInput){
 const parts=[name.trim()||'Ürün'];
 if(price!==null&&currency)parts.push(formatAccessibleMoney(price,currency));
 else parts.push('fiyat bilgisi bekleniyor');
 if(price!==null&&currency&&compareAtPrice!==null&&compareAtPrice>price)parts.push(`karşılaştırma fiyatı ${formatAccessibleMoney(compareAtPrice,currency)}`);
 for(const status of statuses){if(typeof status==='string'&&status.trim()&&!parts.includes(status.trim()))parts.push(status.trim());}
 return parts.join(', ');
}
