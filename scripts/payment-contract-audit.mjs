import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}function assert(condition,message){if(!condition){console.error(`PAYMENT AUDIT FAIL: ${message}`);process.exitCode=1;}}
const control=read('src/admin/paymentControlApi.ts'),admin=read('src/admin/AdminPaymentControls.tsx'),commerce=read('src/features/payments/commerceApi.ts'),vault=read('supabase/functions/payment-method-vault/index.ts'),checkout=read('src/features/cart/CartCheckoutFlow.tsx'),webhook=read('supabase/functions/iyzico-payment-webhook/index.ts'),shared=read('supabase/functions/_shared/iyzico.ts');
const active=[control,admin,commerce,vault,checkout,webhook].join('\n');
assert(!/googlePay|applePay|carrierBilling|google_pay|apple_pay|carrier_billing|bankTransferEnabled/.test(active),'runtime payment code must remain iyzico-only');
assert(!/payment_channel/.test(active),'duplicate payment_channel contract must not return');
assert(control.includes("provider:'iyzico'")&&control.includes('checkoutFormEnabled')&&control.includes('cardEnrollmentEnabled'),'Super Admin must manage canonical iyzico flows');
assert(vault.includes('consentToSaveCard!==true')&&vault.includes('store_verified_provider_payment_method_v2'),'saved-card storage must require explicit server-side consent');
assert(checkout.includes("getCheckoutPaymentCapabilities")&&checkout.includes('initializeHostedOrderPayment')&&checkout.includes('payPendingOrder'),'checkout must use runtime-ready iyzico payment orchestration');
assert(checkout.includes("paymentStatus==='paid'")&&checkout.includes('getMyOrderPaymentState'),'checkout success must be server-authoritative');
assert(shared.includes('verifyIyzicoCheckoutRetrieveSignature')&&webhook.includes('verifyIyzicoWebhookV3Hpp')&&webhook.includes('verifyIyzicoWebhookV3Direct'),'webhooks must use canonical iyzico verification');
assert(webhook.includes('complete_order_payment_for_service_v2'),'provider webhook must use canonical v2 completion');
assert(vault.includes('../_shared/iyzico.ts')&&webhook.includes('../_shared/iyzico.ts'),'provider crypto/client must not be duplicated');
if(!process.exitCode)console.log('Payment contract audit passed.');
