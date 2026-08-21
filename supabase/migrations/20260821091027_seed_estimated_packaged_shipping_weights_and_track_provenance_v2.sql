alter table public.product_variants add column if not exists shipping_weight_source text not null default 'unknown';
alter table public.product_variants add column if not exists shipping_weight_note text;
alter table public.product_variants add column if not exists shipping_weight_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.product_variants'::regclass
      and conname='product_variants_shipping_weight_source_check'
  ) then
    alter table public.product_variants
      add constraint product_variants_shipping_weight_source_check
      check (shipping_weight_source in ('unknown','estimated','measured','supplier'));
  end if;
end $$;

comment on column public.product_variants.weight_grams is 'Packaged gross shipping weight in grams, not product net weight.';
comment on column public.product_variants.shipping_weight_source is 'Provenance of packaged gross shipping weight: unknown, estimated, measured, or supplier.';
comment on column public.product_variants.shipping_weight_note is 'Human-readable source or estimation note for the packaged shipping weight.';
comment on column public.product_variants.shipping_weight_verified_at is 'Timestamp of physical/supplier verification; null for estimates.';

create or replace function private.mark_shipping_weight_provenance_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op='INSERT' then
    if new.weight_grams is not null and new.weight_grams>0 and coalesce(new.shipping_weight_source,'unknown')='unknown' then
      new.shipping_weight_source:='measured';
      new.shipping_weight_verified_at:=coalesce(new.shipping_weight_verified_at,timezone('utc',now()));
      new.shipping_weight_note:=coalesce(nullif(btrim(new.shipping_weight_note),''),'Ürün yönetiminden girilen paketli gönderi ağırlığı.');
    end if;
  elsif new.weight_grams is distinct from old.weight_grams
    and new.shipping_weight_source is not distinct from old.shipping_weight_source then
    if new.weight_grams is null or new.weight_grams<=0 then
      new.shipping_weight_source:='unknown';
      new.shipping_weight_verified_at:=null;
      new.shipping_weight_note:=null;
    else
      new.shipping_weight_source:='measured';
      new.shipping_weight_verified_at:=timezone('utc',now());
      new.shipping_weight_note:='Ürün yönetiminden güncellenen paketli gönderi ağırlığı.';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.mark_shipping_weight_provenance_v1() from public,anon,authenticated;
grant execute on function private.mark_shipping_weight_provenance_v1() to service_role;

drop trigger if exists product_variants_shipping_weight_provenance on public.product_variants;
create trigger product_variants_shipping_weight_provenance
before insert or update of weight_grams,shipping_weight_source,shipping_weight_note,shipping_weight_verified_at
on public.product_variants
for each row execute function private.mark_shipping_weight_provenance_v1();

