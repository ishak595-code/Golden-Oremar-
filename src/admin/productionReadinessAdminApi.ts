import { supabase } from '../lib/supabase';

export type ProductionReadiness={
 generatedAt:string;softwareIntegrityReady:boolean;productionInputsReady:boolean;automatedReady:boolean;
 database:{
  integrity:{superAdminHelperPresent:boolean;adminAuditLedgerPresent:boolean;readinessWrapperPresent:boolean;missingPrivateReferenceCount:number;missingPublicReferenceCount:number;ready:boolean};
  businessIdentity:{
   legalNameConfigured:boolean;supportEmailConfigured:boolean;supportPhoneConfigured:boolean;
   registeredLegalNameConfigured:boolean;registeredAddressConfigured:boolean;registeredCountryCodeConfigured:boolean;
   legalDocumentsFinalized:boolean;missing:string[];ready:boolean;
  };
  assets:{catalogObjectCount:number;contentObjectCount:number;eventObjectCount:number;publishedProductCount:number;publishedProductsWithRealPrimaryImage:number;publishedProductsMissingRealPrimaryImage:number;catalogReady:boolean};
  legalContent:{requiredSlugs:string[];publishedSlugs:string[];missingSlugs:string[];ready:boolean};
  shipping:{activePublishedVariantCount:number;missingWeightVariantCount:number;ready:boolean};
  producerPayments:{activeVerifiedProducerCount:number;readyProducerPaymentAccountCount:number;missingProducerPaymentAccountCount:number;ready:boolean};
  paymentControl:{provider:'iyzico';checkoutFormEnabled:boolean;savedCardPaymentsEnabled:boolean;cardEnrollmentEnabled:boolean;atLeastOneCheckoutFlowEnabled:boolean};
 };
 runtime:{iyzicoConfigured:boolean;transactionalEmailConfigured:boolean;fcmConfigured:boolean;apnsConfigured:boolean;paymentReady:boolean};
 manualReleaseChecks:Array<{id:'android_signing'|'ios_signing'|'social_oauth'|'public_share_origin';label:string;status:'manual_required'}>;
};
function rec(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function integer(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}
function text(value:unknown,label:string,max=240){if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const next=value.trim();if(!next||next.length>max||/[\u0000-\u001F\u007F]/.test(next))throw new Error(`${label} doğrulanamadı.`);return next;}
function iso(value:unknown,label:string){const next=text(value,label,80);if(Number.isNaN(Date.parse(next)))throw new Error(`${label} doğrulanamadı.`);return next;}
function strings(value:unknown,label:string){if(!Array.isArray(value))throw new Error(`${label} doğrulanamadı.`);return value.map((item,index)=>text(item,`${label} ${index+1}`,120));}
function normalizeManual(value:unknown):ProductionReadiness['manualReleaseChecks']{if(!Array.isArray(value))throw new Error('Manuel release kontrolleri doğrulanamadı.');const ids=new Set(['android_signing','ios_signing','social_oauth','public_share_origin']);return value.map((item,index)=>{if(!rec(item))throw new Error(`Manuel release kontrolü ${index+1} doğrulanamadı.`);const id=text(item.id,'Manuel kontrol kimliği',40) as ProductionReadiness['manualReleaseChecks'][number]['id'];if(!ids.has(id)||item.status!=='manual_required')throw new Error('Manuel release kontrolü sözleşmeye uymuyor.');return{id,label:text(item.label,'Manuel kontrol açıklaması',240),status:'manual_required' as const};});}
export async function getProductionReadiness():Promise<ProductionReadiness>{
 const{data,error}=await supabase.functions.invoke('production-readiness-health',{body:{}});if(error)throw error;
 if(!rec(data)||data.ok!==true||!rec(data.database)||!rec(data.runtime)||!rec(data.database.integrity)||!rec(data.database.businessIdentity)||!rec(data.database.assets)||!rec(data.database.legalContent)||!rec(data.database.shipping)||!rec(data.database.producerPayments)||!rec(data.database.paymentControl))throw new Error('Üretim hazırlığı yanıtı doğrulanamadı.');
 const integrity=data.database.integrity,business=data.database.businessIdentity,assets=data.database.assets,legal=data.database.legalContent,shipping=data.database.shipping,producers=data.database.producerPayments,payment=data.database.paymentControl,runtime=data.runtime;
 if(payment.provider!=='iyzico')throw new Error('Üretim ödeme sağlayıcısı sözleşmeye uymuyor.');
 return{
  generatedAt:iso(data.generatedAt,'Hazırlık zamanı'),softwareIntegrityReady:bool(data.softwareIntegrityReady,'Yazılım bütünlüğü'),productionInputsReady:bool(data.productionInputsReady,'Üretim girdileri'),automatedReady:bool(data.automatedReady,'Otomatik hazırlık'),
  database:{
   integrity:{superAdminHelperPresent:bool(integrity.superAdminHelperPresent,'Super Admin helper'),adminAuditLedgerPresent:bool(integrity.adminAuditLedgerPresent,'Admin audit ledger'),readinessWrapperPresent:bool(integrity.readinessWrapperPresent,'Readiness wrapper'),missingPrivateReferenceCount:integer(integrity.missingPrivateReferenceCount,'Eksik private referans'),missingPublicReferenceCount:integer(integrity.missingPublicReferenceCount,'Eksik public referans'),ready:bool(integrity.ready,'Runtime bütünlüğü')},
   businessIdentity:{legalNameConfigured:bool(business.legalNameConfigured,'Marka yasal adı'),supportEmailConfigured:bool(business.supportEmailConfigured,'Destek e-postası'),supportPhoneConfigured:bool(business.supportPhoneConfigured,'Destek telefonu'),registeredLegalNameConfigured:bool(business.registeredLegalNameConfigured,'Kayıtlı ticari unvan'),registeredAddressConfigured:bool(business.registeredAddressConfigured,'Kayıtlı ticari adres'),registeredCountryCodeConfigured:bool(business.registeredCountryCodeConfigured,'Kayıtlı ülke kodu'),legalDocumentsFinalized:bool(business.legalDocumentsFinalized,'Yasal belge finalizasyonu'),missing:strings(business.missing,'Eksik işletme kimliği alanı'),ready:bool(business.ready,'İşletme kimliği')},
   assets:{catalogObjectCount:integer(assets.catalogObjectCount,'Katalog obje sayısı'),contentObjectCount:integer(assets.contentObjectCount,'İçerik obje sayısı'),eventObjectCount:integer(assets.eventObjectCount,'Etkinlik obje sayısı'),publishedProductCount:integer(assets.publishedProductCount,'Yayındaki ürün sayısı'),publishedProductsWithRealPrimaryImage:integer(assets.publishedProductsWithRealPrimaryImage,'Görselli ürün sayısı'),publishedProductsMissingRealPrimaryImage:integer(assets.publishedProductsMissingRealPrimaryImage,'Eksik ürün görseli sayısı'),catalogReady:bool(assets.catalogReady,'Katalog görselleri')},
   legalContent:{requiredSlugs:strings(legal.requiredSlugs,'Zorunlu yasal belge'),publishedSlugs:strings(legal.publishedSlugs,'Yayınlanmış yasal belge'),missingSlugs:strings(legal.missingSlugs,'Eksik yasal belge'),ready:bool(legal.ready,'Yasal içerikler')},
   shipping:{activePublishedVariantCount:integer(shipping.activePublishedVariantCount,'Aktif varyant sayısı'),missingWeightVariantCount:integer(shipping.missingWeightVariantCount,'Eksik ağırlık sayısı'),ready:bool(shipping.ready,'Kargo ağırlıkları')},
   producerPayments:{activeVerifiedProducerCount:integer(producers.activeVerifiedProducerCount,'Doğrulanmış üretici sayısı'),readyProducerPaymentAccountCount:integer(producers.readyProducerPaymentAccountCount,'Hazır üretici ödeme hesabı'),missingProducerPaymentAccountCount:integer(producers.missingProducerPaymentAccountCount,'Eksik üretici ödeme hesabı'),ready:bool(producers.ready,'Üretici ödeme hesapları')},
   paymentControl:{provider:'iyzico',checkoutFormEnabled:bool(payment.checkoutFormEnabled,'Tek seferlik ödeme ayarı'),savedCardPaymentsEnabled:bool(payment.savedCardPaymentsEnabled,'Kayıtlı kart ayarı'),cardEnrollmentEnabled:bool(payment.cardEnrollmentEnabled,'Kart kaydetme ayarı'),atLeastOneCheckoutFlowEnabled:bool(payment.atLeastOneCheckoutFlowEnabled,'Checkout akışı')}
  },
  runtime:{iyzicoConfigured:bool(runtime.iyzicoConfigured,'iyzico sunucu yapılandırması'),transactionalEmailConfigured:bool(runtime.transactionalEmailConfigured,'Makbuz e-posta yapılandırması'),fcmConfigured:bool(runtime.fcmConfigured,'Android FCM yapılandırması'),apnsConfigured:bool(runtime.apnsConfigured,'iOS APNs yapılandırması'),paymentReady:bool(runtime.paymentReady,'Canlı ödeme hazırlığı')},
  manualReleaseChecks:normalizeManual(data.manualReleaseChecks)
 };
}
