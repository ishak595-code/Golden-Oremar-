-- Product page content editing (v1, 2026-10-03).
-- Everything the product page shows can now be edited per product by the
-- super admin (product.update) and by a seller for their own products only:
--   * per-product shipping: products.shipping_fee_mode ('default' = the
--     global shipping_zones rule, 'free', 'paid') and shipping_fee_minor (the
--     fee when paid). The page line reads "Kargo bizden" (free) or
--     "Kargo ücreti 49 TL" (paid), and cart/checkout totals use the same rule
--     server side (Türkiye only, see apply_product_shipping_overrides_v1).
--   * the per-product texts that were hardcoded in the page until now, moved
--     into products.specifications->'editorial' and backfilled with exactly
--     what the page shows today: returnText (İade row), dispatchText (first
--     Teslimat line), coldChain (the "Soğuk zincirle gönderilir" line) and an
--     optional shippingNote (the "Kargo bizden" line in your own words).
-- Source of the backfill: catalog/product-editorial/product-page-terms.v1.json,
-- computed with the page's own rules (withdrawal tier from the handling
-- profile, stored pre-order dispatch sentence, cold chain flag).
-- Existing orders are untouched; with no override set, every quote and total
-- is byte-for-byte what it was.

-- 1. Per-product shipping.
alter table public.products add column if not exists shipping_fee_mode text not null default 'default';
alter table public.products add column if not exists shipping_fee_minor bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_shipping_fee_mode_check') then
    alter table public.products add constraint products_shipping_fee_mode_check check (shipping_fee_mode in ('default','free','paid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_shipping_fee_minor_check') then
    alter table public.products add constraint products_shipping_fee_minor_check check (
      (shipping_fee_mode = 'paid' and shipping_fee_minor between 100 and 1000000)
      or (shipping_fee_mode <> 'paid' and shipping_fee_minor is null));
  end if;
end $$;

-- 2. Backfill: the page's current return / dispatch / cold chain texts,
--    with the page's own rules (catalog/product-editorial/product-page-terms.v1.json
--    holds the same 50 values for review and for the offline catalogue).
with terms as (
  select p.id,
         private.product_handling_profile_v1(p.id) h,
         p.stock_mode, p.preorder_lead_days,
         btrim(left(btrim(coalesce(p.specifications->>'preOrderTime','')), 300)) pot
    from public.products p
   where p.deleted_at is null and jsonb_typeof(p.specifications->'editorial') = 'object'
     and not (p.specifications->'editorial' ? 'returnText')
), computed as (
  select id,
         case when jsonb_typeof(h->'isPerishable') <> 'boolean' then ''
              when (h->>'isPerishable')::boolean then 'Cayma hakkı yok; hasarlı veya hatalı üründe iade hakkınız saklıdır'
              when coalesce(h->>'productType','') = '' then ''
              else '14 gün içinde, paket açılmamışsa ücretsiz iade' end return_text,
         case when stock_mode <> 'preorder' then '2-4 iş günü içinde kargoya verilir'
              when coalesce(preorder_lead_days,0) > 0 then 'Siparişten sonra yaklaşık '||preorder_lead_days||' günde kargoya verilir'
              else coalesce(nullif(regexp_replace(regexp_replace(pot, '([.!?…])\s+.*$', '\1'), '[.\s]+$', ''), ''), '2-4 iş günü içinde kargoya verilir') end dispatch_text,
         coalesce((h->>'requiresColdChain')::boolean, false) cold_chain
    from terms
)
update public.products p
   set specifications = jsonb_set(p.specifications, '{editorial}',
         (p.specifications->'editorial') || jsonb_build_object('returnText', c.return_text, 'dispatchText', c.dispatch_text, 'coldChain', c.cold_chain), true)
  from computed c
 where p.id = c.id;

