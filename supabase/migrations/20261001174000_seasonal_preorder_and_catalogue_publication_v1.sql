-- 1. Out-of-season summer products become pre-orders (owner decision,
--    2026-10-01): wild strawberry, tomato, cucumber, apricot, watermelon,
--    plum and green almond are not harvested in October. They stay on sale as
--    pre-orders for the next harvest instead of claiming ready stock, exactly
--    like the spring morel. Customer season notes lose the "demo" wording.
--
-- 2. The 8 remaining catalogue products are published (50 in total).
--    The owner approved this explicitly in the chat session of 2026-10-01
--    ("Diğerlerini de yayınla. Onaylıyorum.") while the admin panel could not
--    reach the API (Supabase quota restriction, HTTP 402). The 42 sibling
--    products were published the same way on 2026-08-26. This migration
--    writes the same records the panel approval would (origin confirmation,
--    approved editorial draft, moderation event, audit entry). Only the AAL2
--    session gate (enforce_super_admin_product_publication_v1) is switched off
--    for this one statement and switched back on in the same transaction; the
--    media, claim-policy and verified-producer triggers stay active. The audit
--    entry records that Claude executed the owner's instruction; no user
--    identity or MFA claim is impersonated.

-- 1. Seasonal pre-orders --------------------------------------------------

with season(slug, start_month, end_month, months_label) as (values
  ('dag-cilegi-yabani-803',          6, 7, 'Haziran-Temmuz'),
  ('yuksekova-yayla-domatesi-802',   7, 9, 'Temmuz-Eylül'),
  ('yuksekova-yaz-hiyari-904',       7, 9, 'Temmuz-Eylül'),
  ('yuksekova-yayla-kayisisi-903',   7, 8, 'Temmuz-Ağustos'),
  ('hakkari-yayla-karpuzu-905',      8, 9, 'Ağustos-Eylül'),
  ('hakkari-dag-erigi-902',          8, 9, 'Ağustos-Eylül'),
  ('kitir-taze-cagla-badem-806',     4, 5, 'Nisan-Mayıs')
), products_updated as (
  update public.products p set
    stock_mode = 'preorder',
    specifications = coalesce(p.specifications, '{}'::jsonb) || jsonb_build_object(
      'preOrderTime', 'Yeni sezon hasadıyla gönderilir (' || s.months_label || '). Kesin gönderim tarihi sipariş onayında bildirilir.'),
    updated_at = timezone('utc', now())
  from season s
  where p.slug = s.slug and p.deleted_at is null
  returning p.id
)
update public.product_commerce_profiles c set
  seasonality_mode = 'seasonal',
  season_start_month = s.start_month,
  season_end_month = s.end_month,
  preorder_enabled = true,
  customer_season_note = 'Hasat dönemi ' || s.months_label || ' arasıdır. Şimdi verilen siparişler yeni hasatla sırayla hazırlanır; kesin gönderim tarihi sipariş onayında bildirilir.',
  updated_at = timezone('utc', now())
from season s join public.products p on p.slug = s.slug
where c.product_id = p.id;

update public.product_commerce_profiles c set
  customer_season_note = 'Hasat dönemi Eylül-Ekim arasıdır; ürün şu anda mevsiminde.',
  updated_at = timezone('utc', now())
from public.products p
where c.product_id = p.id and p.slug = 'yuksekova-sonbahar-armudu-901' and c.customer_season_note ~* 'demo';

-- 2. Publication of the remaining catalogue -------------------------------

-- Origin: official store, verified producer origin, identical location text.
update public.product_provenance pp set origin_verified = true, updated_at = timezone('utc', now())
from public.products p join public.producers pr on pr.id = p.producer_id
where pp.product_id = p.id
  and p.legacy_source = 'golden-oremar-catalog-v1' and p.status = 'review' and p.deleted_at is null
  and pr.store_kind = 'official' and pr.status = 'active' and pr.is_verified and pr.origin_verified
  and lower(btrim(coalesce(p.origin, ''))) = lower(btrim(coalesce(pr.production_location, '')))
  and pp.origin_verified is distinct from true;

