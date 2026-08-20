create or replace function private.admin_operations_overview_v2()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not coalesce(private.is_admin(),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'generated_at',timezone('utc',now()),
    'counts',jsonb_build_object(
      'members_total',(select count(*) from public.profiles p where p.deleted_at is null),
      'members_active',(select count(*) from public.profiles p where p.status='active' and p.deleted_at is null),
      'customers_active',(
        select count(*) from public.profiles p
        where p.status='active' and p.deleted_at is null
          and not exists(
            select 1 from private.user_roles ur
            where ur.user_id=p.id
              and ur.role in('producer','support','content_editor','operations','admin','super_admin')
              and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
          )
      ),
      'staff_users',(
        select count(distinct ur.user_id)
        from private.user_roles ur
        join public.profiles p on p.id=ur.user_id
        where ur.role in('support','content_editor','operations','admin','super_admin')
          and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
          and p.status='active' and p.deleted_at is null
      ),
      'producer_role_users',(
        select count(distinct ur.user_id)
        from private.user_roles ur
        join public.profiles p on p.id=ur.user_id
        where ur.role='producer'
          and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
          and p.status='active' and p.deleted_at is null
      ),
      'categories_total',(select count(*) from public.categories),
      'categories_active',(select count(*) from public.categories where is_active=true),
      'products_total',(select count(*) from public.products where deleted_at is null),
      'products_published',(select count(*) from public.products where status='published' and is_active=true and deleted_at is null),
      'producers_total',(select count(*) from public.producers where deleted_at is null),
      'verified_producers',(select count(*) from public.producers where status='active' and is_verified=true and deleted_at is null),
      'orders_total',(select count(*) from public.orders),
      'open_orders',(select count(*) from public.orders where status in('pending_payment','confirmed','preparing','partially_shipped','shipped','delivered')),
      'producer_applications',(select count(*) from public.producer_applications where status in('submitted','under_review','needs_information')),
      'product_reviews',(select count(*) from public.products where status='review' and deleted_at is null),
      'product_change_requests',(select count(*) from public.product_change_requests where status='pending'),
      'return_requests',(select count(*) from public.return_requests where status in('requested','under_review','approved','in_transit','received')),
      'review_moderation',(select count(*) from public.reviews where status='pending'),
      'support_conversations',(select count(*) from public.conversations where conversation_type='support' and status<>'closed'),
      'account_closures',(select count(*) from private.account_closure_requests where status in('requested','processing','ready_for_auth_deletion')),
      'producer_payouts',(select count(*) from private.producer_payouts where status in('scheduled','processing')),
      'settlements_waiting',(
        select count(distinct le.order_id)
        from private.producer_ledger_entries le
        join public.orders o on o.id=le.order_id
        where le.entry_type='sale' and le.availability_status='pending'
          and o.status='completed' and o.payment_status='paid'
      ),
      'catalog_objects',(select count(*) from storage.objects where bucket_id='catalog-public'),
      'content_objects',(select count(*) from storage.objects where bucket_id='content-public'),
      'certificate_objects',(select count(*) from storage.objects where bucket_id='product-certificates')
    ),
    'finance_by_currency',coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency',c.currency,
        'captured_minor',coalesce(py.captured_minor,0),
        'refunded_minor',coalesce(rf.refunded_minor,0),
        'net_collected_minor',coalesce(py.captured_minor,0)-coalesce(rf.refunded_minor,0),
        'protected_pool_minor',coalesce(pl.protected_pool_minor,0),
        'approved_seller_minor',coalesce(pl.approved_seller_minor,0),
        'seller_pending_ledger_minor',coalesce(le.pending_minor,0),
        'seller_available_ledger_minor',coalesce(le.available_minor,0),
        'seller_paid_out_minor',coalesce(po.paid_minor,0)
      ) order by c.currency)
      from (
        select currency from public.payment_records
        union select currency from public.refunds
        union select currency from private.producer_ledger_entries
        union select currency from private.producer_payouts
      ) c
      left join (
        select currency,sum(amount_minor)::bigint captured_minor
        from public.payment_records
        where status in('captured','partially_refunded','refunded')
        group by currency
      ) py using(currency)
      left join (
        select currency,sum(amount_minor)::bigint refunded_minor
        from public.refunds where status='succeeded'
        group by currency
      ) rf using(currency)
      left join (
        select pr.currency,
          coalesce(sum(ps.submerchant_price_minor) filter(where ps.approval_status='pending'),0)::bigint protected_pool_minor,
          coalesce(sum(ps.submerchant_price_minor) filter(where ps.approval_status='approved'),0)::bigint approved_seller_minor
        from private.payment_item_splits ps
        join public.payment_records pr on pr.id=ps.payment_id
        where ps.order_id is not null
        group by pr.currency
      ) pl using(currency)
      left join (
        select currency,
          coalesce(sum(producer_net_minor) filter(where availability_status='pending'),0)::bigint pending_minor,
          coalesce(sum(producer_net_minor) filter(where availability_status='available'),0)::bigint available_minor
        from private.producer_ledger_entries
        where entry_type='sale'
        group by currency
      ) le using(currency)
      left join (
        select currency,coalesce(sum(amount_minor),0)::bigint paid_minor
        from private.producer_payouts where status='paid'
        group by currency
      ) po using(currency)
    ),'[]'::jsonb),
    'recent_orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',q.id,'order_number',q.order_number,'status',q.status,
        'payment_status',q.payment_status,'fulfillment_status',q.fulfillment_status,
        'currency',q.currency,'total_minor',q.total_minor,
        'placed_at',q.placed_at,'created_at',q.created_at
      ) order by q.created_at desc)
      from (
        select id,order_number,status,payment_status,fulfillment_status,currency,total_minor,placed_at,created_at
        from public.orders where accounting_archived_at is null
        order by created_at desc limit 10
      ) q
    ),'[]'::jsonb),
    'queues',jsonb_build_object(
      'producer_applications',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',a.id,'public_name',a.public_name,'status',a.status,'submitted_at',a.submitted_at,
          'village',a.production_village,'district',a.production_district,'province',a.production_province
        ) order by coalesce(a.submitted_at,a.created_at))
        from (
          select * from public.producer_applications
          where status in('submitted','under_review','needs_information')
          order by coalesce(submitted_at,created_at) asc limit 10
        ) a
      ),'[]'::jsonb),
      'products',coalesce((
        select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'producer_id',p.producer_id,'status',p.status,'updated_at',p.updated_at) order by p.updated_at)
        from (select * from public.products where status='review' and deleted_at is null order by updated_at asc limit 10) p
      ),'[]'::jsonb),
      'returns',coalesce((
        select jsonb_agg(jsonb_build_object('id',r.id,'return_number',r.return_number,'order_id',r.order_id,'status',r.status,'reason_code',r.reason_code,'requested_at',r.requested_at) order by r.requested_at)
        from (select * from public.return_requests where status in('requested','under_review','approved','in_transit','received') order by requested_at asc limit 10) r
      ),'[]'::jsonb),
      'reviews',coalesce((
        select jsonb_agg(jsonb_build_object('id',r.id,'product_id',r.product_id,'rating',r.rating,'title',r.title,'created_at',r.created_at) order by r.created_at)
        from (select * from public.reviews where status='pending' order by created_at asc limit 10) r
      ),'[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_operations_overview_v2()
returns jsonb
language sql
security definer
set search_path=''
as $$select private.admin_operations_overview_v2();$$;

revoke all on function public.admin_operations_overview_v2() from public,anon;
grant execute on function public.admin_operations_overview_v2() to authenticated;
