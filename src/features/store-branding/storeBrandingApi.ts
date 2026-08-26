import{supabase}from'../../lib/supabase';

export type StoreBrandingKind='logo'|'cover';
export type StoreBrandingSnapshot={producerId:string;displayName:string;storeKind:string;status:string;verified:boolean;logoPath:string;coverPath:string;canEdit:boolean;logoBinaryVerified:boolean;coverBinaryVerified:boolean};
export type StoreBrandingDimensions={width:number;height:number};
export type StoreBrandingValidation={dimensions:StoreBrandingDimensions;cropDimensions:StoreBrandingDimensions;sizeBytes:number;mime:string};
export type PreparedStoreBrandingAsset={file:File;sourceDimensions:StoreBrandingDimensions;cropDimensions:StoreBrandingDimensions;outputDimensions:StoreBrandingDimensions;outputBytes:number;outputMime:string};

const MAX_SOURCE_BYTES=20*1024*1024;
const MAX_SOURCE_PIXELS=80_000_000;
export const STORE_BRANDING_SPECS={
 logo:{recommendedWidth:1024,recommendedHeight:1024,minWidth:512,minHeight:512,maxWidth:4096,maxHeight:4096,ratio:1,maxBytes:5*1024*1024,maxSourceBytes:MAX_SOURCE_BYTES,label:'Logo'},
 cover:{recommendedWidth:1500,recommendedHeight:600,minWidth:1200,minHeight:480,maxWidth:6000,maxHeight:2400,ratio:2.5,maxBytes:5*1024*1024,maxSourceBytes:MAX_SOURCE_BYTES,label:'Kapak'},
}as const;

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set(['image/jpeg','image/png','image/webp']);
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,label:string,max=300,optional=false){if(value==null&&optional)return'';if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const normalized=value.trim();if((!optional&&!normalized)||normalized.length>max||/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function storagePath(value:unknown,label:string){const normalized=text(value,label,1200,true);if(!normalized)return'';if(normalized.startsWith('/')||/^[a-z][a-z0-9+.-]*:/i.test(normalized)||normalized.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function normalizeSnapshot(value:unknown):StoreBrandingSnapshot{if(!record(value))throw new Error('Mağaza görsel paketi doğrulanamadı.');const producerId=text(value.producerId,'Mağaza kimliği',80);if(!UUID_RE.test(producerId))throw new Error('Mağaza kimliği doğrulanamadı.');return{producerId,displayName:text(value.displayName,'Mağaza adı',240),storeKind:text(value.storeKind,'Mağaza tipi',40),status:text(value.status,'Mağaza durumu',40),verified:bool(value.verified,'Mağaza doğrulaması'),logoPath:storagePath(value.logoPath,'Logo yolu'),coverPath:storagePath(value.coverPath,'Kapak yolu'),canEdit:bool(value.canEdit,'Görsel düzenleme yetkisi'),logoBinaryVerified:bool(value.logoBinaryVerified,'Logo binary doğrulaması'),coverBinaryVerified:bool(value.coverBinaryVerified,'Kapak binary doğrulaması')};}
function normalizeId(value:string){const normalized=String(value||'').trim().toLowerCase();if(!UUID_RE.test(normalized))throw new Error('Mağaza kimliği doğrulanamadı.');return normalized;}
function extension(mime:string){if(mime==='image/jpeg')return'jpg';if(mime==='image/png')return'png';if(mime==='image/webp')return'webp';throw new Error('Logo ve kapak yalnız JPEG, PNG veya WebP olabilir.');}
function profilePathOwnedBy(producerId:string,path:string){return new RegExp(`^${producerId}/profile/(logo|cover)-[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$`,'i').test(path);}

export function storeBrandingAssetUrl(path:string){const normalized=storagePath(path,'Mağaza görseli');return normalized?supabase.storage.from('catalog-public').getPublicUrl(normalized).data.publicUrl:'';}
export async function getStoreBranding(producerId:string){const id=normalizeId(producerId);const{data,error}=await supabase.rpc('get_store_branding_editor_v1',{p_producer_id:id});if(error)throw error;return normalizeSnapshot(data);}

type DecodedImage={source:CanvasImageSource;width:number;height:number;dispose:()=>void};
async function decodeImage(file:File):Promise<DecodedImage>{
 if(typeof createImageBitmap==='function'){
  const bitmap=await createImageBitmap(file);
  if(!bitmap.width||!bitmap.height){bitmap.close();throw new Error('Görsel ölçüleri okunamadı.');}
  return{source:bitmap,width:bitmap.width,height:bitmap.height,dispose:()=>bitmap.close()};
 }
 const url=URL.createObjectURL(file);
 return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({source:image,width:image.naturalWidth,height:image.naturalHeight,dispose:()=>URL.revokeObjectURL(url)});image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Görsel ölçüleri okunamadı.'));};image.src=url;});
}
function centerCrop(width:number,height:number,targetRatio:number){const sourceRatio=width/height;if(sourceRatio>targetRatio){const cropHeight=height,cropWidth=height*targetRatio;return{x:(width-cropWidth)/2,y:0,width:cropWidth,height:cropHeight};}const cropWidth=width,cropHeight=width/targetRatio;return{x:0,y:(height-cropHeight)/2,width:cropWidth,height:cropHeight};}

export async function validateStoreBrandingFile(file:File,kind:StoreBrandingKind):Promise<StoreBrandingValidation>{
 if(!(file instanceof File))throw new Error('Görsel dosyası seçilmedi.');
 if(!TYPES.has(file.type))throw new Error('Logo ve kapak için JPEG, PNG veya WebP seçin.');
 if(file.size<1||file.size>MAX_SOURCE_BYTES)throw new Error('Kaynak görsel en fazla 20 MB olabilir. Uygulama yüklemeden önce otomatik olarak optimize eder.');
 let decoded:DecodedImage;try{decoded=await decodeImage(file);}catch{throw new Error('Görselin piksel ölçüleri okunamadı. JPEG, PNG veya WebP dosyası kullanın.');}
 try{
  const{width,height}=decoded;if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>MAX_SOURCE_PIXELS)throw new Error('Kaynak görsel ölçüleri güvenli işleme sınırının dışında.');
  const spec=STORE_BRANDING_SPECS[kind],crop=centerCrop(width,height,spec.ratio);
  if(crop.width<spec.minWidth||crop.height<spec.minHeight)throw new Error(kind==='logo'?`Net bir logo/profil fotoğrafı seçin. Kare kadraj için en az ${spec.minWidth} × ${spec.minHeight} px görüntü bilgisi gerekir.`:`Daha yüksek çözünürlüklü bir kapak seçin. Otomatik 5:2 kadrajın en az ${spec.minWidth} × ${spec.minHeight} px görüntü bilgisi içermesi gerekir.`);
  return{dimensions:{width,height},cropDimensions:{width:Math.floor(crop.width),height:Math.floor(crop.height)},sizeBytes:file.size,mime:file.type};
 }finally{decoded.dispose();}
}

function canvasBlob(canvas:HTMLCanvasElement,type:string,quality?:number){return new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality));}
export async function prepareStoreBrandingFile(file:File,kind:StoreBrandingKind):Promise<PreparedStoreBrandingAsset>{
 const validation=await validateStoreBrandingFile(file,kind),decoded=await decodeImage(file),spec=STORE_BRANDING_SPECS[kind];
 try{
  const crop=centerCrop(decoded.width,decoded.height,spec.ratio),canvas=document.createElement('canvas');canvas.width=spec.recommendedWidth;canvas.height=spec.recommendedHeight;
  const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('Görsel işleme motoru başlatılamadı.');
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.clearRect(0,0,canvas.width,canvas.height);
  context.drawImage(decoded.source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
  let blob=await canvasBlob(canvas,'image/webp',0.92);
  if(!blob||blob.type!=='image/webp')blob=await canvasBlob(canvas,'image/png');
  if(!blob)throw new Error('Optimize edilmiş görsel oluşturulamadı.');
  if(blob.size>spec.maxBytes&&blob.type==='image/webp')blob=await canvasBlob(canvas,'image/webp',0.84);
  if(!blob)throw new Error('Optimize edilmiş görsel oluşturulamadı.');
  if(blob.size>spec.maxBytes)throw new Error('Görsel optimize edildi ancak 5 MB sınırının altına indirilemedi. Daha sade veya daha küçük bir kaynak görsel seçin.');
  const outputMime=blob.type==='image/webp'?'image/webp':'image/png',outputExt=extension(outputMime),processed=new File([blob],`${kind}-golden-oremar.${outputExt}`,{type:outputMime,lastModified:Date.now()});
  return{file:processed,sourceDimensions:validation.dimensions,cropDimensions:validation.cropDimensions,outputDimensions:{width:spec.recommendedWidth,height:spec.recommendedHeight},outputBytes:processed.size,outputMime};
 }finally{decoded.dispose();}
}

async function edgeErrorMessage(error:unknown,data:unknown){let code='';if(record(data)&&typeof data.error==='string')code=data.error;const context=(error as {context?:unknown}|null)?.context;if(!code&&typeof Response!=='undefined'&&context instanceof Response){try{const payload=await context.clone().json();if(record(payload)&&typeof payload.error==='string')code=payload.error;}catch{/* response body is optional */}}return storeBrandingError(code||String((error as {message?:unknown}|null)?.message||''));}
function isPrepared(value:File|PreparedStoreBrandingAsset):value is PreparedStoreBrandingAsset{return !(value instanceof File);}
export async function uploadAndBindStoreBrandAsset(producerId:string,kind:StoreBrandingKind,input:File|PreparedStoreBrandingAsset){
 const id=normalizeId(producerId),prepared=isPrepared(input)?input:await prepareStoreBrandingFile(input,kind),file=prepared.file,path=`${id}/profile/${kind}-${crypto.randomUUID()}.${extension(file.type)}`;let uploaded=false;
 try{
  const{error:uploadError}=await supabase.storage.from('catalog-public').upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});if(uploadError)throw uploadError;uploaded=true;
  const{data:verified,error:verifyError}=await supabase.functions.invoke('catalog-media-verify',{body:{path}});if(verifyError||!record(verified)||verified.ok!==true)throw new Error(await edgeErrorMessage(verifyError,verified));
  if(verified.assetKind!==kind||verified.width!==prepared.outputDimensions.width||verified.height!==prepared.outputDimensions.height)throw new Error('Sunucu ile cihazdaki HD görsel doğrulaması eşleşmedi.');
  const{data:bound,error:bindError}=await supabase.rpc('set_store_branding_asset_v1',{p_producer_id:id,p_kind:kind,p_path:path});if(bindError)throw bindError;if(!record(bound)||bound.ok!==true||bound.path!==path)throw new Error('Mağaza görseli sunucuya bağlanamadı.');
  uploaded=false;const previousPath=storagePath(bound.previousPath,'Önceki mağaza görseli');if(previousPath&&previousPath!==path&&profilePathOwnedBy(id,previousPath))await supabase.storage.from('catalog-public').remove([previousPath]).catch(()=>undefined);
  return await getStoreBranding(id);
 }catch(error){if(uploaded)await supabase.storage.from('catalog-public').remove([path]).catch(()=>undefined);if(error instanceof Error&&error.message)throw error;throw new Error(storeBrandingError(error));}
}

