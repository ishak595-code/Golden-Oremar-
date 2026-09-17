-- Drift closure: admin producer directory, producer balance report, returns
-- queue, and the operations overview dashboard (counts across users, producers,
-- catalog, orders and every moderation queue, finance totals per currency,
-- recent orders, and the four work queues).
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_list_producer_balances_v1(p_currency text DEFAULT 'TRY'::text)
 RETURNS TABLE(producer_id uuid, display_name text, commission_basis_points integer, currency text, pending_minor bigint, available_to_payout_minor bigint, paid_payout_minor bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  currency_code text:=upper(btrim(coalesce(p_currency,'TRY')));
begin
  if auth.uid() is null or not coalesce(private.has_permission('finance.read'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if currency_code !~ '^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
  return query
  select producer.id,producer.display_name,producer.commission_basis_points,currency_code,
         ((private.get_producer_balance_v1(producer.id,currency_code))->>'pendingMinor')::bigint,
         ((private.get_producer_balance_v1(producer.id,currency_code))->>'availableToPayoutMinor')::bigint,
         ((private.get_producer_balance_v1(producer.id,currency_code))->>'paidPayoutMinor')::bigint
  from public.producers producer
  where producer.deleted_at is null
  order by producer.display_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_list_producers_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.has_permission('seller.read') then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', producer.id,
        'owner_user_id', producer.owner_user_id,
        'application_id', producer.application_id,
        'slug', producer.slug,
        'display_name', producer.display_name,
        'description', producer.description,
        'production_location', producer.production_location,
        'production_country_code', producer.production_country_code,
        'production_province', producer.production_province,
        'production_district', producer.production_district,
        'production_village', producer.production_village,
        'production_village_is_custom', producer.production_village_is_custom,
        'logo_path', producer.logo_path,
        'status', producer.status,
        'is_verified', producer.is_verified,
        'verified_at', producer.verified_at,
        'verification_due_at', producer.verification_due_at,
        'origin_verified', producer.origin_verified,
        'origin_verified_at', producer.origin_verified_at,
        'origin_verification_basis', producer.origin_verification_basis,
        'commission_basis_points', producer.commission_basis_points,
        'rating_average', producer.rating_average,
        'rating_count', producer.rating_count,
        'email', account.email,
        'phone', profile.phone,
        'created_at', producer.created_at,
        'product_count', (
          select count(*)
          from public.products product
          where product.producer_id = producer.id
            and product.deleted_at is null
        ),
        'order_count', (
          select count(distinct item.order_id)
          from public.order_items item
          where item.producer_id = producer.id
        ),
        'follower_count', (
          select count(*)
          from private.producer_follows follow_row
          where follow_row.producer_id = producer.id
        )
      )
      order by producer.created_at desc
    )
    from public.producers producer
    join public.profiles profile on profile.id = producer.owner_user_id
    join auth.users account on account.id = producer.owner_user_id
    where producer.deleted_at is null
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_list_returns_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.has_permission('refund.read') then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', request.id,
      'return_number', request.return_number,
      'order_id', request.order_id,
      'order_number', customer_order.order_number,
      'customer_name', coalesce(nullif(profile.display_name,''), 'Müşteri'),
      'customer_phone', profile.phone,
      'status', request.status,
      'reason_code', request.reason_code,
      'customer_message', request.customer_message,
      'resolution', request.resolution,
      'resolution_note', request.resolution_note,
      'review_reason', request.review_reason,
      'restock_approved', request.restock_approved,
      'requested_at', request.requested_at,
      'reviewed_at', request.reviewed_at,
      'received_at', request.received_at,
      'closed_at', request.closed_at,
      'currency', customer_order.currency,
      'order_total_minor', customer_order.total_minor,
      'item_count', (select count(*) from public.return_items item where item.return_id = request.id),
      'requested_quantity', coalesce((select sum(item.quantity) from public.return_items item where item.return_id = request.id),0),
      'requested_refund_minor', coalesce((select sum(item.refund_amount_minor) from public.return_items item where item.return_id = request.id),0),
      'succeeded_refund_minor', coalesce((select sum(refund.amount_minor) from public.refunds refund where refund.return_id = request.id and refund.status='succeeded'),0)
    ) order by request.requested_at desc)
    from public.return_requests request
    join public.orders customer_order on customer_order.id=request.order_id
    left join public.profiles profile on profile.id=request.user_id
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_operations_overview_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  if not coalesce(private.has_permission('analytics.read'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'counts', jsonb_build_object(
      'active_users', (select count(*) from public.profiles p where p.status = 'active' and p.deleted_at is null),
      'verified_producers', (select count(*) from public.producers p where p.status = 'active' and p.is_verified = true and p.deleted_at is null),
      'published_products', (select count(*) from public.products p where p.status = 'published' and p.is_active = true and p.deleted_at is null),
      'open_orders', (select count(*) from public.orders o where o.status in ('pending_payment','confirmed','preparing','partially_shipped','shipped','delivered')),
      'producer_applications', (select count(*) from public.producer_applications a where a.status in ('submitted','under_review','needs_information')),
      'product_reviews', (select count(*) from public.products p where p.status = 'review' and p.deleted_at is null),
      'product_change_requests', (select count(*) from public.product_change_requests r where r.status = 'pending'),
      'return_requests', (select count(*) from public.return_requests r where r.status in ('requested','under_review','approved','in_transit','received')),
      'review_moderation', (select count(*) from public.reviews r where r.status = 'pending'),
      'support_conversations', (select count(*) from public.conversations c where c.conversation_type = 'support' and c.status <> 'closed'),
      'account_closures', (select count(*) from private.account_closure_requests r where r.status in ('requested','processing','ready_for_auth_deletion')),
      'producer_payouts', (select count(*) from private.producer_payouts p where p.status in ('scheduled','processing'))
    ),
    'finance_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', x.currency,
        'captured_minor', x.captured_minor,
        'refunded_minor', x.refunded_minor,
        'net_collected_minor', x.captured_minor - x.refunded_minor
      ) order by x.currency)
      from (
        select currency,
          sum(captured_minor)::bigint as captured_minor,
          sum(refunded_minor)::bigint as refunded_minor
        from (
          select pr.currency, sum(pr.amount_minor)::bigint as captured_minor, 0::bigint as refunded_minor
          from public.payment_records pr
          where pr.status in ('captured','partially_refunded','refunded')
          group by pr.currency
          union all
          select rf.currency, 0::bigint, sum(rf.amount_minor)::bigint
          from public.refunds rf
          where rf.status = 'succeeded'
          group by rf.currency
        ) totals
        group by currency
      ) x
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'order_number', q.order_number,
        'status', q.status,
        'payment_status', q.payment_status,
        'fulfillment_status', q.fulfillment_status,
        'currency', q.currency,
        'total_minor', q.total_minor,
        'placed_at', q.placed_at,
        'created_at', q.created_at
      ) order by q.created_at desc)
      from (
        select o.id,o.order_number,o.status,o.payment_status,o.fulfillment_status,o.currency,o.total_minor,o.placed_at,o.created_at
        from public.orders o
        order by o.created_at desc
        limit 10
      ) q
    ), '[]'::jsonb),
    'queues', jsonb_build_object(
      'producer_applications', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'public_name',a.public_name,'status',a.status,'submitted_at',a.submitted_at,'village',a.production_village,'district',a.production_district,'province',a.production_province) order by coalesce(a.submitted_at,a.created_at)) from (select * from public.producer_applications where status in ('submitted','under_review','needs_information') order by coalesce(submitted_at,created_at) asc limit 10) a), '[]'::jsonb),
      'products', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'producer_id',p.producer_id,'status',p.status,'updated_at',p.updated_at) order by p.updated_at) from (select * from public.products where status='review' and deleted_at is null order by updated_at asc limit 10) p), '[]'::jsonb),
      'returns', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'return_number',r.return_number,'order_id',r.order_id,'status',r.status,'reason_code',r.reason_code,'requested_at',r.requested_at) order by r.requested_at) from (select * from public.return_requests where status in ('requested','under_review','approved','in_transit','received') order by requested_at asc limit 10) r), '[]'::jsonb),
      'reviews', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'product_id',r.product_id,'rating',r.rating,'title',r.title,'created_at',r.created_at) order by r.created_at) from (select * from public.reviews where status='pending' order by created_at asc limit 10) r), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_producer_balances_v1(p_currency text DEFAULT 'TRY'::text)
 RETURNS TABLE(producer_id uuid, display_name text, commission_basis_points integer, currency text, pending_minor bigint, available_to_payout_minor bigint, paid_payout_minor bigint)
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from private.admin_list_producer_balances_v1(p_currency); $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_returns_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.admin_list_returns_v1();
$function$
;
