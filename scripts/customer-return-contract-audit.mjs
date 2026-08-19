import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Missing required customer return contract file: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const legacyHook=path.join(root,'src/features/account/useDialogA11y.ts');
if(fs.existsSync(legacyHook))failures.push('Retired account useDialogA11y wrapper must not return.');

const api=read('src/features/account/returnsApi.ts');
if(api){
 forbid(api,/unwrap<any>/,'Customer return RPCs must not return raw any payloads.');
 requirePattern(api,/return normalizeReturnOptions\(unwrap<unknown>\(data,error\),id\)/,'Return options must pass through the strict normalizer.');
 requirePattern(api,/return normalizeReturnDetail\(unwrap<unknown>\(data,error\),id\)/,'Return detail must pass through the strict normalizer.');
 requirePattern(api,/return normalizeReturnRequestResult\(unwrap<unknown>\(data,error\),orderId,evidenceTotal\)/,'Return creation must verify the server result.');
 requirePattern(api,/quantity>999/,'Customer return quantity must preserve the live backend 1-999 limit.');
 requirePattern(api,/pending['"],['"]processing['"],['"]succeeded['"],['"]failed['"],['"]cancelled/,'Refund lifecycle must match the live database constraint.');
 forbid(api,/refundStatuses[^\n]*(?:completed|refunded)/,'Return API must not reintroduce nonexistent refund statuses.');
 requirePattern(api,/parsed\.protocol!==['"]https:['"]|parsed\.protocol\s*!==\s*['"]https:['"]/, 'Return evidence signed URLs must remain HTTPS-only.');
 requirePattern(api,/evidencePaths\.length>5/,'Per-item return evidence must remain capped at five files.');
 requirePattern(api,/evidenceTotal>15/,'Return evidence must remain capped at fifteen files per request.');
}

const requestUi=read('src/features/account/ReturnRequestDialog.tsx');
if(requestUi){
 forbid(requestUi,/useDialogA11y|useState<any>|payload:any\[\]/,'Return request UI must not use retired dialog hooks or raw any state/payloads.');
 forbid(requestUi,/Sipariş numarası doğrulanamadı|Ürün bilgisi doğrulanamadı|['"]Standart['"]|return-item-\$\{/, 'Return request UI must not invent order, product, variant, or record identity data.');
 requirePattern(requestUi,/type OrderReturnOptions,type ReturnRequestResult/,'Return request UI must consume strict return API types.');
 requirePattern(requestUi,/useAccessibleDialog<HTMLDivElement>/,'Return request dialog must use the canonical accessibility hook.');
 requirePattern(requestUi,/key=\{id\}/,'Return request product rows must use the validated order-item id.');
 requirePattern(requestUi,/<Money minor=\{item\.lineTotalMinor\} currency=\{item\.currency\}\/>/,'Return request money display must use validated server values.');
}

const detailUi=read('src/features/account/ReturnDetailDialog.tsx');
if(detailUi){
 forbid(detailUi,/useDialogA11y|useState<any>|return-item-\$\{|refund-\$\{/,'Return detail UI must not use retired hooks, raw any state, or synthetic identities.');
 forbid(detailUi,/İade durumu doğrulanamadı|İade nedeni doğrulanamadı|Ürün bilgisi doğrulanamadı|Adet doğrulanamadı|['"]Standart['"]/, 'Return detail UI must not invent fallback content after strict normalization.');
 forbid(detailUi,/completed:['"]Tamamlandı['"]|refunded:['"]Geri ödendi['"]/, 'Return detail UI must not expose refund statuses outside the live database lifecycle.');
 requirePattern(detailUi,/type ReturnDetail/,'Return detail UI must consume the strict ReturnDetail contract.');
 requirePattern(detailUi,/useAccessibleDialog<HTMLDivElement>/,'Return detail dialog must use the canonical accessibility hook.');
 requirePattern(detailUi,/key=\{item\.id\}/,'Return detail product rows must use validated return-item ids.');
 requirePattern(detailUi,/key=\{refund\.id\}/,'Return detail refund rows must use validated refund ids.');
}

if(failures.length){console.error('Golden Oremar customer return contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar customer return contract audit passed: return options, creation, evidence, detail, refund lifecycle and dialogs remain strict and fail-closed.');
