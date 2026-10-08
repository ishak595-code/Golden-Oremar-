import React from'react';
import ProductVideo from'../media/ProductVideo';

/**
 * The product page's "Sağlığınız için" and "En güzel nasıl tüketilir?" sections,
 * from the published product health content (get_public_product_safety_v3).
 *
 * Each section is plain reading text inside its own collapsible section on
 * the product page: no extra boxes, icons or nested headings that would be
 * read twice. Only what the content holds is shown; nothing is invented and
 * no medical claim is added.
 */

type Section={title?:string;items?:unknown[]};
export type ProductSafetyContent={
 summary?:string|null;
 productInfo?:{usageNotes?:unknown[];nutrition?:Record<string,unknown>};
 recipe?:{enabled?:boolean;title?:string;servings?:number;prepMinutes?:number;cookMinutes?:number;ingredients?:unknown[];steps?:unknown[]};
 safety?:{schemaVersion?:number;guidanceKind?:string;storage?:Section;preparation?:Section;warnings?:{text?:string;severity?:string}[];allergens?:{known?:unknown[];text?:string};claimPolicy?:string;sources?:{authority?:string;title?:string;topic?:string}[];videoUrl?:string;productInfo?:ProductSafetyContent['productInfo'];recipe?:ProductSafetyContent['recipe']}
};

function clean(value:unknown,max=2000){return typeof value==='string'?value.trim().slice(0,max):'';}
function strings(values:unknown){return Array.isArray(values)?values.map(value=>clean(value,600)).filter(Boolean).slice(0,20):[];}
function count(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}

function healthParts(content:ProductSafetyContent|null|undefined){
 const safety=content?.safety||{};
 const valid=Number(safety.schemaVersion||0)>=2;
 const nonFood=safety.guidanceKind==='non_food_safety';
 const nutritionKeys:Array<[string,string,string]>=[['energyKcal','Enerji','kcal'],['proteinG','Protein','g'],['carbohydrateG','Karbonhidrat','g'],['sugarsG','Şeker','g'],['fatG','Yağ','g'],['saturatedFatG','Doymuş yağ','g'],['fiberG','Lif','g'],['saltG','Tuz','g']];
 const nutritionSource=(content?.productInfo||safety.productInfo||{}).nutrition||{};
 const nutrition=nutritionKeys.flatMap(([key,label,unit])=>{const value=(nutritionSource as Record<string,unknown>)[key];return typeof value==='number'&&Number.isFinite(value)&&value>=0?[{label,value:`${value.toLocaleString('tr-TR')} ${unit}`}]:[];});
 return{
  summary:clean(content?.summary,3000),
  storage:valid?strings(safety.storage?.items):[],
  storageTitle:clean(safety.storage?.title,80)||'Saklama',
  allergenText:valid?clean(safety.allergens?.text,800):'',
  allergensKnown:valid?strings(safety.allergens?.known):[],
  allergenTitle:nonFood?'Ürün sınıfı':'Alerjen bilgisi',
  warnings:valid&&Array.isArray(safety.warnings)?safety.warnings.map(warning=>clean(warning?.text,800)).filter(Boolean).slice(0,6):[],
  claimPolicy:valid?clean(safety.claimPolicy,600):'',
  sources:valid&&Array.isArray(safety.sources)?safety.sources.map(source=>[clean(source?.authority,120),clean(source?.title,240)||clean(source?.topic,240)].filter(Boolean).join(': ')).filter(Boolean).slice(0,12):[],
  nutrition,
 };
}

export function hasHealthInfo(content:ProductSafetyContent|null|undefined){const parts=healthParts(content);return Boolean(parts.summary||parts.storage.length||parts.allergenText||parts.nutrition.length);}

