/**
 * The person who makes each product, shown as "Üreten" on cards and on the
 * product page.
 *
 * Only names the store itself already publishes (in the product name or in
 * its story) are listed. A product without a confirmed maker shows no maker
 * line at all; never invent one. Keyed by product slug.
 */
const MAKERS:Record<string,string>={
 'abidin-in-yayla-kuzusu-302':'Abidin',
 'amine-nin-cifte-sari-koy-yumurtasi-305':'Amine Yenge',
 'bercelan-yaylasi-bahar-cicek-bali-102':'Fatma Ana',
 'daglica-karakovan-petek-bali-101':'Süleyman Usta',
 'el-isciligi-mese-palamudu-ekmegi-505':'Ayşe Teyze',
 'el-islemesi-tahta-kasik-ve-yayik-tokmagi-704':'Selim Usta',
 'fahrettin-in-sutten-kesilmis-oglagi-303':'Fahrettin Usta',
 'gunluk-taze-civik-sut-sagimdan-kapiya-204':'Amine Ana',
 'hatun-ana-nin-eksi-maya-gunesi-tarhana-501':'Hatun Ana',
 'havahan-in-otlu-dag-peyniri-203':'Havahan',
 'husnu-dayi-nin-kagit-kabuklu-cevizi-504':'Hüsnü Dayı',
 'kekik-aromali-kesik-yogurt-kurud-703':'Hatun Teyze',
 'merez-hatun-un-magara-tulum-peyniri-201':'Merez Hatun',
 'naciye-nin-yayik-tereyagi-202':'Naciye Teyze',
 'salih-in-meralik-ozgur-horozu-304':'Salih',
 'sami-usta-nin-kurutulmus-dag-dutlari-502':'Sami Usta',
};

/** The maker's name for a product, or null when none is confirmed. */
export function productMaker(slug:unknown):string|null{
 const key=typeof slug==='string'?slug.trim():'';
 return(key&&MAKERS[key])||null;
}

/**
 * Village and district from a full origin, for a card line:
 * "Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri" becomes "Yeşiltaş Köyü, Yüksekova",
 * or the village alone when `villageOnly` is set (beside a maker's name).
 * The full origin stays on the product page.
 */
export function shortOrigin(origin:unknown,villageOnly=false):string{
 const parts=(typeof origin==='string'?origin:'').split(',').map(part=>part.trim()).filter(Boolean);
 if(!parts.length)return'';
 const village=parts[0].includes(' - ')?parts[0].split(' - ').pop()!.trim():parts[0];
 return parts.length>=2&&!villageOnly?`${village}, ${parts[1]}`:village;
}