-- 3. The shipping rule for one product on its own (page line).
create or replace function private.product_page_shipping_v1(p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  row_value record;
  quote jsonb;
  fee bigint;
begin
  select p.shipping_fee_mode mode, p.shipping_fee_minor fee, p.currency,
         coalesce(v.price_minor, p.base_price_minor) price, coalesce(nullif(v.weight_grams,0), 1000) grams
    into row_value
    from public.products p
    left join lateral (select x.price_minor, x.weight_grams from public.product_variants x
                        where x.product_id = p.id and x.is_active order by x.is_default desc, x.created_at limit 1) v on true
   where p.id = p_product_id and p.deleted_at is null;
  if row_value is null then return null; end if;
  if row_value.mode = 'free' then return jsonb_build_object('mode','free','feeMinor',0); end if;
  if row_value.mode = 'paid' then return jsonb_build_object('mode','paid','feeMinor',row_value.fee); end if;
  begin
    quote := public.get_shipping_quote_v1('TR', greatest(row_value.grams,1), greatest(coalesce(row_value.price,0),0), coalesce(row_value.currency,'TRY'));
    if coalesce((quote->>'available')::boolean,false) then fee := (quote->>'shippingMinor')::bigint; end if;
  exception when others then fee := null;
  end;
  return jsonb_build_object('mode','default','feeMinor',fee);
end;
$function$;
revoke all on function private.product_page_shipping_v1(uuid) from public, anon, authenticated;

-- 4. The product page detail: editorial texts (returnText and dispatchText
--    pass through even when cleared, so a cleared row stays hidden) and the
--    shipping rule.
create or replace function private.get_public_product_detail_v12(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  base jsonb := private.get_public_product_detail_v11(p_reference);
  source jsonb;
  editorial jsonb := '{}'::jsonb;
  key text;
  product_id uuid;
begin
  if base = '{}'::jsonb or base is null then return base; end if;
  product_id := private.resolve_product_id_v1(p_reference);
  select p.specifications->'editorial' into source from public.products p where p.id = product_id;
  if jsonb_typeof(source) = 'object' then
    foreach key in array array['subtitle','tagline','pack','packFor','about','origin','production','ingredients','ingredientsLabel','packaging','qualifier','formerName','prestige','shippingNote'] loop
      if jsonb_typeof(source->key) = 'string' and btrim(source->>key) <> '' then
        editorial := editorial || jsonb_build_object(key, left(btrim(source->>key), 1200));
      end if;
    end loop;
    foreach key in array array['returnText','dispatchText'] loop
      if jsonb_typeof(source->key) = 'string' then
        editorial := editorial || jsonb_build_object(key, left(btrim(source->>key), 300));
      end if;
    end loop;
    if jsonb_typeof(source->'coldChain') = 'boolean' then
      editorial := editorial || jsonb_build_object('coldChain', source->'coldChain');
    end if;
  end if;
  return base || jsonb_build_object(
    'editorial', case when editorial = '{}'::jsonb then null else editorial end,
    'shipping', private.product_page_shipping_v1(product_id));
end;
$function$;
revoke all on function private.get_public_product_detail_v12(text) from public, anon, authenticated;

-- 5. Who may edit a product's page: the super admin (product.update) any
--    product, a seller only the products of the store they own.
create or replace function private.product_page_editor_role_v1(p_product_id uuid)
returns text language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then return null; end if;
  if coalesce(private.has_permission('product.update'), false) then return 'admin'; end if;
  if exists (select 1 from public.products p join public.producers pr on pr.id = p.producer_id
              where p.id = p_product_id and p.deleted_at is null and pr.deleted_at is null
                and pr.status = 'active' and pr.owner_user_id = auth.uid()) then return 'producer'; end if;
  return null;
end;
$function$;
revoke all on function private.product_page_editor_role_v1(uuid) from public, anon, authenticated;

create or replace function private.product_page_content_v1(p_product_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'productId', p.id, 'slug', p.slug, 'name', p.name, 'updatedAt', p.updated_at,
    'content', jsonb_build_object(
      'prestige', coalesce(p.specifications->'editorial'->>'prestige',''),
      'pack', coalesce(p.specifications->'editorial'->>'pack',''),
      'about', coalesce(p.specifications->'editorial'->>'about',''),
      'origin', coalesce(p.specifications->'editorial'->>'origin',''),
      'production', coalesce(p.specifications->'editorial'->>'production',''),
      'packaging', coalesce(p.specifications->'editorial'->>'packaging',''),
      'returnText', coalesce(p.specifications->'editorial'->>'returnText',''),
      'dispatchText', coalesce(p.specifications->'editorial'->>'dispatchText',''),
      'coldChain', coalesce((p.specifications->'editorial'->>'coldChain')::boolean, p.requires_cold_chain, false),
      'shippingNote', coalesce(p.specifications->'editorial'->>'shippingNote',''),
      'shippingMode', p.shipping_fee_mode,
      'shippingFeeMinor', p.shipping_fee_minor),
    'defaultShippingFeeMinor', (private.product_page_shipping_v1(p.id)->>'feeMinor')::bigint)
  from public.products p where p.id = p_product_id and p.deleted_at is null;
$function$;
revoke all on function private.product_page_content_v1(uuid) from public, anon, authenticated;

create or replace function public.get_product_page_content_v1(p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare role_value text := private.product_page_editor_role_v1(p_product_id);
        result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if role_value is null then raise exception 'product_page_edit_forbidden' using errcode = '42501'; end if;
  result := private.product_page_content_v1(p_product_id);
  if result is null then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  return result || jsonb_build_object('role', role_value);
end;
$function$;
revoke all on function public.get_product_page_content_v1(uuid) from public, anon;
grant execute on function public.get_product_page_content_v1(uuid) to authenticated;

create or replace function private.page_text_v1(p_content jsonb, p_key text, p_max integer)
returns text language plpgsql immutable set search_path to '' as $function$
declare value text;
begin
  if not (p_content ? p_key) or p_content->p_key = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p_content->p_key) <> 'string' then raise exception 'invalid_page_text:%', p_key using errcode = '22023'; end if;
  value := btrim(regexp_replace(p_content->>p_key, '[ \t]+', ' ', 'g'));
  if char_length(value) > p_max then raise exception 'page_text_too_long:%:%', p_key, p_max using errcode = '22023'; end if;
  if value ~ '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]' or value ~ '<[a-zA-Z/!]' then raise exception 'invalid_page_text:%', p_key using errcode = '22023'; end if;
  return value;
end;
$function$;
revoke all on function private.page_text_v1(jsonb,text,integer) from public, anon, authenticated;

create or replace function public.save_product_page_content_v1(p_product_id uuid, p_content jsonb, p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  role_value text := private.product_page_editor_role_v1(p_product_id);
  before_state jsonb;
  editorial jsonb;
  current_updated timestamptz;
  key text;
  text_value text;
  limits constant jsonb := '{"prestige":120,"pack":80,"about":1200,"origin":120,"production":160,"packaging":120,"returnText":200,"dispatchText":160,"shippingNote":80}'::jsonb;
  mode_value text;
  fee_value bigint;
  fee_text text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if role_value is null then raise exception 'product_page_edit_forbidden' using errcode = '42501'; end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' or pg_column_size(p_content) > 32768 then raise exception 'invalid_page_content' using errcode = '22023'; end if;
  select p.updated_at, coalesce(p.specifications->'editorial','{}'::jsonb), p.shipping_fee_mode, p.shipping_fee_minor
    into current_updated, editorial, mode_value, fee_value
    from public.products p where p.id = p_product_id and p.deleted_at is null for update;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is not null and current_updated is distinct from p_expected_updated_at then
    raise exception 'product_page_stale' using errcode = '40001';
  end if;
  before_state := private.product_page_content_v1(p_product_id)->'content';
  if jsonb_typeof(editorial) <> 'object' then editorial := '{}'::jsonb; end if;

  for key in select jsonb_object_keys(limits) loop
    text_value := private.page_text_v1(p_content, key, (limits->>key)::integer);
    if text_value is not null then editorial := editorial || jsonb_build_object(key, text_value); end if;
  end loop;
  if (p_content ? 'prestige') and array_length(regexp_split_to_array(coalesce(editorial->>'prestige',''), '·'), 1) > 3 then
    raise exception 'prestige_too_many_parts' using errcode = '22023';
  end if;
  -- The pack line describes the variant it was written for; editing it here
  -- makes it describe the current default variant.
  if (p_content ? 'pack') and coalesce(editorial->>'pack','') is distinct from coalesce(before_state->>'pack','') then
    editorial := editorial || jsonb_build_object('packFor', coalesce((select x.name from public.product_variants x where x.product_id = p_product_id and x.is_active order by x.is_default desc, x.created_at limit 1), ''));
  end if;
  -- Same rule as the publication guard: no health claims in page texts.
  if lower(concat_ws(' ', editorial->>'prestige', editorial->>'about', editorial->>'origin', editorial->>'production', editorial->>'packaging', editorial->>'pack', editorial->>'shippingNote'))
     ~ '(şifa (deposu|kaynağı|iksiri|harikası)|doğal antibiyotik|bağışıklık.{0,40}(güçlendirir|destekler|artırır|korur)|(hastalık|kanser|diyabet|astım|bronşit|kolesterol|tansiyon|damar|romatizma|ağrı|yara|aft).{0,45}(önler|tedavi eder|iyileştirir|korur|hafifletir|giderir|düşürür|dengeler|açar|temizler))' then
    raise exception 'page_text_health_claim' using errcode = '23514';
  end if;
  if p_content ? 'coldChain' then
    if jsonb_typeof(p_content->'coldChain') <> 'boolean' then raise exception 'invalid_page_text:coldChain' using errcode = '22023'; end if;
    editorial := editorial || jsonb_build_object('coldChain', p_content->'coldChain');
  end if;

  if p_content ? 'shippingMode' then
    mode_value := p_content->>'shippingMode';
    if mode_value not in ('default','free','paid') then raise exception 'invalid_shipping_mode' using errcode = '22023'; end if;
    if mode_value = 'paid' then
      fee_text := p_content->>'shippingFeeMinor';
      if fee_text is null or fee_text !~ '^[0-9]{1,9}$' then raise exception 'invalid_shipping_fee' using errcode = '22023'; end if;
      fee_value := fee_text::bigint;
      if fee_value < 100 or fee_value > 1000000 then raise exception 'shipping_fee_out_of_range' using errcode = '22023'; end if;
    else
      fee_value := null;
    end if;
  end if;

  update public.products p
     set specifications = jsonb_set(coalesce(p.specifications,'{}'::jsonb), '{editorial}', editorial, true),
         shipping_fee_mode = mode_value,
         shipping_fee_minor = fee_value,
         updated_at = timezone('utc', now())
   where p.id = p_product_id;

  perform private.write_admin_audit_v2(
    'product.page_content.update', 'product', p_product_id::text,
    before_state, private.product_page_content_v1(p_product_id)->'content',
    jsonb_build_object('role', role_value));
  return private.product_page_content_v1(p_product_id) || jsonb_build_object('role', role_value, 'ok', true);
end;
$function$;
revoke all on function public.save_product_page_content_v1(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.save_product_page_content_v1(uuid,jsonb,timestamptz) to authenticated;

-- 6. Checkout: the per-product rule on top of the zone quote, server side.
--    Türkiye only (other countries keep their zone or manual quote). One
--    package per order: when every product ships free the shipping is 0;
--    otherwise the highest fee among paid products and, when the order also
--    has products without an override, the zone's own fee for the order.
--    Products without an override leave the quote exactly as it was.
create or replace function private.apply_product_shipping_overrides_v1(p_quote jsonb, p_product_ids uuid[], p_country_code text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  override_count integer;
  default_count integer;
  max_paid bigint;
  zone_fee bigint;
  fee bigint;
begin
  if p_quote is null or not coalesce((p_quote->>'available')::boolean, false) then return p_quote; end if;
  if upper(btrim(coalesce(p_country_code,''))) <> 'TR' or p_product_ids is null or cardinality(p_product_ids) = 0 then return p_quote; end if;
  select count(*) filter (where p.shipping_fee_mode in ('free','paid')),
         count(*) filter (where p.shipping_fee_mode = 'default'),
         max(p.shipping_fee_minor) filter (where p.shipping_fee_mode = 'paid')
    into override_count, default_count, max_paid
    from (select distinct unnest(p_product_ids) id) ids join public.products p on p.id = ids.id;
  if coalesce(override_count,0) = 0 then return p_quote; end if;
  zone_fee := coalesce((p_quote->>'shippingMinor')::bigint, 0);
  fee := greatest(case when coalesce(default_count,0) > 0 then zone_fee else 0 end, coalesce(max_paid, 0));
  return p_quote || jsonb_build_object(
    'shippingMinor', fee,
    'productShippingOverride', true,
    'freeShippingThresholdMinor', case when coalesce(max_paid,0) > 0 then null else p_quote->'freeShippingThresholdMinor' end);
end;
$function$;
revoke all on function private.apply_product_shipping_overrides_v1(jsonb,uuid[],text) from public, anon, authenticated;

do $patch$
declare
  def text;
  target_fn regprocedure;
  patches jsonb := jsonb_build_array(
    jsonb_build_object('fn','private.create_customer_order_v2(jsonb,jsonb,text,text)','edits',jsonb_build_array(
      jsonb_build_array('  total_weight integer:=0;', E'  total_weight integer:=0;\n  shipping_product_ids uuid[]:=''{}'';'),
      jsonb_build_array('    subtotal_value:=subtotal_value+(variant_row.price_minor*quantity_value);', E'    subtotal_value:=subtotal_value+(variant_row.price_minor*quantity_value);\n    shipping_product_ids:=array_append(shipping_product_ids,product_row.id);'),
      jsonb_build_array('  quote:=public.get_shipping_quote_v1(country_code,total_weight,subtotal_value,currency_value);', '  quote:=private.apply_product_shipping_overrides_v1(public.get_shipping_quote_v1(country_code,total_weight,subtotal_value,currency_value),shipping_product_ids,country_code);'))),
    jsonb_build_object('fn','private.preview_my_checkout_v1(text,text)','edits',jsonb_build_array(
      jsonb_build_array('    quote:=public.get_shipping_quote_v1(normalized_country,shipping_weight,subtotal_value,currency_value);', '    quote:=private.apply_product_shipping_overrides_v1(public.get_shipping_quote_v1(normalized_country,shipping_weight,subtotal_value,currency_value),(select array_agg(sv.product_id) from public.cart_items sci join public.product_variants sv on sv.id=sci.variant_id where sci.cart_id=cart_row.id),normalized_country);'))),
    jsonb_build_object('fn','private.preview_gift_checkout_v1(text,text,integer,text,text)','edits',jsonb_build_array(
      jsonb_build_array('    quote:=public.get_shipping_quote_v1(country,shipping_weight,subtotal,product_row.currency);', '    quote:=private.apply_product_shipping_overrides_v1(public.get_shipping_quote_v1(country,shipping_weight,subtotal,product_row.currency),array[product_row.id],country);'))),
    jsonb_build_object('fn','private.submit_order_request_v1(text,text,text,jsonb,jsonb,boolean)','edits',jsonb_build_array(
      jsonb_build_array('  quote := public.get_shipping_quote_v1(''TR'', greatest(weight, 1000), subtotal, ''TRY'');', '  quote := private.apply_product_shipping_overrides_v1(public.get_shipping_quote_v1(''TR'', greatest(weight, 1000), subtotal, ''TRY''), (select array_agg((pl->>''productId'')::uuid) from jsonb_array_elements(priced) pl), ''TR'');'))));
  patch jsonb;
  edit jsonb;
begin
  for patch in select value from jsonb_array_elements(patches) loop
    target_fn := (patch->>'fn')::regprocedure;
    def := pg_get_functiondef(target_fn);
    if position('apply_product_shipping_overrides_v1' in def) > 0 then continue; end if;
    for edit in select value from jsonb_array_elements(patch->'edits') loop
      if (char_length(def) - char_length(replace(def, edit->>0, ''))) / char_length(edit->>0) <> 1 then
        raise exception 'checkout function changed; shipping override not wired into %: %', patch->>'fn', edit->>0;
      end if;
      def := replace(def, edit->>0, edit->>1);
    end loop;
    execute def;
  end loop;
end
$patch$;