export function HealthInfo({content}:{content:ProductSafetyContent|null|undefined}){
 const parts=healthParts(content);
 return<div className="go-care">
  {parts.summary?<p className="go-care__lead">{parts.summary}</p>:null}
  {parts.nutrition.length?<><h3 className="go-care__title">Besin değerleri</h3><dl className="go-care__nutrition">{parts.nutrition.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></>:null}
  {parts.storage.length?<><h3 className="go-care__title">{parts.storageTitle}</h3><ul className="go-care__list">{parts.storage.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul></>:null}
  {parts.allergenText||parts.allergensKnown.length?<><h3 className="go-care__title">{parts.allergenTitle}</h3>{parts.allergensKnown.length?<p className="go-care__text"><strong>Bilinen:</strong> {parts.allergensKnown.join(', ')}</p>:null}{parts.allergenText?<p className="go-care__text">{parts.allergenText}</p>:null}</>:null}
  {parts.warnings.map((warning,index)=><p key={`${index}:${warning}`} className="go-care__note">{warning}</p>)}
  {parts.sources.length?<><h3 className="go-care__title">Bilgi kaynakları</h3><ul className="go-care__list go-care__list--small">{parts.sources.map((source,index)=><li key={`${index}:${source}`}>{source}</li>)}</ul></>:null}
  {parts.claimPolicy?<p className="go-care__note">{parts.claimPolicy}</p>:null}
 </div>;
}

function usageParts(content:ProductSafetyContent|null|undefined,galleryVideoUrl:string|null){
 const safety=content?.safety||{};
 const info=content?.productInfo||safety.productInfo||{};
 const recipe=content?.recipe||safety.recipe||{};
 const recipeIngredients=strings(recipe.ingredients),recipeSteps=strings(recipe.steps);
 const recipeTitle=clean(recipe.title,200);
 const videoUrl=clean(safety.videoUrl,2000);
 return{
  notes:strings(info.usageNotes),
  preparation:Number(safety.schemaVersion||0)>=2?strings(safety.preparation?.items):[],
  preparationTitle:clean(safety.preparation?.title,80)||'Hazırlama',
  recipe:recipe.enabled===true&&recipeTitle&&recipeIngredients.length&&recipeSteps.length?{title:recipeTitle,ingredients:recipeIngredients,steps:recipeSteps,servings:count(recipe.servings),prep:count(recipe.prepMinutes),cook:count(recipe.cookMinutes)}:null,
  videoUrl:/^https:\/\//i.test(videoUrl)&&videoUrl!==galleryVideoUrl?videoUrl:'',
 };
}

export function hasUsageInfo(content:ProductSafetyContent|null|undefined,galleryVideoUrl:string|null=null){const parts=usageParts(content,galleryVideoUrl);return Boolean(parts.notes.length||parts.preparation.length||parts.recipe||parts.videoUrl);}

export function UsageInfo({content,productName,galleryVideoUrl=null}:{content:ProductSafetyContent|null|undefined;productName:string;galleryVideoUrl?:string|null}){
 const parts=usageParts(content,galleryVideoUrl);
 return<div className="go-care">
  {parts.notes.length?<ul className="go-care__list">{parts.notes.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul>:null}
  {parts.preparation.length?<><h3 className="go-care__title">{parts.preparationTitle}</h3><ul className="go-care__list">{parts.preparation.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul></>:null}
  {parts.recipe?<><h3 className="go-care__title">{parts.recipe.title}</h3>
   {parts.recipe.servings||parts.recipe.prep!==null||parts.recipe.cook!==null?<p className="go-care__meta">{[parts.recipe.servings?`${parts.recipe.servings} porsiyon`:'',parts.recipe.prep!==null?`Hazırlık ${parts.recipe.prep} dk`:'',parts.recipe.cook!==null?`Pişirme ${parts.recipe.cook} dk`:''].filter(Boolean).join(' · ')}</p>:null}
   <ul className="go-care__list">{parts.recipe.ingredients.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul>
   <ol className="go-care__steps">{parts.recipe.steps.map((step,index)=><li key={`${index}:${step}`}>{step}</li>)}</ol>
  </>:null}
  {parts.videoUrl?<div className="go-care__video"><ProductVideo url={parts.videoUrl} title={productName}/></div>:null}
 </div>;
}
