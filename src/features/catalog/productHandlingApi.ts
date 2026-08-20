import{supabase}from'../../lib/supabase';

export type ProductHandlingType='fish'|'red_meat'|'poultry'|'egg'|'animal_fat'|'dairy'|'produce'|'pantry'|'beverage'|'non_food';
export type ProductSafetyClass='general_food'|'honey'|'raw_milk'|'dairy'|'lamb'|'goat'|'poultry'|'fish'|'egg'|'animal_fat'|'wild_mushroom'|'fresh_produce'|'water'|'salt'|'distillate'|'processed_beverage'|'dry_pantry'|'non_food_safety';
export type ProductHandlingProfile={productType:ProductHandlingType|null;safetyClass:ProductSafetyClass|null;isPerishable:boolean;requiresColdChain:boolean;shelfLifeDays:number|null};
export type ProductHandlingRow={productId:string;profile:ProductHandlingProfile};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set<ProductHandlingType>(['fish','red_meat','poultry','egg','animal_fat','dairy','produce','pantry','beverage','non_food']);
const SAFETY_CLASSES=new Set<ProductSafetyClass>(['general_food','honey','raw_milk','dairy','lamb','goat','poultry','fish','egg','animal_fat','wild_mushroom','fresh_produce','water','salt','distillate','processed_beverage','dry_pantry','non_food_safety']);
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function optionalShelfLife(value:unknown){if(value==null)return null;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>36500)throw new Error('Ürün raf ömrü doğrulanamadı.');return value;}
export function normalizeProductHandlingProfile(value:unknown):ProductHandlingProfile{
 if(!record(value))throw new Error('Ürün taşıma profili doğrulanamadı.');
 const rawType=value.productType;
 const productType=rawType==null?null:typeof rawType==='string'&&TYPES.has(rawType as ProductHandlingType)?rawType as ProductHandlingType:null;
 if(rawType!=null&&productType===null)throw new Error('Ürün türü doğrulanamadı.');
 const rawSafety=value.safetyClass;
 const safetyClass=rawSafety==null?null:typeof rawSafety==='string'&&SAFETY_CLASSES.has(rawSafety as ProductSafetyClass)?rawSafety as ProductSafetyClass:null;
 if(rawSafety!=null&&safetyClass===null)throw new Error('Ürün güvenlik sınıfı doğrulanamadı.');
 if(typeof value.isPerishable!=='boolean'||typeof value.requiresColdChain!=='boolean')throw new Error('Ürün taşıma koşulları doğrulanamadı.');
 if(value.requiresColdChain===true&&value.isPerishable!==true)throw new Error('Soğuk zincir ürünü bozulabilir ürün olarak işaretlenmelidir.');
 return{productType,safetyClass,isPerishable:value.isPerishable,requiresColdChain:value.requiresColdChain,shelfLifeDays:optionalShelfLife(value.shelfLifeDays)};
}
export function optionalProductHandlingProfile(value:unknown):ProductHandlingProfile|null{if(value==null)return null;return normalizeProductHandlingProfile(value);}
export async function getProductHandlingProfiles(productIds:string[]):Promise<ProductHandlingRow[]>{
 const unique=[...new Set(productIds.map(value=>String(value||'').trim()).filter(value=>UUID_RE.test(value)))].slice(0,100);if(!unique.length)return[];
 const{data,error}=await supabase.rpc('get_public_product_handling_profiles_v1',{p_product_ids:unique});if(error)throw error;if(!Array.isArray(data))throw new Error('Ürün taşıma profilleri doğrulanamadı.');
 return data.map((row:any,index:number)=>{if(!record(row))throw new Error(`${index+1}. ürün taşıma profili doğrulanamadı.`);const productId=typeof row.productId==='string'?row.productId.trim():'';if(!UUID_RE.test(productId))throw new Error(`${index+1}. ürün taşıma profili kimliği doğrulanamadı.`);return{productId,profile:normalizeProductHandlingProfile(row.profile)};});
}
export function productHandlingLabel(profile:ProductHandlingProfile|null|undefined){
 if(!profile)return null;
 const precise:Partial<Record<ProductSafetyClass,string>>={honey:'Bal',raw_milk:'Çiğ Süt',dairy:'Süt Ürünü',lamb:'Kuzu Eti',goat:'Oğlak Eti',poultry:'Kanatlı',fish:'Balık',egg:'Yumurta',animal_fat:'Hayvansal Yağ',wild_mushroom:'Yabani Mantar',fresh_produce:'Taze Ürün',water:'Kaynak Suyu',salt:'Kaya Tuzu',distillate:'Distile İçecek',processed_beverage:'İçecek',dry_pantry:'Kiler',non_food_safety:'Gıda Dışı'};
 if(profile.safetyClass&&precise[profile.safetyClass])return precise[profile.safetyClass] as string;
 const label:Record<ProductHandlingType,string>={fish:'Balık',red_meat:'Kırmızı Et',poultry:'Kanatlı',egg:'Yumurta',animal_fat:'Hayvansal Yağ',dairy:'Süt Ürünü',produce:'Taze Ürün',pantry:'Kiler',beverage:'İçecek',non_food:'Gıda Dışı'};
 return profile.productType?label[profile.productType]:profile.isPerishable?'Bozulabilir Ürün':null;
}
