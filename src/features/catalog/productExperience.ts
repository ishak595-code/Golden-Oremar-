export type ProductExperienceInput={
 slug?:string|null;
 name?:string|null;
 story?:string|null;
 description?:string|null;
 shortDescription?:string|null;
 origin?:string|null;
 stockMode?:string|null;
 category?:{slug?:string|null;name?:string|null}|null;
 producer?:{name?:string|null;locationLabel?:string|null;village?:string|null;district?:string|null;province?:string|null}|null;
 commerce?:{
  optionSchema?:unknown;
  seasonality?:{mode?:string|null;startMonth?:number|null;endMonth?:number|null;note?:string|null}|null;
  preorder?:{enabled?:boolean|null;preparationDaysMin?:number|null;preparationDaysMax?:number|null}|null;
  sales?:{state?:string|null;confirmed?:boolean|null;opensAt?:string|null;closesAt?:string|null;fulfillmentStartsAt?:string|null;fulfillmentEndsAt?:string|null;publicNote?:string|null}|null;
  availabilitySubscribed?:boolean|null;
 }|null;
};

export type OrderOptionChoice={value:string;label:string;description?:string};
export type OrderOptionDefinition={key:string;label:string;help?:string;required:boolean;choices:OrderOptionChoice[];visibleWhen?:{key:string;equals:string}};
export type OrderCustomizationKind='managed'|'small_ruminant'|'fish'|'mushroom'|'bread';
export type SelectedOrderOptions=Record<string,string>;
export type ProductExperience={kicker:string;story:string;orderLead:string;customizationKind:OrderCustomizationKind|null;optionSchema:OrderOptionDefinition[]};
export type OrderCustomization={schemaVersion:1;kind:OrderCustomizationKind;choices:SelectedOrderOptions};

function text(value:unknown,max=12000){return typeof value==='string'?value.trim().slice(0,max):'';}
function folded(value:unknown){return text(value,800).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c');}
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function includesAny(value:string,needles:string[]){return needles.some(needle=>value.includes(needle));}
function safeMonth(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=12?value:null;}

function normalizeSchema(value:unknown):OrderOptionDefinition[]{
 if(!Array.isArray(value))return[];
 const result:OrderOptionDefinition[]=[];
 const seen=new Set<string>();
 for(const raw of value.slice(0,8)){
  if(!record(raw))continue;
  const key=text(raw.key,40),label=text(raw.label,100);
  if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)||!label||seen.has(key)||!Array.isArray(raw.choices))continue;
  const choices:OrderOptionChoice[]=[];const choiceSeen=new Set<string>();
  for(const source of raw.choices.slice(0,12)){
   if(!record(source))continue;
   const choiceValue=text(source.value,60),choiceLabel=text(source.label,100),description=text(source.description,240);
   if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/.test(choiceValue)||!choiceLabel||choiceSeen.has(choiceValue))continue;
   choiceSeen.add(choiceValue);choices.push({value:choiceValue,label:choiceLabel,...(description?{description}:{})});
  }
  if(!choices.length)continue;
  const visible=record(raw.visibleWhen)?{key:text(raw.visibleWhen.key,40),equals:text(raw.visibleWhen.equals,60)}:null;
  seen.add(key);result.push({key,label,help:text(raw.help,240)||undefined,required:raw.required===true,choices,...(visible?.key&&visible.equals?{visibleWhen:visible}:{})});
 }
 return result;
}

function locationOf(input:ProductExperienceInput){
 const producer=input.producer||{};
 return text(input.origin,240)||text(producer.locationLabel,240)||[text(producer.village,80),text(producer.district,80),text(producer.province,80)].filter(Boolean).join(', ')||'üretim coğrafyasında';
}

function seasonalKicker(input:ProductExperienceInput){
 const note=text(input.commerce?.seasonality?.note,300);
 const mode=text(input.commerce?.seasonality?.mode,40);
 const start=safeMonth(input.commerce?.seasonality?.startMonth),end=safeMonth(input.commerce?.seasonality?.endMonth);
 if(mode==='seasonal'&&start!==null&&end!==null)return`${monthName(start)} ile ${monthName(end)} arasındaki kısa sezonun seçkisi`;
 if(mode==='made_to_order')return'Siparişinle başlayan hazırlık';
 if(note&&mode==='year_round')return'Yeni sezonu ayrı, ustalığı yıl boyu yaşayan ürün';
 const haystack=folded(`${input.name||''} ${input.category?.slug||''} ${input.category?.name||''}`);
 if(includesAny(haystack,['bahar','cagla','kuzu gobegi']))return'İlkbaharın ilk armağanı';
 if(includesAny(haystack,['tarhana','hurma','pekmez','kuru','kurut','ceviz','bamya','kislik','elma','armut']))return'Sonbaharın kışa bıraktığı lezzet';
 if(includesAny(haystack,['sut','peynir','yogurt','tereyag','ayran']))return'Yayla sütünün sabırlı emeği';
 if(includesAny(haystack,['alabal','balik']))return'Avaşin’in o günkü bereketi';
 if(includesAny(haystack,['kuzu','oglak','horoz','yumurta','ic yag']))return'Yaylanın ağır ağır büyüyen bereketi';
 if(includesAny(haystack,['bal','polen','propolis','corek otu','kekik','zahter']))return'Yüksek yaylanın kokusunu taşıyan öz';
 if(includesAny(haystack,['cilek','domates','hiyar','karpuz','kayisi','erik','meyve','sebze']))return'Mevsimin dalından gelen ilk tadı';
 return'Toprağın ve emeğin izini taşıyan seçki';
}