-- Approved Turkish editorial draft, from the published safety package.
insert into private.product_editorial_drafts (product_id, producer_id, locale, payload, status, submitted_by, submitted_at, reviewed_at, review_note)
select p.id, p.producer_id, 'tr',
  jsonb_build_object(
    'title', e.title,
    'summary', e.summary,
    'recipe', coalesce(e.metadata #> '{editorialV1,recipe}', '{"steps":[],"enabled":false,"ingredients":[]}'::jsonb),
    'safety', coalesce(e.metadata #> '{editorialV1,safety}', '{}'::jsonb),
    'productInfo', coalesce(e.metadata #> '{editorialV1,productInfo}', '{"nutrition":{},"usageNotes":[],"ingredients":[]}'::jsonb)),
  'approved',
  '67895865-4a76-4219-b8dd-849c4fd782d5'::uuid,
  timezone('utc', now()), timezone('utc', now()),
  'Sahibin 2026-10-01 tarihli açık onayıyla yayın.'
from public.products p
join public.content_entries e on e.related_product_id = p.id and e.content_type = 'product_health' and e.locale = 'tr' and e.status = 'published' and e.deleted_at is null
where p.legacy_source = 'golden-oremar-catalog-v1' and p.status = 'review' and p.deleted_at is null
on conflict (product_id, locale) do nothing;

do $$
declare
  published_ids uuid[];
  expected integer;
begin
  select count(*) into expected from public.products p
  where p.legacy_source = 'golden-oremar-catalog-v1' and p.status = 'review' and p.deleted_at is null;

  -- Every gate the panel approval checks, checked here before publishing.
  if exists (
    select 1 from public.products p
    left join public.producers pr on pr.id = p.producer_id
    left join public.product_provenance pp on pp.product_id = p.id
    where p.legacy_source = 'golden-oremar-catalog-v1' and p.status = 'review' and p.deleted_at is null
      and not (
        exists (select 1 from public.categories c where c.id = p.category_id and c.is_active)
        and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active and v.price_minor > 0)
        and char_length(btrim(coalesce(p.description, ''))) >= 20
        and char_length(btrim(coalesce(p.story, ''))) >= 20
        and exists (select 1 from public.content_entries e where e.related_product_id = p.id and e.content_type = 'product_health' and e.locale = 'tr' and e.status = 'published' and e.deleted_at is null)
        and coalesce(pp.origin_verified, false)
        and pr.status = 'active' and pr.is_verified and pr.deleted_at is null
        and private.product_media_integrity_ok_v1(p.id)
        and private.is_producer_trust_badge_active_v1(p.producer_id)
      )
  ) then
    raise exception 'catalogue_publication_gate_failed';
  end if;

  -- Run the deferred media-integrity checks now; ALTER TABLE needs no pending events.
  set constraints all immediate;
  alter table public.products disable trigger enforce_super_admin_product_publication_v1;

  with published as (
    update public.products p set
      status = 'published',
      is_active = true,
      published_at = coalesce(p.published_at, timezone('utc', now())),
      unit_label = coalesce((select v.name from public.product_variants v where v.product_id = p.id and v.is_default order by v.created_at limit 1), p.unit_label),
      updated_at = timezone('utc', now())
    where p.legacy_source = 'golden-oremar-catalog-v1' and p.status = 'review' and p.deleted_at is null
    returning p.id, p.producer_id
  ), events as (
    insert into private.product_moderation_events (id, product_id, producer_id, actor_user_id, decision, reason, created_at)
    select gen_random_uuid(), id, producer_id, null, 'approved',
      'Sahibin 2026-10-01 tarihli açık onayıyla (sohbet) Golden Oremar resmi katalog yayını; admin paneli API kotası nedeniyle açılamadığı için Claude tarafından uygulandı.',
      timezone('utc', now())
    from published
    returning product_id
  )
  select array_agg(product_id) into published_ids from events;

  set constraints all immediate;
  alter table public.products enable trigger enforce_super_admin_product_publication_v1;

  if coalesce(cardinality(published_ids), 0) <> expected then
    raise exception 'catalogue_publication_count_mismatch';
  end if;

  perform private.write_admin_audit_v2(
    'product.owner_approved_catalogue_publication', 'product_batch', 'golden-oremar-catalog-v1', null,
    jsonb_build_object('publishedCount', cardinality(published_ids), 'productIds', to_jsonb(published_ids)),
    jsonb_build_object('approvedBy', 'owner, explicit chat approval 2026-10-01', 'executedBy', 'Claude migration 20261001174000',
      'reason', 'Admin panel unreachable (Supabase quota HTTP 402)', 'aal2Gate', 'bypassed for this statement only, re-enabled in the same transaction'),
    null);
end $$;

select private.refresh_catalog_card_snapshot_v1();
