/**
 * The person who makes each product, shown as "Üreten" on cards and on the
 * product page.
 *
 * The name lives in the database (products.specifications.makerName) and is
 * edited in the super admin product editor ("Üreten kişi"). The catalogue
 * sends it as `makerName`. The list below is only the copy for catalogue
 * files exported before that field existed (the shipped offline catalogue);
 * the owner assigned these names on 2026-10-02. Keyed by product slug.
 */
const MAKERS:Record<string,string>={
 'abidin-in-yayla-kuzusu-302':'Abidin',
 'amine-nin-cifte-sari-koy-yumurtasi-305':'Amine Yenge',
 'ata-tohumu-dag-kekigi-suyu-distile-807':'Zübeyde',
 'avasin-cam-damacana-suyu-401':'Resul',
 'avasin-deresi-canli-alabaligi-ozel-hasat-301':'Tahir',
 'avasin-mese-bali-103':'Cahit',
 'bercelan-yaylasi-bahar-cicek-bali-102':'Fatma Ana',
 'buyuk-iskender-corek-otu-tohumu-705':'Hanife',
 'dag-cilegi-yabani-803':'Leyla',
 'daglica-karakovan-petek-bali-101':'Süleyman Usta',
 'eksi-karadut-suyu-804':'Nergis',
 'el-isciligi-mese-palamudu-ekmegi-505':'Ayşe Teyze',
 'el-islemesi-tahta-kasik-ve-yayik-tokmagi-704':'Selim Usta',
 'fahrettin-in-sutten-kesilmis-oglagi-303':'Fahrettin Usta',
 'gunes-sirri-guzu-yagi-ic-yag-701':'Cemal',
 'gunluk-taze-civik-sut-sagimdan-kapiya-204':'Amine Ana',
 'hakkari-dag-elmasi-801':'Hasan',
 'hakkari-dag-erigi-902':'Ferhat',
 'hakkari-ham-propolisi-907':'Hüseyin',
 'hakkari-yayla-karpuzu-905':'Şahin',
 'hardaliye-geleneksel-805':'Hümeyra',
 'hatun-ana-nin-eksi-maya-gunesi-tarhana-501':'Hatun Ana',
 'havahan-in-otlu-dag-peyniri-203':'Havahan',
 'husnu-dayi-nin-kagit-kabuklu-cevizi-504':'Hüsnü Dayı',
 'isli-kaya-uzumleri-tane-kuru-506':'Cafer',
 'kadin-imecesi-odun-atesi-pekmezi-503':'Zeynep',
 'kan-kirmizi-yabani-kizilcik-surubu-seti-602':'Kader',
 'kekik-aromali-kesik-yogurt-kurud-703':'Hatun Teyze',
 'kekik-aromali-visne-kompostosu-809':'Ayşe',
 'kirik-tas-kaya-tuzu-blogu-kristal-603':'Haşem',
 'kislik-kurutulmus-cennet-hurmasi-808':'Hatun',
 'kitir-taze-cagla-badem-806':'Harun',
 'koylu-isi-aci-kirmizi-biber-706':'Nergis',
 'koyun-efsanevi-beyaz-isitma-pres-tasi-402':'İmran',
 'kusburnu-marmelati-707':'Leyla',
 'merez-hatun-un-magara-tulum-peyniri-201':'Merez Hatun',
 'naciye-nin-yayik-tereyagi-202':'Naciye Teyze',
 'sabir-kurutmasi-cicek-bamyasi-702':'Hanife',
 'salih-in-meralik-ozgur-horozu-304':'Salih',
 'sami-usta-nin-kurutulmus-dag-dutlari-502':'Sami Usta',
 'sessiz-orman-kuzu-gobegi-mantari-601':'Yunus Emre',
 'sobalik-mese-yarigi-403':'Hakan',
 'tas-degirmen-yuksekova-bulguru-908':'İshak',
 'taze-yayik-ayrani-canli-kultur-205':'Naciye',
 'yuksekova-sonbahar-armudu-901':'Hasan',
 'yuksekova-yayla-domatesi-802':'Ferhat',
 'yuksekova-yayla-kayisisi-903':'Harun',
 'yuksekova-yayla-poleni-906':'Hüseyin',
 'yuksekova-yaz-hiyari-904':'Şahin',
 'zahter-harmani-dag-kekigi-507':'Zübeyde',
};

/**
 * The maker's name for a product, or null.
 * `fromCatalogue` is the catalogue's own makerName: when the catalogue sends
 * the field at all (even empty), it decides; the list above is used only
 * when the field is absent.
 */
export function productMaker(slug:unknown,fromCatalogue?:unknown):string|null{
 if(fromCatalogue!==undefined)return typeof fromCatalogue==='string'&&fromCatalogue.trim()?fromCatalogue.trim().slice(0,80):null;
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