with estimates(slug,variant_name,weight_grams,note) as (
  values
  ('abidin-in-yayla-kuzusu-302','1 Bütün Kuzu (Ort. 16-20 kg)',20000,'16-20 kg ürün aralığı ve koruyucu/soğuk gönderi ambalajı için başlangıç brüt tahmini.'),
  ('amine-nin-cifte-sari-koy-yumurtasi-305','30 Adet (Özel Viop Koli)',2300,'30 büyük yumurta, viyol/koli ve kırılma koruması için başlangıç brüt tahmini.'),
  ('ata-tohumu-dag-kekigi-suyu-distile-807','500 ml Cam Şişe',850,'500 ml sıvı, cam şişe ve darbe koruması için başlangıç brüt tahmini.'),
  ('avasin-cam-damacana-suyu-401','19 Litre Cam',24500,'19 L su ile büyük cam damacana/koruma ağırlığı için başlangıç brüt tahmini.'),
  ('avasin-deresi-canli-alabaligi-ozel-hasat-301','Min. 1.5 - 2 kg Taze Bütün',2400,'1.5-2 kg taze ürün ile sızdırmaz/soğuk gönderi ambalajı için başlangıç brüt tahmini.'),
  ('avasin-mese-bali-103','1 kg Cam Kavanoz',1500,'1 kg bal, cam kavanoz ve koruyucu dış paket için başlangıç brüt tahmini.'),
  ('bercelan-yaylasi-bahar-cicek-bali-102','1 kg Cam Kavanoz',1500,'1 kg bal, cam kavanoz ve koruyucu dış paket için başlangıç brüt tahmini.'),
  ('buyuk-iskender-corek-otu-tohumu-705','500 gr Kese',600,'500 g kuru ürün ve kese/dış paket için başlangıç brüt tahmini.'),
  ('dag-cilegi-yabani-803','1 kg Kutu',1200,'1 kg taze meyve, kutu ve koruyucu dolgu için başlangıç brüt tahmini.'),
  ('daglica-karakovan-petek-bali-101','1 kg Ahşap Kutu',1400,'1 kg petek balı ve ahşap kutu/dış koruma için başlangıç brüt tahmini.'),
  ('eksi-karadut-suyu-804','1 Litre Cam Şişe',1550,'1 L sıvı, yaklaşık 450 g cam şişe ve dış koruma için başlangıç brüt tahmini.'),
  ('el-isciligi-mese-palamudu-ekmegi-505','1 Adet Dev Somun (1.5 kg)',1750,'1.5 kg somun ve gıda kutusu/koruyucu paket için başlangıç brüt tahmini.'),
  ('el-islemesi-tahta-kasik-ve-yayik-tokmagi-704','1 Adet Kaşık + Tokmak Seti',800,'Ahşap kaşık/tokmak seti ve koruyucu kutu için başlangıç brüt tahmini.'),
  ('fahrettin-in-sutten-kesilmis-oglagi-303','1 Adet Bütün Oğlak (10-14 kg)',14000,'10-14 kg ürün aralığı ve koruyucu/soğuk gönderi ambalajı için başlangıç brüt tahmini.'),
  ('gunes-sirri-guzu-yagi-ic-yag-701','1 kg Bez Kavanoz',1250,'1 kg ürün ve kap/koruyucu dış paket için başlangıç brüt tahmini.'),
  ('gunluk-taze-civik-sut-sagimdan-kapiya-204','3 Litre (Cam Şişe)',4500,'3 L süt, büyük/çoklu cam şişe ve koruyucu soğuk paket için başlangıç brüt tahmini.'),
  ('hakkari-dag-elmasi-801','1 kg File',1150,'1 kg meyve ve file/koruyucu dış paket için başlangıç brüt tahmini.'),
  ('hardaliye-geleneksel-805','1 Litre Cam Şişe',1550,'1 L içecek, cam şişe ve dış koruma için başlangıç brüt tahmini.'),
  ('hatun-ana-nin-eksi-maya-gunesi-tarhana-501','1 kg Keten Torba',1100,'1 kg kuru ürün ve keten torba/dış paket için başlangıç brüt tahmini.'),
  ('havahan-in-otlu-dag-peyniri-203','1 kg Kalıp',1300,'1 kg peynir ile sızdırmaz/soğuk koruyucu paket için başlangıç brüt tahmini.'),
  ('husnu-dayi-nin-kagit-kabuklu-cevizi-504','1 kg File',1150,'1 kg kabuklu ceviz ve file/dış paket için başlangıç brüt tahmini.'),
  ('isli-kaya-uzumleri-tane-kuru-506','1 kg Özel Bez Kese',1100,'1 kg kuru üzüm ve bez kese/dış paket için başlangıç brüt tahmini.'),
  ('kadin-imecesi-odun-atesi-pekmezi-503','1 kg Cam Kavanoz',1500,'1 kg pekmez, cam kavanoz ve koruyucu dış paket için başlangıç brüt tahmini.'),
  ('kan-kirmizi-yabani-kizilcik-surubu-seti-602','1 Litre Konsantre (İskenderun Şişe)',1550,'1 L konsantre, cam şişe ve dış koruma için başlangıç brüt tahmini.'),
  ('kekik-aromali-kesik-yogurt-kurud-703','1 kg Bez Çuval (Parça Peynir)',1250,'1 kg kurud/parça peynir ve koruyucu paket için başlangıç brüt tahmini.'),
  ('kekik-aromali-visne-kompostosu-809','1 Litre Cam Şişe',1700,'1 L komposto, cam şişe ve koruyucu dış paket için başlangıç brüt tahmini.'),
  ('kirik-tas-kaya-tuzu-blogu-kristal-603','Büyük Parçalar (5 kg Çuval)',5250,'5 kg kristal tuz ve dayanıklı çuval/dış paket için başlangıç brüt tahmini.'),
  ('kislik-kurutulmus-cennet-hurmasi-808','500 gr Kutu',650,'500 g kuru meyve ve kutu/dış paket için başlangıç brüt tahmini.'),
  ('kitir-taze-cagla-badem-806','1 kg Sepet',1300,'1 kg taze çağla, sepet ve dış koruma için başlangıç brüt tahmini.'),
  ('koylu-isi-aci-kirmizi-biber-706','500 g cam şişe',850,'500 g ürün, cam şişe ve dış koruma için başlangıç brüt tahmini.'),
  ('koyun-efsanevi-beyaz-isitma-pres-tasi-402','1 Adet Oval Tıraşlı Taş (2-4 kg)',3500,'2-4 kg taş aralığının orta değeri ve dayanıklı kutu için başlangıç brüt tahmini.'),
  ('kusburnu-marmelati-707','1 kg Büyük Cam',1500,'1 kg marmelat, büyük cam kap ve dış koruma için başlangıç brüt tahmini.'),
  ('merez-hatun-un-magara-tulum-peyniri-201','1 kg Kese',1250,'1 kg peynir, kese ve koruyucu/soğuk dış paket için başlangıç brüt tahmini.'),
  ('naciye-nin-yayik-tereyagi-202','1 kg Rulo',1200,'1 kg tereyağı ve koruyucu/soğuk paket için başlangıç brüt tahmini.'),
  ('sabir-kurutmasi-cicek-bamyasi-702','1 Dizin (50 - 60 cm Parça)',200,'50-60 g civarı kuru bamya dizini ve koruyucu gönderi paketi için başlangıç brüt tahmini.'),
  ('salih-in-meralik-ozgur-horozu-304','1 Adet (2.5 - 3 kg)',3500,'2.5-3 kg ürün ve koruyucu/soğuk gönderi ambalajı için başlangıç brüt tahmini.'),
  ('sami-usta-nin-kurutulmus-dag-dutlari-502','1 kg Hava Almaz Paket',1100,'1 kg kuru dut ve hava almaz/dış paket için başlangıç brüt tahmini.'),
  ('sessiz-orman-kuzu-gobegi-mantari-601','500g Vakum Servis',750,'500 g mantar, vakum paket ve koruyucu kutu için başlangıç brüt tahmini.'),
  ('sobalik-mese-yarigi-403','30 kg Tel Kafes Bağlamı',32000,'30 kg odun ve tel kafes/bağlama malzemesi için başlangıç brüt tahmini.'),
  ('taze-yayik-ayrani-canli-kultur-205','2 Litre (Cam Sişe)',3100,'2 L ayran, cam şişe ve dış/soğuk koruma için başlangıç brüt tahmini.'),
  ('yuksekova-yayla-domatesi-802','1 kg Seçme',1200,'1 kg domates ve ezilmeyi azaltan kutu/dolgu için başlangıç brüt tahmini.'),
  ('zahter-harmani-dag-kekigi-507','250 gr (Büyük Boy Kutu)',400,'250 g kuru kekik ve büyük kutu/dış paket için başlangıç brüt tahmini.')
)
update public.product_variants pv
set weight_grams=e.weight_grams,
    shipping_weight_source='estimated',
    shipping_weight_note=e.note,
    shipping_weight_verified_at=null,
    updated_at=timezone('utc',now())