function storyOf(input:ProductExperienceInput){
 const existing=text(input.story,12000);
 if(existing.length>=480)return existing;
 const name=text(input.name,300)||'Bu ürün',location=locationOf(input),note=text(input.commerce?.seasonality?.note,500);
 const source=existing||text(input.description,1800)||text(input.shortDescription,1000);
 return`${seasonalKicker(input)}. ${location} çevresinde ${name} hazırlanırken ürünün kendi ritmini zorlamamak temel yaklaşımdır. Köyde üretim bilgisi yalnız ölçüyle değil; hava, su, toprak, koku, doku ve o günkü malzemenin verdiği işaretlerle birlikte okunur. ${source?`${source} `:''}Ayıklama, dinlendirme, hazırlanma ve paketleme küçük partiler halinde yürütülür; yolculuğa uygun olmayan parçalar ayrılır ve müşterinin sipariş sırasında seçtiği hazırlama tercihleri üreticiye aynı kayıt üzerinden iletilir. ${note?`${note} `:''}Buradaki anlatının amacı ürüne doğrulanmamış bir efsane yüklemek değil, neden mevsime bağlı olabildiğini ve el emeğinin hangi aşamalarda devreye girdiğini görünür kılmaktır. Golden Oremar’da ürün sayfasındaki mevsim, hazırlık ve sipariş seçenekleri yönetim panelindeki aynı veri kaynağından gelir; gerçek üretici veya saha bilgisi güncellendiğinde müşteri tarafı da aynı kayıtla güncellenir.`;
}

function managedLead(input:ProductExperienceInput,schema:OrderOptionDefinition[]){
 if(!schema.length)return'';
 const sales=input.commerce?.sales,state=text(sales?.state,40),note=text(sales?.publicNote,300);
 const min=input.commerce?.preorder?.preparationDaysMin,max=input.commerce?.preorder?.preparationDaysMax;
 if(state==='scheduled'&&sales?.opensAt)return`Sipariş dönemi ${dateTime(sales.opensAt)} tarihinde açılacak. Şimdiden haber verme isteğini açabilir, dönem başladığında bildirimi alabilirsin.`;
 if(state==='planning')return note||'Bu ürün için sezon ve sipariş penceresi hazırlanıyor. Tarih doğrulandığında haber verme isteği olan müşterilere bildirim gönderilir.';
 if(state==='preorder_open')return note||`Sipariş dönemi açık.${typeof min==='number'||typeof max==='number'?` Hazırlık süresi yaklaşık ${min??max}-${max??min} gün.`:''}`;
 if(state==='out_of_season')return note||'Ürün şu anda sezon dışında. Yeni dönem doğrulandığında haber alma isteğini açabilirsin.';
 return note||'Hazırlama ve paketleme tercihlerini siparişten önce seç. Bu seçimler sepet ve sipariş kaydında korunur.';
}

function fallbackCustomization(input:ProductExperienceInput):Pick<ProductExperience,'customizationKind'|'orderLead'|'optionSchema'> {
 const h=folded(`${input.name||''} ${input.category?.slug||''}`);
 if(includesAny(h,['kuzu','oglak','keci','koyun']))return{customizationKind:'small_ruminant',orderLead:'Kasap hazırlığını ve paket düzenini sipariş vermeden önce belirle.',optionSchema:[
  {key:'preparation',label:'Hazırlama şekli',required:true,choices:[{value:'whole',label:'Bütün karkas'},{value:'butchered',label:'Kasap usulü parçalanmış'}]},
  {key:'cutStyle',label:'Parçalama stili',required:true,visibleWhen:{key:'preparation',equals:'butchered'},choices:[{value:'balanced',label:'Dengeli kasap kesimi'},{value:'grill',label:'Izgaralık ağırlıklı'},{value:'stew',label:'Tencerelik ağırlıklı'}]},
  {key:'offal',label:'Sakatat tercihi',required:true,choices:[{value:'included',label:'Dahil et'},{value:'separate',label:'Ayrı paketle'},{value:'none',label:'İstemiyorum'}]},
  {key:'packaging',label:'Paket düzeni',required:true,choices:[{value:'by_cut',label:'Parça bazlı paket'},{value:'family_1kg',label:'Yaklaşık 1 kg aile paketleri'},{value:'large_2kg',label:'Yaklaşık 2 kg büyük paketler'}]},
 ]};
 if(includesAny(h,['alabal','balik']))return{customizationKind:'fish',orderLead:'Av, temizleme ve soğuk paket tercihlerini siparişten önce belirle.',optionSchema:[
  {key:'catchPlan',label:'Av planı',required:true,choices:[{value:'daily_catch',label:'Günlük av uygunsa ayır'},{value:'catch_to_order',label:'Sipariş üzerine av planla'}]},
  {key:'cleaning',label:'Temizleme',required:true,choices:[{value:'whole',label:'Bütün'},{value:'cleaned',label:'Temizlenmiş'},{value:'fillet',label:'Fileto'}]},
  {key:'packaging',label:'Soğuk paketleme',required:true,choices:[{value:'whole_cold',label:'Bütün soğuk paket'},{value:'portioned_cold',label:'Porsiyonlu soğuk paket'}]},
 ]};
 if(includesAny(h,['mantar','kuzu gobegi']))return{customizationKind:'mushroom',orderLead:'Boy ve paketleme tercihini seç.',optionSchema:[{key:'selection',label:'Boy seçimi',required:true,choices:[{value:'large_whole',label:'İri ve bütün ağırlıklı'},{value:'mixed',label:'Karışık boy'}]},{key:'packaging',label:'Paketleme',required:true,choices:[{value:'single_pack',label:'Tek paket'},{value:'small_portions',label:'Küçük porsiyon paketleri'}]}]};
 if(h.includes('ekmek'))return{customizationKind:'bread',orderLead:'Dilimleme tercihini seç.',optionSchema:[{key:'slicing',label:'Dilimleme',required:true,choices:[{value:'whole',label:'Bütün kalsın'},{value:'sliced',label:'Dilimlensin'}]}]};
 return{customizationKind:null,orderLead:'',optionSchema:[]};
}

