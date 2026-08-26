import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHmac,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.VITE_SUPABASE_URL||'').trim().replace(/\/+$/,'');
const key=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const controlUrl=String(process.env.E2E_CI_CONTROL_URL||'').trim();
const oidc=String(process.env.E2E_CI_OIDC_TOKEN||'').trim();
const runId=String(process.env.GITHUB_RUN_ID||'').trim();
const branch=String(process.env.GITHUB_HEAD_REF||'').trim();
const eventName=String(process.env.GITHUB_EVENT_NAME||'').trim();
const approval=String(process.env.CATALOG_PUBLICATION_APPROVED||'').trim();
const slot='catalog-publish';
const EXPECTED=42;
if(approval!=='1'||eventName!=='pull_request'||branch!=='release/catalog-publish-2026-08')throw new Error('catalog_publication_context_not_allowed');
if(!url||!key||!controlUrl||!oidc||!/^[0-9]{1,24}$/.test(runId))throw new Error('catalog_publication_environment_missing');
const password=`Publish-${randomBytes(20).toString('base64url')}!7`;
const email=`goldenoremar+ci-e2e-${runId}-${slot}@gmail.com`;
const out=path.resolve('e2e-artifacts');fs.mkdirSync(out,{recursive:true});
const evidence={runId,startedAt:new Date().toISOString(),expected:EXPECTED,publicationMode:null,before:null,atomicResult:null,after:null,public:null,merchandising:null,publishedProductIds:[]};
function client(){return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
function b32(secret){const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const ch of String(secret).toUpperCase().replace(/=+$/,'').replace(/\s+/g,'')){const i=a.indexOf(ch);if(i<0)throw new Error('invalid_totp_secret');bits+=i.toString(2).padStart(5,'0');}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(bytes);}
function totp(secret){const c=Math.floor(Date.now()/30000);const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(c));const h=createHmac('sha1',b32(secret)).update(msg).digest();const o=h[h.length-1]&15;const n=((h[o]&0x7f)<<24)|((h[o+1]&255)<<16)|((h[o+2]&255)<<8)|(h[o+3]&255);return String(n%1000000).padStart(6,'0');}
async function control(action,extra={}){const r=await fetch(controlUrl,{method:'POST',headers:{Authorization:`Bearer ${oidc}`,'Content-Type':'application/json'},body:JSON.stringify({action,runId,slot,...extra})});const b=await r.json().catch(()=>({}));if(!r.ok||b?.ok!==true)throw new Error(`ci_control_${action}_failed:${r.status}:${b?.error||'unknown'}`);return b;}
const num=(v,l)=>{const n=Number(v);assert.ok(Number.isSafeInteger(n)&&n>=0,`${l}_invalid`);return n;};
const bool=(v,l)=>{assert.equal(typeof v,'boolean',`${l}_invalid`);return v;};
async function perm(c,p){const{data,error}=await c.rpc('authorization_has_permission_v1',{p_permission_key:p});assert.ifError(error);assert.equal(data,true,`permission_missing:${p}`);}
async function ready(c){const{data,error}=await c.rpc('super_admin_product_publish_readiness_v1',{p_query:null,p_state:'all',p_limit:200,p_offset:0});assert.ifError(error);assert.ok(data&&Array.isArray(data.items));return data;}
function summarize(snapshot,prefix){const s=snapshot.summary;return{total:num(s.total,`${prefix}Total`),published:num(s.published,`${prefix}Published`),ready:num(s.readyToPublish,`${prefix}Ready`),missingRealMedia:num(s.missingRealMedia,`${prefix}MissingRealMedia`),mandatoryMissing:num(s.mandatoryDataMissing,`${prefix}MandatoryMissing`),mediaBlocked:num(s.mediaBlocked,`${prefix}MediaBlocked`),ownerApprovalRequired:num(s.ownerApprovalRequired,`${prefix}OwnerApprovalRequired`)};}
function idsFrom(snapshot){const ids=snapshot.items.map(item=>String(item?.productId||'').trim());assert.equal(ids.length,EXPECTED,'catalog_item_count_mismatch');assert.ok(ids.every(Boolean),'catalog_product_id_missing');assert.equal(new Set(ids).size,EXPECTED,'catalog_product_ids_not_unique');return ids;}
let c=null,provisioned=false;
try{
  await control('provision-staff',{staffRole:'super_admin',password,displayName:'Golden Oremar Atomic Catalog Publisher'});provisioned=true;c=client();
  const s=await c.auth.signInWithPassword({email,password});assert.ifError(s.error);
  const e=await c.auth.mfa.enroll({factorType:'totp',friendlyName:'Approved atomic catalog publication'});assert.ifError(e.error);
  const ch=await c.auth.mfa.challenge({factorId:e.data.id});assert.ifError(ch.error);
  const v=await c.auth.mfa.verify({factorId:e.data.id,challengeId:ch.data.id,code:totp(e.data.totp.secret)});assert.ifError(v.error);
  const rr=await c.auth.refreshSession();assert.ifError(rr.error);
  const aal=await c.auth.mfa.getAuthenticatorAssuranceLevel();assert.ifError(aal.error);assert.equal(aal.data.currentLevel,'aal2');
  const ma=await c.rpc('mfa_record_self_event_v1',{p_event:'mfa.privileged_session_established',p_factor_id:e.data.id});assert.ifError(ma.error);
  for(const p of ['admin.access','product.moderate','product.approve','product.publish','product.health_manage'])await perm(c,p);
  const before=await ready(c);evidence.before=summarize(before,'before');
  assert.equal(evidence.before.total,EXPECTED);assert.equal(evidence.before.mandatoryMissing,0);assert.equal(evidence.before.mediaBlocked,0);assert.equal(before.items.length,EXPECTED);
  const ids=idsFrom(before);evidence.publishedProductIds=ids;
  const unpublishedState=evidence.before.published===0&&evidence.before.ready===EXPECTED&&evidence.before.ownerApprovalRequired===EXPECTED;
  const alreadyPublishedState=evidence.before.published===EXPECTED&&evidence.before.ready===0&&evidence.before.ownerApprovalRequired===0;
  assert.ok(unpublishedState||alreadyPublishedState,'catalog_publication_state_must_be_all_review_or_all_published');
  if(unpublishedState){
    for(const item of before.items){assert.equal(item.status,'review');assert.equal(item.active,false);assert.equal(item.readyToPublish,true);assert.equal(item.mediaReady,true);assert.equal(item.mediaBlocked,false);if(item.missingRealMedia===true)assert.equal(item.brandFallbackAllowed,true);assert.deepEqual(item.reasons||[],[]);}
    const{data,error}=await c.rpc('super_admin_bulk_publish_products_atomic_v1',{p_product_ids:ids,p_reason:'Kullanıcının açık onayıyla Golden Oremar resmi katalog final yayını.'});
    assert.ifError(error);assert.ok(data&&typeof data==='object'&&!Array.isArray(data),'atomic_publication_result_invalid');
    evidence.atomicResult=data;evidence.publicationMode='atomic-write';
    assert.equal(num(data.requestedCount,'atomicRequested'),EXPECTED);assert.equal(num(data.successCount,'atomicSuccess'),EXPECTED);assert.equal(num(data.failureCount,'atomicFailure'),0);assert.equal(bool(data.approved,'atomicApproved'),true);assert.equal(bool(data.atomic,'atomicFlag'),true);assert.ok(Array.isArray(data.results));assert.equal(data.results.length,EXPECTED);assert.ok(data.results.every(item=>item?.ok===true&&item?.approved===true));
  }else{
    evidence.publicationMode='verify-existing';
    evidence.atomicResult={requestedCount:EXPECTED,successCount:EXPECTED,failureCount:0,approved:true,atomic:true,unchanged:true};
    assert.ok(before.items.every(item=>item.published===true&&item.active===true&&item.status==='published'));
  }
  const after=await ready(c);evidence.after=summarize(after,'after');
  assert.equal(evidence.after.total,EXPECTED);assert.equal(evidence.after.published,EXPECTED);assert.equal(evidence.after.ready,0);assert.equal(evidence.after.mandatoryMissing,0);assert.equal(evidence.after.mediaBlocked,0);assert.equal(evidence.after.ownerApprovalRequired,0);assert.equal(after.items.length,EXPECTED);assert.ok(after.items.every(item=>item.published===true&&item.active===true&&item.status==='published'));
  assert.deepEqual(new Set(idsFrom(after)),new Set(ids));
  await c.auth.signOut();c=null;
  const pub=client();
  const home=await pub.rpc('get_public_home_catalog_v3');assert.ifError(home.error);assert.ok(home.data&&Array.isArray(home.data.items));
  const search=await pub.rpc('search_catalog_v3',{p_query:null,p_category_slug:null,p_producer_id:null,p_province:null,p_district:null,p_village:null,p_min_price_minor:null,p_max_price_minor:null,p_in_stock:false,p_featured:null,p_sort:'relevance',p_limit:100,p_offset:0});assert.ifError(search.error);assert.ok(search.data&&Array.isArray(search.data.items));
  const facets=await pub.rpc('catalog_search_facets_v1',{p_query:null,p_category_slug:null,p_producer_id:null,p_province:null,p_district:null,p_village:null,p_min_price_minor:null,p_max_price_minor:null,p_in_stock:false,p_featured:null});assert.ifError(facets.error);
  const homeIds=new Set(home.data.items.map(x=>String(x?.id||'')));const searchIds=new Set(search.data.items.map(x=>String(x?.id||'')));for(const id of ids){assert.ok(homeIds.has(id),`home_missing:${id}`);assert.ok(searchIds.has(id),`search_missing:${id}`);}
  assert.equal(num(search.data.total,'searchTotal'),EXPECTED);assert.equal(num(facets.data?.total,'facetTotal'),EXPECTED);
  const items=home.data.items.filter(x=>ids.includes(String(x?.id||'')));assert.equal(items.length,EXPECTED);assert.ok(items.every(x=>x?.producer?.storeKind==='official'));assert.ok(items.every(x=>typeof x?.imagePath==='string'&&x.imagePath.trim().length>0));
  const sections={};for(const x of items){const hs=String(x?.homeSection||x?.specifications?.homeSection||'regular');sections[hs]=(sections[hs]||0)+1;}
  evidence.public={homeCount:home.data.items.length,searchTotal:num(search.data.total,'searchTotalEvidence'),facetTotal:num(facets.data.total,'facetTotalEvidence')};
  evidence.merchandising={featured:items.filter(x=>x?.featured===true).length,seasonal:items.filter(x=>x?.stockMode==='seasonal').length,preOrder:items.filter(x=>x?.stockMode==='preorder').length,realOffers:items.filter(x=>Number.isSafeInteger(x?.variant?.compareAtPriceMinor)&&Number.isSafeInteger(x?.variant?.priceMinor)&&x.variant.compareAtPriceMinor>x.variant.priceMinor).length,reviewBacked:items.filter(x=>Number(x?.reviewCount||0)>0).length,categoryCount:new Set(items.map(x=>String(x?.category?.slug||'')).filter(Boolean)).size,sections};
  evidence.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'catalog-publication.json'),JSON.stringify(evidence,null,2));
  console.log(`CATALOG_PUBLICATION_OK ${EXPECTED}/${EXPECTED} ${evidence.publicationMode}`);console.log('MERCHANDISING',JSON.stringify(evidence.merchandising));
}finally{
  if(c)await c.auth.signOut().catch(()=>{});
  if(provisioned)await control('delete').catch(err=>{console.error('publisher_cleanup_failed',err);process.exitCode=1;});
}