from public.products p, estimates e
where pv.product_id=p.id
  and p.slug=e.slug
  and pv.name=e.variant_name
  and p.status='published'
  and p.is_active=true
  and p.deleted_at is null
  and pv.is_active=true;

create or replace function private.super_admin_update_variant_shipping_weight_v1(p_variant_id uuid,p_weight_grams integer,p_expected_updated_at timestamptz,p_verification_note text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); current_row public.product_variants%rowtype; note_value text:=btrim(coalesce(p_verification_note,'')); updated public.product_variants%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_variant_id is null then raise exception 'variant_required' using errcode='22023'; end if;
  if p_weight_grams is null or p_weight_grams<1 or p_weight_grams>100000000 then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
  if char_length(note_value) not between 10 and 500 then raise exception 'shipping_weight_verification_note_required' using errcode='22023'; end if;
  select pv.* into current_row from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=p_variant_id and p.deleted_at is null for update of pv;
  if current_row.id is null then raise exception 'variant_not_found' using errcode='P0002'; end if;
  if p_expected_updated_at is null or current_row.updated_at is distinct from p_expected_updated_at then raise exception 'shipping_weight_conflict' using errcode='40001'; end if;
  update public.product_variants
  set weight_grams=p_weight_grams,
      shipping_weight_source='measured',
      shipping_weight_note=note_value,
      shipping_weight_verified_at=timezone('utc',now()),
      updated_at=timezone('utc',now())
  where id=p_variant_id returning * into updated;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'inventory.shipping_weight_verified','product_variant',updated.id,jsonb_build_object('previousWeightGrams',current_row.weight_grams,'nextWeightGrams',updated.weight_grams,'previousSource',current_row.shipping_weight_source,'nextSource',updated.shipping_weight_source,'verificationNote',note_value));
  return jsonb_build_object('ok',true,'variantId',updated.id,'weightGrams',updated.weight_grams,'weightSource',updated.shipping_weight_source,'verifiedAt',updated.shipping_weight_verified_at,'updatedAt',updated.updated_at);
