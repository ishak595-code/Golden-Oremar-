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
};

export type OrderOptionChoice={value:string;label:string;description?:string};
export type OrderOptionDefinition={key:string;label:string;help?:string;required:boolean;choices:OrderOptionChoice[];visibleWhen?:{key:string;equals:string}};
export type OrderCustomizationKind='small_ruminant'|'fish'|'mushroom'|'bread';
export type SelectedOrderOptions=Record<string,string>;
export type ProductExperience={kicker:string;story:string;orderLead:string;customizationKind:OrderCustomizationKind|null;optionSchema:OrderOptionDefinition[]};
export type OrderCustomization={schemaVersion:1;kind:OrderCustomizationKind;choices:SelectedOrderOptions};

const PERSONAS:Record<string,string>={
 'avasin-mese-bali-103':'Hüseyin Dayı',
 'bercelan-yaylasi-bahar-cicek-bali-102':'Fatma Ana',
 'buyuk-iskender-corek-otu-tohumu-705':'Kozmik Tarlalar',
 'daglica-karakovan-petek-bali-101':'Arıcı Süleyman Usta',
 'sessiz-orman-kuzu-gobegi-mantari-601':'Orman Sakallıları',
 'el-islemesi-tahta-kasik-ve-yayik-tokmagi-704':'Selim Usta',
 'sobalik-mese-yarigi-403':'Köy Ormancıları',
 'abidin-in-yayla-kuzusu-302':'Çoban Abidin',
 'amine-nin-cifte-sari-koy-yumurtasi-305':'Amine Yenge',
 'fahrettin-in-sutten-kesilmis-oglagi-303':'Fahrettin Usta',
 'gunes-sirri-guzu-yagi-ic-yag-701':'Kasap Mahmut',
 'salih-in-meralik-ozgur-horozu-304':'Kümenci Salih Dayı',
 'el-isciligi-mese-palamudu-ekmegi-505':'Ayşe Teyze',
 'husnu-dayi-nin-kagit-kabuklu-cevizi-504':'Hüsnü Dayı',
 'koylu-isi-aci-kirmizi-biber-706':'Zeliş Abla',
 'kusburnu-marmelati-707':'Oremar Kadın Üretici Grubu',
 'kitir-taze-cagla-badem-806':'Bademli Köyü Çiftçiliği',
 'yuksekova-yayla-domatesi-802':'Hakkari Tarım Kooperatifi',
 'havahan-in-otlu-dag-peyniri-203':'Havahan Abla',
 'ata-tohumu-dag-kekigi-suyu-distile-807':'Toros Yörük Kadınları',
 'eksi-karadut-suyu-804':'Dağ Köy Atölyesi',
 'hardaliye-geleneksel-805':'Kırklareli Üretim Kooperatifi',
};

