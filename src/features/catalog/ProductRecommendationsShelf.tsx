import React,{useEffect,useState}from'react';
import CatalogProductCard from'./CatalogProductCard';
import{publicCatalogUrl}from'./api';
import{getProductRecommendations,type ProductRecommendation}from'./productRecommendationsApi';

/**
 * "Sofranızı bu lezzetlerle tamamlayın": the product-based recommendations shelf
 * after the reviews, restored from before the editorial page (PR #129).
 * Same source as then (public_product_recommendations_v1: same category,
 * same collection, similar attributes and price, real purchase signals only
 * when they exist; the shipped catalogue copy answers when the backend is
 * down). The cards are the category page's own square-photo cards.
 * Nothing is shown while loading or when there is nothing to suggest.
 */
type Props={reference:string;currentId?:string|null;onOpenProduct:(slug:string)=>void;onAddToCart:(item:ProductRecommendation,quantity:number)=>Promise<void>|void};

/** At most six different products, never the one on the page: one card per product id. */
export function uniqueRecommendations(items:ProductRecommendation[],current:string[]){const skip=new Set(current.filter(Boolean)),seen=new Set<string>(),out:ProductRecommendation[]=[];for(const item of items){if(!item?.id||seen.has(item.id)||skip.has(item.id)||skip.has(item.slug)||(item.legacyId&&skip.has(String(item.legacyId))))continue;seen.add(item.id);out.push(item);if(out.length===6)break;}return out;}

export default function ProductRecommendationsShelf({reference,currentId,onOpenProduct,onAddToCart}:Props){
 const[items,setItems]=useState<ProductRecommendation[]>([]);
 useEffect(()=>{let active=true;setItems([]);if(!reference)return;getProductRecommendations(reference,12).then(response=>{if(active)setItems(uniqueRecommendations(response.items,[reference,currentId||'']));}).catch(()=>{if(active)setItems([]);});return()=>{active=false;};},[reference,currentId]);
 if(!items.length)return null;
 return<section className="go-detail-recos" data-go-feature="live-product-recommendations" aria-labelledby="product-recos-heading">
  <h2 id="product-recos-heading" className="go-detail-recos__title">Sofranızı bu lezzetlerle tamamlayın</h2>
  <div className="go-detail-recos__grid">{items.map(item=>{const priceMinor=item.variant.priceMinor,compare=item.variant.compareAtPriceMinor;const product={id:item.id,legacyId:item.legacyId,slug:item.slug,name:item.name,description:item.shortDescription||'',shortDescription:item.shortDescription||'',category:item.category.name,categorySlug:item.category.slug,price:priceMinor/100,originalPrice:typeof compare==='number'?compare/100:null,currency:item.currency,image:publicCatalogUrl(item.imagePath),origin:item.origin,unit:item.unitLabel||item.variant.name||null,rating:item.reviewCount>0?item.averageRating:null,reviewCount:item.reviewCount,stock:item.availableQuantity,stockMode:item.stockMode,is_featured:item.featured===true,preOrder:item.stockMode==='preorder',variantId:item.variant.id,variantName:item.variant.name,vendor_id:item.producer.id,producerName:item.producer.name};
   return<CatalogProductCard key={item.id} product={product} onClick={()=>onOpenProduct(item.slug)} onAddToCart={(_,quantity)=>onAddToCart(item,quantity)} compact/>;})}</div>
 </section>;
}
