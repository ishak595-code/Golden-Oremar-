/**
 * The person who makes each product, shown as "Üreten" on cards and on the
 * product page.
 *
 * The name lives in the database (products.specifications.makerName) and is
 * edited in the super admin product editor ("Üreten kişi"). The catalogue
 * sends it as `makerName`. The list below is only the copy for catalogue
 * files exported before that field existed (the shipped offline catalogue);
 * the owner assigned these names on 2026-10-02.
 */
// Keyed by the product number at the end of the slug, to keep the app's first download small.
const MAKERS:Record<string,string>={302:'Abidin',305:'Amine Yenge',807:'Zübeyde',401:'Resul',301:'Tahir',103:'Cahit',102:'Fatma Ana',705:'Hanife',803:'Leyla',101:'Süleyman Usta',804:'Nergis',505:'Ayşe Teyze',704:'Selim Usta',303:'Fahrettin Usta',701:'Cemal',204:'Amine Ana',801:'Hasan',902:'Ferhat',907:'Hüseyin',905:'Şahin',805:'Hümeyra',501:'Hatun Ana',203:'Havahan',504:'Hüsnü Dayı',506:'Cafer',503:'Zeynep',602:'Kader',703:'Hatun Teyze',809:'Ayşe',603:'Haşem',808:'Hatun',806:'Harun',706:'Nergis',402:'İmran',707:'Leyla',201:'Merez Hatun',202:'Naciye Teyze',702:'Hanife',304:'Salih',502:'Sami Usta',601:'Yunus Emre',403:'Hakan',908:'İshak',205:'Naciye',901:'Hasan',802:'Ferhat',903:'Harun',906:'Hüseyin',904:'Şahin',507:'Zübeyde'};

/**
 * The maker's name for a product, or null.
 * `fromCatalogue` is the catalogue's own makerName: when the catalogue sends
 * the field at all (even empty), it decides; the list above is used only
 * when the field is absent.
 */
export function productMaker(slug:unknown,fromCatalogue?:unknown):string|null{
 if(fromCatalogue!==undefined)return typeof fromCatalogue==='string'&&fromCatalogue.trim()?fromCatalogue.trim().slice(0,80):null;
 const key=typeof slug==='string'?slug.trim().match(/-(\d+)$/)?.[1]:'';
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