export function storeBrandingError(error:unknown){const message=String((error as {message?:unknown}|null)?.message??error??'').trim();const map:Array<[string,string]>=[['store_branding_size_invalid','Optimize edilmiş logo ve kapak görselleri en fazla 5 MB olabilir.'],['store_branding_type_invalid','Logo ve kapak yalnız JPEG, PNG veya WebP olabilir.'],['store_branding_logo_dimensions_invalid','Logo HD işleme sonucunda 1:1 kare ve en az 512 × 512 px olmalıdır.'],['store_branding_cover_dimensions_invalid','Kapak HD işleme sonucunda 5:2 oranında ve en az 1200 × 480 px olmalıdır.'],['store_branding_dimensions_unreadable','Görselin piksel ölçüleri sunucuda doğrulanamadı.'],['store_branding_owner_required','Bu mağazanın görsellerini değiştirme yetkiniz yok.'],['store_branding_access_required','Bu mağazanın marka yönetimine erişim yetkiniz yok.'],['store_branding_edit_required','Bu mağazanın logo veya kapak görselini değiştirme yetkiniz yok.'],['store_branding_asset_not_verified','Görsel gerçek dosya ve Storage bütünlüğü doğrulamasından geçmedi.'],['permission_required:product.publish','Golden Oremar Resmi Mağazası görsellerini yalnız yetkili Super Admin değiştirebilir.']];for(const[key,value]of map)if(message.includes(key))return value;return message&&message.length<=300?message:'Mağaza görseli işlemi tamamlanamadı.';}