export function buildProductExperience(input:ProductExperienceInput):ProductExperience{
 const managed=normalizeSchema(input.commerce?.optionSchema);
 if(managed.length)return{kicker:seasonalKicker(input),story:storyOf(input),customizationKind:'managed',orderLead:managedLead(input,managed),optionSchema:managed};
 return{kicker:seasonalKicker(input),story:storyOf(input),...fallbackCustomization(input)};
}

export function defaultOrderOptions(schema:OrderOptionDefinition[]):SelectedOrderOptions{
 const selected:SelectedOrderOptions={};
 for(const option of visibleOrderOptions(schema,selected)){if(option.required&&option.choices[0])selected[option.key]=option.choices[0].value;}
 for(let i=0;i<schema.length;i++)for(const option of visibleOrderOptions(schema,selected)){if(option.required&&!selected[option.key]&&option.choices[0])selected[option.key]=option.choices[0].value;}
 return selected;
}

export function visibleOrderOptions(schema:OrderOptionDefinition[],selected:SelectedOrderOptions){return schema.filter(option=>!option.visibleWhen||selected[option.visibleWhen.key]===option.visibleWhen.equals);}

export function selectOrderOption(schema:OrderOptionDefinition[],selected:SelectedOrderOptions,key:string,value:string):SelectedOrderOptions{
 const next={...selected,[key]:value};
 for(const option of schema){if(option.visibleWhen&&next[option.visibleWhen.key]!==option.visibleWhen.equals)delete next[option.key];}
 for(const option of visibleOrderOptions(schema,next)){if(option.required&&!next[option.key]&&option.choices[0])next[option.key]=option.choices[0].value;}
 return next;
}

export function validateOrderOptions(schema:OrderOptionDefinition[],selected:SelectedOrderOptions){
 for(const option of visibleOrderOptions(schema,selected)){
  const value=selected[option.key];
  if(option.required&&!value)return`${option.label} seçimini yapın.`;
  if(value&&!option.choices.some(choice=>choice.value===value))return`${option.label} seçimini yeniden yapın.`;
 }
 return'';
}

export function buildOrderCustomization(experience:ProductExperience,selected:SelectedOrderOptions):OrderCustomization|null{
 if(!experience.customizationKind||!experience.optionSchema.length)return null;
 const choices:SelectedOrderOptions={};
 for(const option of visibleOrderOptions(experience.optionSchema,selected)){const value=selected[option.key];if(value)choices[option.key]=value;}
 return{schemaVersion:1,kind:experience.customizationKind,choices};
}

export function orderCustomizationLines(selectedOptions:unknown):string[]{
 if(!record(selectedOptions))return[];
 const customization=record(selectedOptions.orderCustomization)?selectedOptions.orderCustomization:null;
 if(!customization)return[];
 const labels=record(customization.labels)?customization.labels:null;
 if(labels){
  return Object.values(labels).flatMap(item=>record(item)&&text(item.group,100)&&text(item.choice,100)?[`${text(item.group,100)}: ${text(item.choice,100)}`]:[]).slice(0,12);
 }
 const choices=record(customization.choices)?customization.choices:null;
 if(!choices)return[];
 return Object.entries(choices).slice(0,12).map(([key,value])=>`${humanKey(key)}: ${text(value,100)||'-'}`);
}

function humanKey(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b\w/g,char=>char.toLocaleUpperCase('tr-TR')).slice(0,100);}
function monthName(month:number){return['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][month]||'';}
function dateTime(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return'belirlenen tarihte';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(date);}catch{return'belirlenen tarihte';}}
