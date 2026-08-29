type CardAccessibilityInput={
 name:string;
 price:number|null;
 currency:string|null;
 compareAtPrice?:number|null;
 statuses?:Array<string|null|undefined|false>;
};

function localizedNumber(value:number){return value.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});}

export function formatAccessibleMoney(value:number,currency:string){
 const normalized=currency.trim().toUpperCase();
 if(normalized==='TRY')return`${localizedNumber(value)} TL`;
 try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:normalized,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
 catch{return`${localizedNumber(value)} ${normalized}`;}
}

export function buildProductCardAccessibilityLabel({name,price,currency,compareAtPrice=null,statuses=[]}:CardAccessibilityInput){
 const parts=[name.trim()||'Ürün'];
 if(price!==null&&currency)parts.push(`fiyat ${formatAccessibleMoney(price,currency)}`);
 else parts.push('fiyat bilgisi bekleniyor');
 if(price!==null&&currency&&compareAtPrice!==null&&compareAtPrice>price)parts.push(`önceki fiyat ${formatAccessibleMoney(compareAtPrice,currency)}`);
 for(const status of statuses){if(typeof status==='string'&&status.trim()&&!parts.includes(status.trim()))parts.push(status.trim());}
 return parts.join(', ');
}