function text(value:unknown,max=12000){return typeof value==='string'?value.trim().slice(0,max):'';}
function folded(value:unknown){return text(value,600).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c');}
function includesAny(value:string,needles:string[]){return needles.some(needle=>value.includes(needle));}

function locationOf(input:ProductExperienceInput){
 const producer=input.producer||{};
 return text(input.origin,240)||text(producer.locationLabel,240)||[text(producer.village,80),text(producer.district,80),text(producer.province,80)].filter(Boolean).join(', ')||'üretim coğrafyasında';
}

function personaOf(input:ProductExperienceInput){
 const slug=text(input.slug,240);
 if(slug&&PERSONAS[slug])return PERSONAS[slug];
 const story=text(input.story,500);
 const match=story.match(/^(.{2,90}?)\s+kaydındaki\s+bu\s+ürünün/i);
 if(match?.[1])return match[1].trim();
 const name=text(input.name,300);
 const possessive=name.match(/^(.{2,80}?)(?:'in|'ın|'un|'ün|’in|’ın|’un|’ün)\s+/i);
 if(possessive?.[1])return possessive[1].trim();
 return 'köyün üreticileri';
}

function seasonalKicker(input:ProductExperienceInput){
 const haystack=folded(`${input.name||''} ${input.category?.slug||''} ${input.category?.name||''}`);
 if(includesAny(haystack,['bahar','cagla','kuzu gobegi']))return'İlkbaharın ilk armağanı';
 if(includesAny(haystack,['tarhana','hurma','pekmez','kuru','kurut','ceviz','bamya','kislik']))return'Sonbaharın kışa bıraktığı lezzet';
 if(includesAny(haystack,['sut','peynir','yogurt','tereyag','ayran']))return'Soğuk sabahların beyaz mirası';
 if(includesAny(haystack,['alabal','balik']))return'Avaşin’in o günkü bereketi';
 if(includesAny(haystack,['kuzu','oglak','horoz','yumurta','ic yag']))return'Yaylanın ağır ağır büyüyen bereketi';
 if(includesAny(haystack,['bal','corek otu','kekik','zahter']))return'Yüksek yaylanın kokusunu taşıyan öz';
 if(includesAny(haystack,['elma','cilek','domates','meyve','sebze']))return'Mevsimin dalından gelen ilk tadı';
 if(includesAny(haystack,['su','damacana']))return'Dağın taşından süzülen berraklık';
 if(includesAny(haystack,['kasik','tokmak','tas','mese','odun']))return'Köy elinin nesilden nesile izi';
 if(input.stockMode==='preorder')return'Senin siparişinle hazırlanan köy seçkisi';
 return'Toprağın ve emeğin izini taşıyan seçki';
}

function craftParagraph(input:ProductExperienceInput){
 const haystack=folded(`${input.name||''} ${input.category?.slug||''} ${input.category?.name||''}`);
 if(includesAny(haystack,['bal','corek otu','kekik','zahter']))return'Yüksek rakımın kısa ama yoğun sezonunda bitkinin, çiçeğin ve havanın ritmi aynı anda izlenir. Toplama ya da hasat için acele edilmez; aroma henüz oturmamışsa bir gün daha beklemek, fazla güneş görmüşse gölgeye almak, ürünün kendi karakterini bozmadan saklamak köyde işin temel terbiyesidir. Küçük partiler halinde ayrılan ürün, kokusunu ve dokusunu koruyacak biçimde hazırlanır; amaç her kavanozda ya da pakette aynı fabrikasyon tadı üretmek değil, o mevsimin gerçek izini dürüstçe taşımaktır.';
 if(includesAny(haystack,['kuzu','oglak','horoz','yumurta','ic yag']))return'Hayvanın büyüme temposu takvim yaprağıyla değil, meranın durumu ve bakım rutiniyle okunur. Köyde ustalık yalnızca son hazırlıkta değil, aylar süren gözlemde başlar. Yem, su, hareket ve mevsim değişimi birlikte takip edilir; ürün siparişe hazırlanırken bütünlük, parçalama ve paketleme tercihleri ayrı ayrı ele alınır. Böylece müşteriye rastgele hazırlanmış bir koli değil, nasıl kullanılacağı baştan düşünülmüş, üreticiyle sipariş arasındaki bağı koruyan düzenli bir teslimat çıkar.';
 if(includesAny(haystack,['alabal','balik']))return'Derenin suyu, hava sıcaklığı ve akıntı her gün aynı değildir. Bu yüzden burada balık bir raf ürünü gibi düşünülmez. Siparişin niteliğine göre mevcut günlük av değerlendirilir ya da yakalama planı oluşturulur; ardından temizleme ve porsiyonlama tercihi uygulanır. Soğuk teslimat disiplini hazırlığın parçasıdır. Köylü balıkçıların yıllardır bildiği esas basittir: suyun zamanına saygı göstermek, gereğinden fazla bekletmemek ve ürünü sofraya ulaşacağı biçimi düşünerek hazırlamak.';
 if(includesAny(haystack,['sut','peynir','yogurt','tereyag','ayran']))return'Süt ürünlerinde asıl ustalık hız ile sabır arasındaki dengeyi kurmaktır. Sağımın saati, sütün sıcaklığı, mayalama ya da yayık aşamasının süresi ve dinlendirme ortamı birbirinden kopuk görülmez. Köy kadınlarının yıllar içinde el yordamıyla öğrendiği kıvam bilgisi, yalnızca tarifte yazan ölçüye değil sese, kokuya ve dokununca verdiği cevaba dayanır. Ürün küçük partiler halinde hazırlanır; hedef abartılı bir standart görüntü değil, temiz işçilikle korunmuş doğal doku ve sofrada kendini belli eden belirgin bir karakterdir.';
 if(includesAny(haystack,['tarhana','pekmez','kuru','kurut','ceviz','bamya','biber','marmelat','ekmek','kiler','hurma']))return'Kiler ürünleri köyde bolluğu saklama sanatıdır. Yazın ya da sonbaharın doğru anında seçilen ürün önce ayıklanır, sonra gerekiyorsa güneş, gölge, odun ateşi ya da yavaş dinlendirme ile dayanıklı hale getirilir. Bu işin inceliği hızlı bitirmek değil, nemi, kokuyu ve dokuyu her gün yeniden kontrol etmektir. Büyüklerden öğrenilen yöntemlerin ortak noktası israf etmemek ve malzemeyi olduğundan başka bir şeye çevirmemektir. Sonuç, kış sofrasına açıldığında hâlâ mevsimini hatırlatan yoğun ve karakterli bir kiler ürünüdür.';
 if(includesAny(haystack,['elma','cilek','domates','cagla','meyve','sebze']))return'Taze ürünlerde kalite hasattan önce başlar. Güneşin sertliği, gece serinliği, rüzgâr ve toprağın suyu meyvenin ya da sebzenin dokusunu her gün biraz değiştirir. Köyde toplama zamanı yalnızca renge bakılarak seçilmez; sapın direnci, koku, kabuğun verdiği ses ve o günün hava koşulu birlikte değerlendirilir. Ezilen ya da yolculuğa uygun olmayan ürün ayrılır, iyi olanlar küçük partiler halinde hazırlanır. Böylece kutuya yalnızca güzel görünen değil, yola dayanabilecek ve sofraya vardığında hâlâ canlı karakterini koruyabilecek ürün girer.';
 if(includesAny(haystack,['kasik','tokmak','tas','mese','odun']))return'El emeği ve doğal malzemede her parça birbirinin kopyası olmak zorunda değildir. Usta önce damarını, çatlağını, ağırlığını ve kullanım yönünü okur; sonra gereksiz müdahaleden kaçınarak malzemenin kendi karakterini ortaya çıkarır. Köyde bu bilgi çoğu zaman tezgâh başında, bir büyüğün elini izleyerek öğrenilir. Ölçü yalnızca cetvelle değil, elde bıraktığı dengeyle de anlaşılır. Hazırlanan parça günlük kullanım için sağlamlık, yüzey güvenliği ve uzun ömür gözetilerek seçilir; küçük farklılıklar kusur değil, doğal malzemenin kimliğidir.';
 return'Ürün hazırlanırken önce malzemenin mevsimi, dokusu ve yolculuğa dayanıklılığı değerlendirilir. Köyde nesilden nesile aktarılan yaklaşım, bir işi hızla bitirmekten çok doğru zamanda doğru müdahaleyi yapmaya dayanır. Ayıklama, dinlendirme, paketleme ve saklama adımları ürünün kendi karakterine göre yürütülür. Küçük partiler halinde çalışmak, üreticinin her aşamayı gözle kontrol edebilmesini sağlar. Böylece ortaya yalnızca satılacak bir ürün değil, üretildiği yerin koşullarını ve el emeğinin izini taşıyan daha anlamlı bir sofra parçası çıkar.';
}

function generatedStory(input:ProductExperienceInput){
 const name=text(input.name,300)||'bu ürün';
 const persona=personaOf(input);
 const location=locationOf(input);
 const kicker=seasonalKicker(input);
 return`${kicker}. ${location} çevresinde ${name} hazırlanırken ${persona} için ilk kural ürünü zorlamak değil, onun zamanını okumaktır. Bu işi köyde kendinden önce yapan insanların yanında görerek, sorarak ve tekrar ederek öğrenen eller; hava değişimini, toprağın kokusunu, suyun sertliğini ve malzemenin dokusunu aynı hikâyenin parçaları sayar. ${craftParagraph(input)} Golden Oremar’da bu anlatının değeri süslü bir efsane kurmakta değil, ürünün nereden geldiğini, neden sınırlı olabildiğini ve neden her partinin küçük farklılıklar taşıyabildiğini görünür kılmaktadır. Sipariş hazırlanırken ürünün niteliğine göre seçim, ayıklama ve paketleme yeniden kontrol edilir. Kutuyu açtığınızda amaç yalnızca iyi bir tat ya da iyi bir parça görmek değil; ${location} coğrafyasının emeğini, mevsimini ve insan dokunuşunu mümkün olduğunca bozmadan sofranıza taşımaktır.`;
}

function storyOf(input:ProductExperienceInput){
 const existing=text(input.story,12000);
 const placeholder=/kaydındaki bu ürünün köken, üretim yöntemi ve parti bilgileri belge doğrulamasından sonra müşteriye gösterilir/i.test(existing);
 const risky=/(astıma|hücre|devadır|tedavi|iyileştir|radyasyon bilmeyen|mikro plastik taşımayan|84 ayrı mineral|pH\s*8[.,]4)/i.test(existing);
 if(existing.length>=500&&!placeholder&&!risky)return existing;
 return generatedStory(input);
}

function customizationFor(input:ProductExperienceInput):Pick<ProductExperience,'customizationKind'|'orderLead'|'optionSchema'>{
 const haystack=folded(`${input.name||''} ${input.category?.slug||''} ${input.category?.name||''}`);
 if(includesAny(haystack,['kuzu','oglak','keci','koyun']))return{
  customizationKind:'small_ruminant',
  orderLead:'Bütün mü, parçalanmış mı? Kasap hazırlığını ve paket düzenini sipariş vermeden önce sen belirle.',
  optionSchema:[
   {key:'preparation',label:'Hazırlama şekli',required:true,choices:[{value:'whole',label:'Bütün karkas',description:'Bütün olarak hazırlanır.'},{value:'butchered',label:'Kasap usulü parçalanmış',description:'Seçtiğin kesim düzenine göre hazırlanır.'}]},
   {key:'cutStyle',label:'Parçalama stili',required:true,visibleWhen:{key:'preparation',equals:'butchered'},choices:[{value:'balanced',label:'Dengeli kasap kesimi'},{value:'family',label:'Ailelik karışık'},{value:'grill',label:'Izgaralık ağırlıklı'},{value:'stew',label:'Tencerelik ağırlıklı'}]},
   {key:'offal',label:'Sakatat tercihi',required:true,choices:[{value:'included',label:'Dahil et'},{value:'separate',label:'Ayrı paketle'},{value:'none',label:'İstemiyorum'}]},
   {key:'packaging',label:'Paket düzeni',required:true,choices:[{value:'by_cut',label:'Parça bazlı paketle'},{value:'family_1kg',label:'Yaklaşık 1 kg aile paketleri'},{value:'large_2kg',label:'Yaklaşık 2 kg büyük paketler'}]},
  ],
 };
 if(includesAny(haystack,['alabal','balik']))return{
  customizationKind:'fish',
  orderLead:'Balığın tedarik ve hazırlık biçimini seç. Siparişin, balıkçıya doğrudan uygulanabilir bir hazırlık planı olarak gider.',
  optionSchema:[
   {key:'catchPlan',label:'Tedarik tercihi',required:true,choices:[{value:'daily_catch',label:'Günlük av uygunsa ayır'},{value:'catch_to_order',label:'Sipariş üzerine avlansın'}]},
   {key:'cleaning',label:'Temizleme',required:true,choices:[{value:'whole',label:'Bütün'},{value:'cleaned',label:'Temizlenmiş'},{value:'fillet',label:'Fileto'}]},
   {key:'packaging',label:'Paketleme',required:true,choices:[{value:'whole_cold',label:'Bütün soğuk paket'},{value:'portioned_cold',label:'Porsiyonlu soğuk paket'}]},
  ],
 };
 if(includesAny(haystack,['kuzu gobegi','mantar']))return{
  customizationKind:'mushroom',
  orderLead:'Doğadan gelen ürün aynı boyda olmaz. Seçim ve paket düzenini önceden belirleyebilirsin.',
  optionSchema:[
   {key:'selection',label:'Tane seçimi',required:true,choices:[{value:'large_whole',label:'İri ve bütün ağırlıklı'},{value:'mixed',label:'Karışık boy'}]},
   {key:'packaging',label:'Paket düzeni',required:true,choices:[{value:'single_pack',label:'Tek paket'},{value:'small_portions',label:'Küçük porsiyon paketleri'}]},
  ],
 };
 if(includesAny(haystack,['ekmek']))return{
  customizationKind:'bread',
  orderLead:'Ekmeğin sofraya nasıl geleceğini seç. Hazırlık tercihi siparişle birlikte üreticiye iletilir.',
  optionSchema:[{key:'slicing',label:'Dilimleme',required:true,choices:[{value:'whole',label:'Bütün kalsın'},{value:'sliced',label:'Dilimlensin'}]}],
 };
 return{customizationKind:null,orderLead:'',optionSchema:[]};
}

export function buildProductExperience(input:ProductExperienceInput):ProductExperience{
 const customization=customizationFor(input);
 return{kicker:seasonalKicker(input),story:storyOf(input),...customization};
}

export function defaultOrderOptions(schema:OrderOptionDefinition[]):SelectedOrderOptions{
 const result:SelectedOrderOptions={};
 for(const option of schema){
  if(option.visibleWhen)continue;
  const first=option.choices[0]?.value;
  if(first)result[option.key]=first;
 }
 return result;
}

export function visibleOrderOptions(schema:OrderOptionDefinition[],selected:SelectedOrderOptions){return schema.filter(option=>!option.visibleWhen||selected[option.visibleWhen.key]===option.visibleWhen.equals);}

export function validateOrderOptions(schema:OrderOptionDefinition[],selected:SelectedOrderOptions){
 for(const option of visibleOrderOptions(schema,selected)){
  const value=selected[option.key];
  if(option.required&&!value)return`${option.label} seçilmelidir.`;
  if(value&&!option.choices.some(choice=>choice.value===value))return`${option.label} seçimi geçersiz.`;
 }
 return'';
}

export function selectOrderOption(schema:OrderOptionDefinition[],current:SelectedOrderOptions,key:string,value:string){
 const next={...current,[key]:value};
 for(const option of schema){if(option.visibleWhen&&option.visibleWhen.key===key&&value!==option.visibleWhen.equals)delete next[option.key];}
 for(const option of visibleOrderOptions(schema,next)){if(!next[option.key]&&option.choices[0]?.value)next[option.key]=option.choices[0].value;}
 return next;
}

export function buildOrderCustomization(experience:ProductExperience,selected:SelectedOrderOptions):OrderCustomization|null{
 if(!experience.customizationKind||!experience.optionSchema.length)return null;
 const error=validateOrderOptions(experience.optionSchema,selected);
 if(error)throw new Error(error);
 const choices:SelectedOrderOptions={};
 for(const option of visibleOrderOptions(experience.optionSchema,selected)){const value=selected[option.key];if(value)choices[option.key]=value;}
 return{schemaVersion:1,kind:experience.customizationKind,choices};
}

const OPTION_LABELS:Record<string,Record<string,Record<string,string>>>={
 small_ruminant:{preparation:{whole:'Bütün karkas',butchered:'Kasap usulü parçalanmış'},cutStyle:{balanced:'Dengeli kasap kesimi',family:'Ailelik karışık',grill:'Izgaralık ağırlıklı',stew:'Tencerelik ağırlıklı'},offal:{included:'Sakatat dahil',separate:'Sakatat ayrı paket',none:'Sakatat yok'},packaging:{by_cut:'Parça bazlı paket',family_1kg:'Yaklaşık 1 kg paketler',large_2kg:'Yaklaşık 2 kg paketler'}},
 fish:{catchPlan:{daily_catch:'Günlük av uygunsa ayır',catch_to_order:'Sipariş üzerine av'},cleaning:{whole:'Bütün',cleaned:'Temizlenmiş',fillet:'Fileto'},packaging:{whole_cold:'Bütün soğuk paket',portioned_cold:'Porsiyonlu soğuk paket'}},
 mushroom:{selection:{large_whole:'İri ve bütün ağırlıklı',mixed:'Karışık boy'},packaging:{single_pack:'Tek paket',small_portions:'Küçük porsiyon paketleri'}},
 bread:{slicing:{whole:'Bütün',sliced:'Dilimlenmiş'}},
};

export function describeOrderCustomization(selectedOptions:Record<string,unknown>|null|undefined){
 if(!selectedOptions||typeof selectedOptions!=='object'||Array.isArray(selectedOptions))return[];
 const raw=(selectedOptions as Record<string,unknown>).orderCustomization;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return[];
 const kind=text((raw as any).kind,60);
 const choices=(raw as any).choices;
 if(!kind||!choices||typeof choices!=='object'||Array.isArray(choices))return[];
 const labels=OPTION_LABELS[kind]||{};
 return Object.entries(choices).flatMap(([key,value])=>{const code=text(value,80);const label=labels[key]?.[code];return label?[label]:[];}).slice(0,8);
}
