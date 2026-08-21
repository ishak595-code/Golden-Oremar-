create or replace function private.preview_gift_checkout_v1(
  p_product_reference text,
  p_variant_reference text,
  p_quantity integer,
  p_country_code text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  country text:=upper(btrim(coalesce(p_country_code,'')));
  product_row public.products%rowtype;
  variant_row public.product_variants%rowtype;
  available_quantity integer;
  subtotal bigint:=0;
  total_weight integer:=0;
  missing_weight integer:=0;
  shipping_weight integer:=0;
  quote jsonb:=jsonb_build_object('available',false,'reason','not_calculated');
  shipping bigint:=0;
  discount bigint:=0;
  product_discount bigint:=0;
  shipping_discount bigint:=0;
  promotion jsonb:=jsonb_build_object('eligible',false,'applied',false,'totalDiscountMinor',0);
  blocking text:=null;
  can_checkout boolean:=true;
  coupon_supplied boolean:=nullif(btrim(coalesce(p_coupon_code,'')),'') is not null;
  coupon_row public.coupons%rowtype;
  campaign_row public.campaigns%rowtype;
  candidate public.campaigns%rowtype;
  code_hash text;
  eligible boolean;
  candidate_discount bigint;
  best_discount bigint:=0;
  best_priority integer:=-1000000;
  campaign_usage bigint;
  campaign_user_usage bigint;
  coupon_usage bigint;
  coupon_user_usage bigint;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid and p.status='active' and p.deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  if p_product_reference is null or char_length(btrim(p_product_reference)) not between 1 and 220 then raise exception 'invalid_product_reference' using errcode='22023'; end if;
  if p_variant_reference is null or char_length(btrim(p_variant_reference)) not between 1 and 160 then raise exception 'invalid_variant_reference' using errcode='22023'; end if;
  if p_quantity is null or p_quantity not between 1 and 20 then raise exception 'invalid_gift_quantity' using errcode='22023'; end if;
  if country !~ '^[A-Z]{2}$' then raise exception 'invalid_shipping_country' using errcode='22023'; end if;

  select p.* into product_row
  from public.products p join public.producers pr on pr.id=p.producer_id
  where (p.id::text=btrim(p_product_reference) or p.slug=btrim(p_product_reference) or p.legacy_id=btrim(p_product_reference))
    and p.status='published' and p.is_active=true and p.deleted_at is null and pr.status='active' and pr.is_verified=true and pr.deleted_at is null
  limit 1;
  if product_row.id is null then raise exception 'product_not_available' using errcode='22023'; end if;

  select v.* into variant_row from public.product_variants v
  where v.product_id=product_row.id and v.is_active=true and (v.id::text=btrim(p_variant_reference) or v.sku=btrim(p_variant_reference))
  limit 1;
  if variant_row.id is null then raise exception 'variant_not_available' using errcode='22023'; end if;

  if product_row.stock_mode in ('tracked','seasonal') then
    select greatest(0,inv.available_quantity-inv.reserved_quantity) into available_quantity from public.product_inventory inv where inv.variant_id=variant_row.id;
    if available_quantity is null then can_checkout:=false; blocking:='stock_unverified';
    elsif available_quantity<p_quantity then can_checkout:=false; blocking:='insufficient_stock'; end if;
  end if;

  subtotal:=variant_row.price_minor*p_quantity;
  if subtotal<=0 then raise exception 'invalid_order_total' using errcode='22023'; end if;
  if variant_row.weight_grams is null or variant_row.weight_grams<=0 then missing_weight:=p_quantity; else total_weight:=variant_row.weight_grams*p_quantity; end if;

  if country<>'TR' and missing_weight>0 then
    can_checkout:=false; if blocking is null then blocking:='international_shipping_weight_missing'; end if;
    quote:=jsonb_build_object('available',false,'manualQuoteRequired',false,'countryCode',country,'reason','international_shipping_weight_missing','missingWeightQuantity',missing_weight);
  else
    shipping_weight:=greatest(total_weight,case when missing_weight>0 then missing_weight else 1 end);
    quote:=public.get_shipping_quote_v1(country,shipping_weight,subtotal,product_row.currency);
    if not coalesce((quote->>'available')::boolean,false) then can_checkout:=false; if blocking is null then blocking:=coalesce(quote->>'reason','shipping_not_available'); end if;
    else shipping:=coalesce((quote->>'shippingMinor')::bigint,0); end if;
  end if;

  if coupon_supplied then
    code_hash:=private.hash_coupon_code_v1(p_coupon_code);
    select c.* into coupon_row from public.coupons c where c.code_hash=code_hash and c.status='active' and (c.starts_at is null or timezone('utc',now())>=c.starts_at) and (c.ends_at is null or timezone('utc',now())<=c.ends_at) limit 1;
    if coupon_row.id is null then
      can_checkout:=false; if blocking is null then blocking:='coupon_invalid_or_unavailable'; end if;
      promotion:=jsonb_build_object('eligible',false,'applied',false,'reason','coupon_invalid_or_unavailable','totalDiscountMinor',0);
    else
      select * into campaign_row from public.campaigns c where c.id=coupon_row.campaign_id;
      eligible:=campaign_row.id is not null and campaign_row.activation_mode='coupon' and campaign_row.status='active'
        and timezone('utc',now()) between campaign_row.starts_at and campaign_row.ends_at and subtotal>=campaign_row.minimum_order_minor
        and (campaign_row.discount_type<>'fixed' or campaign_row.currency=product_row.currency)
        and (campaign_row.target_scope='all'
          or (campaign_row.target_scope='products' and exists(select 1 from public.campaign_products l where l.campaign_id=campaign_row.id and l.product_id=product_row.id))
          or (campaign_row.target_scope='categories' and exists(select 1 from public.campaign_categories l where l.campaign_id=campaign_row.id and l.category_id=product_row.category_id)));
      if eligible then
        select count(*) into campaign_usage from private.promotion_redemptions r where r.campaign_id=campaign_row.id and (r.status='consumed' or (r.status='reserved' and (r.expires_at is null or r.expires_at>timezone('utc',now()))));
        select count(*) into campaign_user_usage from private.promotion_redemptions r where r.campaign_id=campaign_row.id and r.user_id=uid and (r.status='consumed' or (r.status='reserved' and (r.expires_at is null or r.expires_at>timezone('utc',now()))));
        select count(*) into coupon_usage from private.promotion_redemptions r where r.coupon_id=coupon_row.id and (r.status='consumed' or (r.status='reserved' and (r.expires_at is null or r.expires_at>timezone('utc',now()))));
        select count(*) into coupon_user_usage from private.promotion_redemptions r where r.coupon_id=coupon_row.id and r.user_id=uid and (r.status='consumed' or (r.status='reserved' and (r.expires_at is null or r.expires_at>timezone('utc',now()))));
        if (campaign_row.usage_limit is not null and campaign_usage>=campaign_row.usage_limit) or campaign_user_usage>=campaign_row.per_user_limit or (coupon_row.usage_limit is not null and coupon_usage>=coupon_row.usage_limit) or coupon_user_usage>=coupon_row.per_user_limit then eligible:=false; end if;
      end if;
      if not eligible then
        can_checkout:=false; if blocking is null then blocking:='coupon_not_applicable'; end if;
        promotion:=jsonb_build_object('eligible',false,'applied',false,'reason','coupon_not_applicable','displayHint',coupon_row.display_hint,'totalDiscountMinor',0);
      else
        if campaign_row.discount_type='percentage' then
          product_discount:=floor((subtotal::numeric*campaign_row.discount_value::numeric)/10000)::bigint;
          if campaign_row.max_discount_minor is not null then product_discount:=least(product_discount,campaign_row.max_discount_minor); end if;
          product_discount:=least(product_discount,subtotal);
        elsif campaign_row.discount_type='fixed' then product_discount:=least(campaign_row.discount_value::bigint,subtotal);
        else shipping_discount:=shipping; end if;
        discount:=product_discount+shipping_discount;
        if discount<=0 or subtotal+shipping-discount<=0 then
          can_checkout:=false; if blocking is null then blocking:='coupon_not_applicable'; end if;
          promotion:=jsonb_build_object('eligible',false,'applied',false,'reason','zero_discount','totalDiscountMinor',0);
        else
          promotion:=jsonb_build_object('eligible',true,'applied',true,'campaignId',campaign_row.id,'title',campaign_row.title,'couponId',coupon_row.id,'displayHint',coupon_row.display_hint,'discountType',campaign_row.discount_type,'productDiscountMinor',product_discount,'shippingDiscountMinor',shipping_discount,'totalDiscountMinor',discount);
        end if;
      end if;
    end if;
  else
    for candidate in select c.* from public.campaigns c where c.activation_mode='automatic' and c.status='active' and timezone('utc',now()) between c.starts_at and c.ends_at order by c.priority desc,c.created_at asc
    loop
      eligible:=subtotal>=candidate.minimum_order_minor
        and (candidate.discount_type<>'fixed' or candidate.currency=product_row.currency)
        and (candidate.target_scope='all'
          or (candidate.target_scope='products' and exists(select 1 from public.campaign_products l where l.campaign_id=candidate.id and l.product_id=product_row.id))
          or (candidate.target_scope='categories' and exists(select 1 from public.campaign_categories l where l.campaign_id=candidate.id and l.category_id=product_row.category_id)));
      if not eligible then continue; end if;
      select count(*) into campaign_usage from private.promotion_redemptions r where r.campaign_id=candidate.id and (r.status='consumed' or (r.status='reserved' and (r.expires_at is null or r.expires_at>timezone('utc',now()))));
      select count(*) into campaign_user_usage from private.promotion_redemptions r where r.campaign_id=candidate.id and r.user_id=uid and (r.status='consumed' or (r.status='reserved' and (r.expires_at is null or r.expires_at>timezone('utc',now()))));
      if (candidate.usage_limit is not null and campaign_usage>=candidate.usage_limit) or campaign_user_usage>=candidate.per_user_limit then continue; end if;
      product_discount:=0; shipping_discount:=0;
      if candidate.discount_type='percentage' then
        product_discount:=floor((subtotal::numeric*candidate.discount_value::numeric)/10000)::bigint;
        if candidate.max_discount_minor is not null then product_discount:=least(product_discount,candidate.max_discount_minor); end if;
        product_discount:=least(product_discount,subtotal);
      elsif candidate.discount_type='fixed' then product_discount:=least(candidate.discount_value::bigint,subtotal);
      else shipping_discount:=shipping; end if;
      candidate_discount:=product_discount+shipping_discount;
      if candidate_discount>0 and subtotal+shipping-candidate_discount>0 and (candidate_discount>best_discount or (candidate_discount=best_discount and candidate.priority>best_priority)) then
        best_discount:=candidate_discount; best_priority:=candidate.priority; discount:=candidate_discount;
        promotion:=jsonb_build_object('eligible',true,'applied',true,'campaignId',candidate.id,'title',candidate.title,'discountType',candidate.discount_type,'productDiscountMinor',product_discount,'shippingDiscountMinor',shipping_discount,'totalDiscountMinor',candidate_discount);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'canCheckout',can_checkout,'blockingReason',blocking,'countryCode',country,'currency',product_row.currency,
    'productId',product_row.id,'productSlug',product_row.slug,'variantId',variant_row.id,'quantity',p_quantity,
    'subtotalMinor',subtotal,'shippingMinor',shipping,'discountMinor',discount,'totalMinor',greatest(0,subtotal+shipping-discount),
    'totalWeightGrams',total_weight,'shippingWeightGrams',shipping_weight,'missingWeightQuantity',missing_weight,
    'availableQuantity',available_quantity,'shipping',quote,'promotion',promotion,'previewOnly',true
  );
end;
$function$;

create or replace function public.preview_gift_checkout_v1(p_product_reference text,p_variant_reference text,p_quantity integer,p_country_code text,p_coupon_code text default null)
returns jsonb
language sql
stable
set search_path to ''
as $function$ select private.preview_gift_checkout_v1(p_product_reference,p_variant_reference,p_quantity,p_country_code,p_coupon_code); $function$;
revoke all on function public.preview_gift_checkout_v1(text,text,integer,text,text) from public, anon;
grant execute on function public.preview_gift_checkout_v1(text,text,integer,text,text) to authenticated;
