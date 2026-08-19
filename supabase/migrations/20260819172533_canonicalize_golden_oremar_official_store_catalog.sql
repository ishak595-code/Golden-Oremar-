alter table public.producers add column if not exists store_kind text not null default 'independent';

alter table public.producers drop constraint if exists producers_store_kind_check;
alter table public.producers add constraint producers_store_kind_check check (store_kind in ('official','independent'));
alter table public.producers drop constraint if exists producers_official_store_shape_check;
alter table public.producers add constraint producers_official_store_shape_check check (
  store_kind <> 'official' or (producer_type='brand' and owner_user_id is null and application_id is null)
);
create unique index if not exists producers_single_official_store_idx on public.producers(store_kind) where store_kind='official' and deleted_at is null;

create table if not exists private.legacy_product_source_archive (
  product_id uuid primary key references public.products(id) on delete restrict,
  archived_producer_id uuid,
  archived_producer_slug text,
  archived_producer_name text,
  archived_producer_type text,
  archived_production_location text,
  archived_country_code text,
  archived_province text,
  archived_district text,
  archived_village text,
  archived_product_origin text,
  archive_reason text not null,
  archived_at timestamptz not null default timezone('utc',now())
);
revoke all on private.legacy_product_source_archive from public, anon, authenticated;

create table if not exists public.product_provenance (
  product_id uuid primary key references public.products(id) on delete cascade,
  seller_model text not null,
  source_mode text not null,
  source_producer_id uuid references public.producers(id) on delete set null,
  source_display_name text,
  country_code text not null,
  province text not null,
  district text not null,
  village text not null,
  locality_detail text,
  origin_label text not null,
  origin_verified boolean not null default false,
  organic_claim text not null default 'not_claimed',
  public_note text,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint product_provenance_seller_model_check check (seller_model in ('official_store','independent_producer')),
  constraint product_provenance_source_mode_check check (source_mode in ('platform_village_catalog','platform_direct','village_partner','independent_producer')),
  constraint product_provenance_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint product_provenance_organic_claim_check check (organic_claim in ('producer_declared_organic','certification_in_progress','certified_organic','not_claimed')),
  constraint product_provenance_source_shape_check check (
    (seller_model='official_store' and source_mode in ('platform_village_catalog','platform_direct','village_partner'))
    or (seller_model='independent_producer' and source_mode='independent_producer' and source_producer_id is not null)
  )
);
alter table public.product_provenance enable row level security;
drop policy if exists product_provenance_public_read on public.product_provenance;
create policy product_provenance_public_read on public.product_provenance for select to anon, authenticated using (
  exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.is_active=true and p.deleted_at is null)
);
grant select on public.product_provenance to anon, authenticated;
revoke insert,update,delete,truncate,references,trigger on public.product_provenance from anon, authenticated;

insert into private.legacy_product_source_archive(
  product_id,archived_producer_id,archived_producer_slug,archived_producer_name,archived_producer_type,
  archived_production_location,archived_country_code,archived_province,archived_district,archived_village,
  archived_product_origin,archive_reason
)
select pr.id,p.id,p.slug,p.display_name,p.producer_type,p.production_location,p.production_country_code,
       p.production_province,p.production_district,p.production_village,pr.origin,
       'canonicalized_to_golden_oremar_official_store_after_owner_confirmation'
from public.products pr
join public.producers p on p.id=pr.producer_id
where pr.deleted_at is null and p.slug<>'golden-oremar'
on conflict(product_id) do nothing;

update public.producers
set store_kind='official',display_name='Golden Oremar',production_location='Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',
    production_country_code='TR',production_province='Hakkâri',production_district='Yüksekova',production_village='Yeşiltaş',
    production_village_is_custom=false,status='active',is_verified=true,origin_verified=true,
    origin_verified_at=coalesce(origin_verified_at,timezone('utc',now())),origin_verification_basis='admin_manual_verification',
    trust_badge_status='active',trust_badge_granted_at=coalesce(trust_badge_granted_at,timezone('utc',now())),trust_badge_revoked_at=null,
    trust_badge_reason='Golden Oremar resmi platform mağazası ve doğrulanmış Yeşiltaş köy kataloğu',commission_basis_points=0,
    updated_at=timezone('utc',now())
where slug='golden-oremar' and deleted_at is null;

with official as (select id from public.producers where slug='golden-oremar' and store_kind='official' and deleted_at is null)
update public.products pr
set producer_id=(select id from official),origin='Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',country_of_origin_code=coalesce(country_of_origin_code,'TR'),updated_at=timezone('utc',now())
where pr.deleted_at is null and exists(select 1 from official);

with official as (select id from public.producers where slug='golden-oremar' and store_kind='official' and deleted_at is null)
insert into public.product_provenance(product_id,seller_model,source_mode,source_producer_id,source_display_name,country_code,province,district,village,locality_detail,origin_label,origin_verified,organic_claim,public_note)
select pr.id,'official_store','platform_village_catalog',(select id from official),'Golden Oremar Resmi Mağazası','TR','Hakkâri','Yüksekova','Yeşiltaş','Dağlıca',
       'Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',true,'producer_declared_organic',
       'Golden Oremar resmi mağazası tarafından yönetilen Yeşiltaş köy kataloğu. Sertifikalı organik ibaresi yalnız geçerli ürün sertifikası varsa ayrıca gösterilir.'
from public.products pr where pr.deleted_at is null and exists(select 1 from official)
on conflict(product_id) do update set seller_model=excluded.seller_model,source_mode=excluded.source_mode,source_producer_id=excluded.source_producer_id,
  source_display_name=excluded.source_display_name,country_code=excluded.country_code,province=excluded.province,district=excluded.district,village=excluded.village,
  locality_detail=excluded.locality_detail,origin_label=excluded.origin_label,origin_verified=excluded.origin_verified,organic_claim=excluded.organic_claim,
  public_note=excluded.public_note,updated_at=timezone('utc',now());

update public.producers
set status='closed',is_verified=false,origin_verified=false,trust_badge_status='none',trust_badge_revoked_at=coalesce(trust_badge_revoked_at,timezone('utc',now())),
    trust_badge_reason='Eski katalog kaynak etiketi; bağımsız mağaza olarak kullanılmıyor.',updated_at=timezone('utc',now())
where deleted_at is null and slug<>'golden-oremar' and owner_user_id is null and application_id is null;

create or replace function public.get_public_product_provenance_v1(p_reference text)
returns jsonb language sql stable set search_path to '' as $$
  select case when p.id is null then null else jsonb_build_object(
    'productId',p.id,'sellerModel',pp.seller_model,'sourceMode',pp.source_mode,'sourceDisplayName',pp.source_display_name,
    'origin',jsonb_build_object('countryCode',pp.country_code,'province',pp.province,'district',pp.district,'village',pp.village,'localityDetail',pp.locality_detail,'label',pp.origin_label),
    'originVerified',pp.origin_verified,'organicClaim',pp.organic_claim,'publicNote',pp.public_note
  ) end
  from public.products p join public.product_provenance pp on pp.product_id=p.id
  where (p.id::text=btrim(coalesce(p_reference,'')) or p.legacy_id=btrim(coalesce(p_reference,'')) or p.slug=lower(btrim(coalesce(p_reference,''))))
    and p.status='published' and p.is_active=true and p.deleted_at is null limit 1;
$$;
grant execute on function public.get_public_product_provenance_v1(text) to anon, authenticated;
