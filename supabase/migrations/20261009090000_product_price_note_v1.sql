-- Product page: one line under the price that says why it costs what it
-- costs ("Yılda tek hasat · 1 kg petek · ahşap kutu"), shown at the moment of
-- decision. Written per product in "Ürün sayfası içeriği" (super admin, and
-- sellers for their own products), up to 120 characters, with the same
-- health-claim guard as the other page texts. Empty: no line.
--
-- Only extends the three functions of 20261003200000_product_page_content_v1:
-- the editor read (priceNote returned, which also makes the field appear in
-- the editor), the save (priceNote accepted), and the public product detail
-- (priceNote passed to the page). No table or data change; safe to re-run.

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
    foreach key in array array['subtitle','tagline','pack','packFor','about','origin','production','ingredients','ingredientsLabel','packaging','qualifier','formerName','prestige','shippingNote','priceNote'] loop
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
      'priceNote', coalesce(p.specifications->'editorial'->>'priceNote',''),
      'shippingMode', p.shipping_fee_mode,
      'shippingFeeMinor', p.shipping_fee_minor),
    'defaultShippingFeeMinor', (private.product_page_shipping_v1(p.id)->>'feeMinor')::bigint)
  from public.products p where p.id = p_product_id and p.deleted_at is null;
$function$;
revoke all on function private.product_page_content_v1(uuid) from public, anon, authenticated;

create or replace function public.save_product_page_content_v1(p_product_id uuid, p_content jsonb, p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  role_value text := private.product_page_editor_role_v1(p_product_id);
  before_state jsonb;
  editorial jsonb;
  current_updated timestamptz;
  key text;
  text_value text;
  limits constant jsonb := '{"prestige":120,"pack":80,"about":1200,"origin":120,"production":160,"packaging":120,"returnText":200,"dispatchText":160,"shippingNote":80,"priceNote":120}'::jsonb;
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
  if lower(concat_ws(' ', editorial->>'prestige', editorial->>'about', editorial->>'origin', editorial->>'production', editorial->>'packaging', editorial->>'pack', editorial->>'shippingNote', editorial->>'priceNote'))
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
