-- Drift closure: customer account overview, producer finance summary per
-- currency, and the producer's own inventory listing.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.get_my_account_overview_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles p where p.id=caller_id and p.deleted_at is null) then raise exception 'profile_not_found' using errcode='P0002'; end if;
 update public.profiles set last_seen_at=timezone('utc',now()) where id=caller_id;
 select jsonb_build_object(
   'profile',jsonb_build_object(
     'id',p.id,'email',coalesce(auth.jwt()->>'email',''),'display_name',p.display_name,'phone',p.phone,'avatar_path',p.avatar_path,
     'locale',p.locale,'status',p.status,'marketing_consent',p.marketing_consent,'marketing_consent_at',p.marketing_consent_at,
     'created_at',p.created_at,'last_seen_at',timezone('utc',now())
   ),
   'roles',coalesce((select jsonb_agg(r.role order by r.role) from private.user_roles r where r.user_id=caller_id and (r.expires_at is null or r.expires_at>timezone('utc',now()))),'[]'::jsonb),
   'addresses',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'label',a.label,'recipient_name',a.recipient_name,'phone',a.phone,'country_code',a.country_code,
      'province',a.province,'district',a.district,'neighborhood',a.neighborhood,'address_line',a.address_line,
      'postal_code',a.postal_code,'delivery_notes',a.delivery_notes,'is_default',a.is_default,'updated_at',a.updated_at
   ) order by a.is_default desc,a.updated_at desc) from public.addresses a where a.user_id=caller_id and a.deleted_at is null),'[]'::jsonb),
   'summary',jsonb_build_object(
     'favorite_count',(select count(*) from public.favorites f where f.user_id=caller_id),
     'address_count',(select count(*) from public.addresses a where a.user_id=caller_id and a.deleted_at is null),
     'order_count',(select count(*) from public.orders o where o.user_id=caller_id),
     'active_order_count',(select count(*) from public.orders o where o.user_id=caller_id and o.status in ('pending_payment','confirmed','preparing','partially_shipped','shipped','delivered')),
     'return_count',(select count(*) from public.return_requests r where r.user_id=caller_id),
     'gift_count',(select count(*) from private.order_gifts g where g.user_id=caller_id),
     'followed_producer_count',(select count(*) from private.producer_follows f where f.user_id=caller_id),
     'unread_notification_count',(select count(*) from public.notifications n where n.user_id=caller_id and n.read_at is null and (n.expires_at is null or n.expires_at>timezone('utc',now())))
   ),
   'recent_orders',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'order_number',o.order_number,'status',o.status,'payment_status',o.payment_status,'fulfillment_status',o.fulfillment_status,
      'currency',o.currency,'total_minor',o.total_minor,'placed_at',o.placed_at,'created_at',o.created_at,
      'gift',exists(select 1 from private.order_gifts g where g.order_id=o.id)
   ) order by o.created_at desc) from (select * from public.orders where user_id=caller_id order by created_at desc limit 5) o),'[]'::jsonb),
   'producer',(select jsonb_build_object('id',pr.id,'display_name',pr.display_name,'status',pr.status,'is_verified',pr.is_verified,'origin_verified',pr.origin_verified,'village',pr.production_village,'district',pr.production_district,'province',pr.production_province) from public.producers pr where pr.owner_user_id=caller_id and pr.deleted_at is null order by pr.created_at desc limit 1),
   'account_closure',(select jsonb_build_object('id',c.id,'status',c.status,'reason',c.reason,'requested_at',c.requested_at,'updated_at',c.updated_at) from private.account_closure_requests c where c.user_id=caller_id order by c.requested_at desc limit 1)
 ) into result from public.profiles p where p.id=caller_id;
 return result;
end; $function$
;

CREATE OR REPLACE FUNCTION private.get_my_producer_finance_summary_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  producer_row public.producers%rowtype;
  summaries jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if; if not private.has_permission('finance.read') then raise exception 'permission_required:finance.read' using errcode='42501'; end if;
  select * into producer_row from public.producers producer
  where producer.owner_user_id=caller_id and producer.deleted_at is null
  order by producer.created_at desc limit 1;
  if producer_row.id is null then raise exception 'producer_profile_required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(private.get_producer_balance_v1(producer_row.id,currency_code) order by currency_code),'[]'::jsonb)
  into summaries
  from (
    select distinct currency as currency_code from private.producer_ledger_entries where producer_id=producer_row.id
    union
    select distinct currency as currency_code from private.producer_payouts where producer_id=producer_row.id
  ) currencies;

  return jsonb_build_object(
    'producerId',producer_row.id,
    'displayName',producer_row.display_name,
    'commissionBasisPoints',producer_row.commission_basis_points,
    'balances',summaries
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.list_my_producer_inventory_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); producer_id_value uuid; result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select producer.id into producer_id_value from public.producers producer where producer.owner_user_id=caller_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null limit 1;
  if producer_id_value is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'productId',product.id,'productName',product.name,'productStatus',product.status,'stockMode',product.stock_mode,
    'variantId',variant.id,'variantName',variant.name,'sku',variant.sku,'priceMinor',variant.price_minor,'currency',product.currency,
    'availableQuantity',coalesce(inventory.available_quantity,0),'reservedQuantity',coalesce(inventory.reserved_quantity,0),
    'sellableQuantity',case when inventory.variant_id is null then 0 else greatest(0,inventory.available_quantity-inventory.reserved_quantity) end,
    'reorderLevel',coalesce(inventory.reorder_level,0),'version',coalesce(inventory.version,1),'weightGrams',variant.weight_grams
  ) order by product.name,variant.is_default desc,variant.name),'[]'::jsonb)
  into result
  from public.products product
  join public.product_variants variant on variant.product_id=product.id and variant.is_active=true
  left join public.product_inventory inventory on inventory.variant_id=variant.id
  where product.producer_id=producer_id_value and product.deleted_at is null and product.status<>'archived';
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_account_overview_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.get_my_account_overview_v1();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_producer_finance_summary_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.get_my_producer_finance_summary_v1(); $function$
;

CREATE OR REPLACE FUNCTION public.list_my_producer_inventory_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.list_my_producer_inventory_v1(); $function$
;