end;
$function$;

create or replace function private.super_admin_list_shipping_weight_readiness_v1()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'variantId',pv.id,'productId',p.id,'productName',p.name,'variantName',pv.name,'sku',pv.sku,
    'producerId',pr.id,'producerName',pr.display_name,'weightGrams',pv.weight_grams,
    'weightSource',pv.shipping_weight_source,'weightNote',pv.shipping_weight_note,'verifiedAt',pv.shipping_weight_verified_at,
    'missingWeight',pv.weight_grams is null or pv.weight_grams<=0,
    'estimatedWeight',pv.weight_grams>0 and pv.shipping_weight_source='estimated',
    'verifiedWeight',pv.weight_grams>0 and pv.shipping_weight_source in ('measured','supplier'),
    'updatedAt',pv.updated_at
  ) order by (pv.weight_grams is null or pv.weight_grams<=0) desc,(pv.shipping_weight_source='estimated') desc,p.name,pv.name,pv.id),'[]'::jsonb)
  into result
  from public.product_variants pv
  join public.products p on p.id=pv.product_id
  join public.producers pr on pr.id=p.producer_id
  where pv.is_active=true and p.status='published' and p.is_active=true and p.deleted_at is null;
  return jsonb_build_object('ok',true,'items',result);
end;
$function$;

