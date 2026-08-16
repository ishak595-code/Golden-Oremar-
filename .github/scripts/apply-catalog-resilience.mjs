import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(from, to);
}

{
  const path='src/features/catalog/ProductDetailScreen.tsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,"import React,{useEffect,useMemo,useState}from'react';","import React,{useEffect,useMemo,useRef,useState}from'react';",'ProductDetail React import');
  const start=source.indexOf(' async function load(){');
  const endMarker=" useEffect(()=>{void load();},[reference]);";
  const end=source.indexOf(endMarker,start);
  if(start<0||end<0)throw new Error('ProductDetail load boundaries not found');
  const replacement=` const requestId=useRef(0);\n async function load(){\n  const current=++requestId.current;\n  try{\n   setLoading(true);setError('');setStatus('');setFavoriteOverride(null);setDetail(null);setReviews(null);\n   const product=await getProductDetail(reference);\n   if(requestId.current!==current)return;\n   setDetail(product);\n   const defaultVariant=product?.variants?.find((v:any)=>v.default&&v.available!==false)||product?.variants?.find((v:any)=>v.available!==false)||product?.variants?.[0];\n   setVariantId(defaultVariant?.id||'');setQuantity(1);\n   const firstImage=product?.images?.find((i:any)=>i.primary)||product?.images?.[0];setSelectedImagePath(firstImage?.path||'');\n   if(product?.id){\n    try{const nextReviews=await listProductReviews(product.id,20,0);if(requestId.current===current)setReviews(nextReviews);}\n    catch{if(requestId.current===current)setReviews(null);}\n   }\n  }catch(err:any){if(requestId.current===current)setError(err?.message||'Ürün bilgileri yüklenemedi.');}\n  finally{if(requestId.current===current)setLoading(false);}\n }\n useEffect(()=>{void load();return()=>{requestId.current+=1;};},[reference]);`;
  source=source.slice(0,start)+replacement+source.slice(end+endMarker.length);
  source=replaceOnce(source,'<img src={publicCatalogUrl(selectedImage.path)} alt={selectedImage.alt||detail.name} className="aspect-square h-full w-full object-cover"/>','<img src={publicCatalogUrl(selectedImage.path)} alt={selectedImage.alt||detail.name} loading="eager" decoding="async" fetchPriority="high" className="aspect-square h-full w-full object-cover"/>','ProductDetail primary image priority');
  source=replaceOnce(source,'<img src={publicCatalogUrl(img.path)} alt={img.alt||`${detail.name} küçük görsel ${index+1}`} className="aspect-square h-full w-full object-cover"/>','<img src={publicCatalogUrl(img.path)} alt={img.alt||`${detail.name} küçük görsel ${index+1}`} loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover"/>','ProductDetail thumbnails');
  fs.writeFileSync(path,source);
}

{
  const path='src/features/catalog/PublicProducerScreen.tsx';
  let source=fs.readFileSync(path,'utf8');
  const start=source.indexOf(' async function load(){');
  const endMarker=" useEffect(()=>{setStatus('');void load();},[reference,authenticated]);";
  const end=source.indexOf(endMarker,start);
  if(start<0||end<0)throw new Error('PublicProducer load boundaries not found');
  const replacement=` const requestId=useRef(0);\n async function load(){\n  const current=++requestId.current;\n  try{\n   setLoading(true);setError('');setProfile(null);\n   const producer=await getPublicProducerProfile(reference);\n   if(requestId.current!==current)return;\n   setProfile(producer);setFollowing(authenticated&&producer?.following===true);\n  }catch(err:any){if(requestId.current===current)setError(err?.message||'Üretici profili yüklenemedi.');}\n  finally{if(requestId.current===current)setLoading(false);}\n }\n useEffect(()=>{setStatus('');void load();return()=>{requestId.current+=1;};},[reference,authenticated]);`;
  source=source.slice(0,start)+replacement+source.slice(end+endMarker.length);
  source=replaceOnce(source,'<img src={publicCatalogUrl(profile.cover_path)} alt={`${profile.display_name} kapak görseli`} className="h-full w-full object-cover"/>','<img src={publicCatalogUrl(profile.cover_path)} alt={`${profile.display_name} kapak görseli`} loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-cover"/>','Producer cover priority');
  source=replaceOnce(source,'<img src={publicCatalogUrl(profile.logo_path)} alt={`${profile.display_name} logosu`} className="h-full w-full object-cover"/>','<img src={publicCatalogUrl(profile.logo_path)} alt={`${profile.display_name} logosu`} loading="eager" decoding="async" className="h-full w-full object-cover"/>','Producer logo decode');
  fs.writeFileSync(path,source);
}

{
  const path='src/features/catalog/CatalogProductCard.tsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,'loading="lazy" className="h-full w-full object-cover transition-transform duration-300 motion-safe:hover:scale-[1.03]"','loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 motion-safe:hover:scale-[1.03]"','Catalog card image decoding');
  fs.writeFileSync(path,source);
}

{
  const path='src/App.tsx';
  let source=fs.readFileSync(path,'utf8');
  const start=source.indexOf('  // Audio Helper\n');
  const end=source.indexOf('  // Helpers\n',start);
  if(start<0||end<0)throw new Error('Obsolete App audio helper boundaries not found');
  source=source.slice(0,start)+source.slice(end);
  fs.writeFileSync(path,source);
}

console.log('Catalog resilience and image loading patch applied.');