create or replace function private.super_admin_get_production_readiness_snapshot_v1()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  settings public.brand_settings%rowtype;
  catalog_objects integer:=0; content_objects integer:=0; event_objects integer:=0;
  published_products integer:=0; products_with_real_primary integer:=0;
  active_variants integer:=0; missing_weights integer:=0; estimated_weights integer:=0; verified_weights integer:=0;
  active_producers integer:=0; ready_producer_accounts integer:=0;
  published_legal_slugs text[]:='{}'::text[]; required_legal_slugs constant text[]:=array['about','returns','privacy','terms']; missing_legal_slugs text[];
  payment_cfg jsonb; legal_readiness jsonb; runtime_integrity jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  legal_readiness:=private.commercial_checkout_legal_readiness_v1();
  runtime_integrity:=private.runtime_dependency_integrity_v1();
  select count(*) into catalog_objects from storage.objects where bucket_id='catalog-public';
  select count(*) into content_objects from storage.objects where bucket_id='content-public';
  select count(*) into event_objects from storage.objects where bucket_id='event-public';
  select count(*) into published_products from public.products p where p.status='published' and p.is_active=true and p.deleted_at is null;
  select count(*) into products_with_real_primary from public.products p where p.status='published' and p.is_active=true and p.deleted_at is null and exists(select 1 from public.product_images pi join storage.objects so on so.bucket_id='catalog-public' and so.name=pi.storage_path where pi.product_id=p.id and pi.is_primary=true);
  select count(*),count(*) filter(where pv.weight_grams is null or pv.weight_grams<=0),count(*) filter(where pv.weight_grams>0 and pv.shipping_weight_source='estimated'),count(*) filter(where pv.weight_grams>0 and pv.shipping_weight_source in ('measured','supplier'))
  into active_variants,missing_weights,estimated_weights,verified_weights
  from public.product_variants pv join public.products p on p.id=pv.product_id
  where pv.is_active=true and p.status='published' and p.is_active=true and p.deleted_at is null;
  select count(*) into active_producers from public.producers p where p.status='active' and p.is_verified=true and p.deleted_at is null;
  select count(*) into ready_producer_accounts from private.producer_payment_accounts pa join public.producers p on p.id=pa.producer_id where p.status='active' and p.is_verified=true and p.deleted_at is null and pa.provider='iyzico' and pa.status='ready' and nullif(btrim(pa.submerchant_key),'') is not null;
  select coalesce(array_agg(distinct ce.slug order by ce.slug),'{}'::text[]) into published_legal_slugs from public.content_entries ce where ce.deleted_at is null and ce.status='published' and ce.locale='tr' and ce.slug=any(required_legal_slugs) and (char_length(btrim(coalesce(ce.body_markdown,'')))>=100 or char_length(btrim(coalesce(ce.body_html_sanitized,'')))>=100);
  select coalesce(array_agg(slug order by slug),'{}'::text[]) into missing_legal_slugs from unnest(required_legal_slugs) slug where not (slug=any(published_legal_slugs));
  payment_cfg:=private.default_payment_control_v1() || coalesce(settings.public_config->'payments','{}'::jsonb);
  return jsonb_build_object(
    'ok',true,'generatedAt',timezone('utc',now()),'integrity',runtime_integrity,
    'businessIdentity',jsonb_build_object('legalNameConfigured',nullif(btrim(coalesce(settings.legal_name,'')),'') is not null,'supportEmailConfigured',nullif(btrim(coalesce(settings.support_email,'')),'') is not null,'supportPhoneConfigured',nullif(btrim(coalesce(settings.support_phone,'')),'') is not null,'registeredLegalNameConfigured',legal_readiness->>'registeredLegalName' is not null,'registeredAddressConfigured',legal_readiness->>'registeredAddress' is not null,'registeredCountryCodeConfigured',legal_readiness->>'countryCode' is not null,'legalDocumentsFinalized',coalesce((legal_readiness->>'legalDocumentsFinalized')::boolean,false),'missing',coalesce(legal_readiness->'missing','[]'::jsonb),'ready',coalesce((legal_readiness->>'ready')::boolean,false)),
    'assets',jsonb_build_object('catalogObjectCount',catalog_objects,'contentObjectCount',content_objects,'eventObjectCount',event_objects,'publishedProductCount',published_products,'publishedProductsWithRealPrimaryImage',products_with_real_primary,'publishedProductsMissingRealPrimaryImage',greatest(published_products-products_with_real_primary,0),'catalogReady',published_products>0 and products_with_real_primary=published_products),
    'legalContent',jsonb_build_object('requiredSlugs',to_jsonb(required_legal_slugs),'publishedSlugs',to_jsonb(published_legal_slugs),'missingSlugs',to_jsonb(missing_legal_slugs),'ready',cardinality(missing_legal_slugs)=0),
    'shipping',jsonb_build_object('activePublishedVariantCount',active_variants,'missingWeightVariantCount',missing_weights,'estimatedWeightVariantCount',estimated_weights,'verifiedWeightVariantCount',verified_weights,'ready',active_variants>0 and missing_weights=0,'verifiedReady',active_variants>0 and missing_weights=0 and estimated_weights=0),
    'producerPayments',jsonb_build_object('activeVerifiedProducerCount',active_producers,'readyProducerPaymentAccountCount',ready_producer_accounts,'missingProducerPaymentAccountCount',greatest(active_producers-ready_producer_accounts,0),'ready',active_producers>0 and ready_producer_accounts=active_producers),
    'paymentControl',jsonb_build_object('provider',payment_cfg->>'provider','checkoutFormEnabled',coalesce((payment_cfg->>'checkout_form_enabled')::boolean,false),'savedCardPaymentsEnabled',coalesce((payment_cfg->>'live_card_payments_enabled')::boolean,false),'cardEnrollmentEnabled',coalesce((payment_cfg->>'card_enrollment_enabled')::boolean,false),'atLeastOneCheckoutFlowEnabled',coalesce((payment_cfg->>'checkout_form_enabled')::boolean,false) or coalesce((payment_cfg->>'live_card_payments_enabled')::boolean,false))
  );
end;
$function$;
