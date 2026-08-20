create table if not exists private.order_settlement_releases(
  order_id uuid primary key references public.orders(id) on delete restrict,
  status text not null default 'pending' check(status in('pending','processing','released','failed','blocked')),
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  provider text,
  last_error text check(last_error is null or char_length(last_error)<=500),
  provider_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(provider_snapshot)='object'),
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now())
);
create index if not exists order_settlement_releases_status_idx on private.order_settlement_releases(status,updated_at desc);
create index if not exists order_settlement_releases_requested_by_idx on private.order_settlement_releases(requested_by) where requested_by is not null;
create index if not exists order_settlement_releases_released_by_idx on private.order_settlement_releases(released_by) where released_by is not null;
revoke all on private.order_settlement_releases from public,anon,authenticated;
grant select,insert,update on private.order_settlement_releases to service_role;

alter table private.payment_item_splits add column if not exists approved_at timestamptz;
alter table private.payment_item_splits add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table private.payment_item_splits add column if not exists approval_provider_snapshot jsonb not null default '{}'::jsonb;
alter table private.payment_item_splits add column if not exists approval_error text;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='payment_item_splits_approval_provider_snapshot_check' and conrelid='private.payment_item_splits'::regclass) then
    alter table private.payment_item_splits add constraint payment_item_splits_approval_provider_snapshot_check check(jsonb_typeof(approval_provider_snapshot)='object');
  end if;
  if not exists(select 1 from pg_constraint where conname='payment_item_splits_approval_error_length_check' and conrelid='private.payment_item_splits'::regclass) then
    alter table private.payment_item_splits add constraint payment_item_splits_approval_error_length_check check(approval_error is null or char_length(approval_error)<=500);
  end if;
end $$;
create index if not exists payment_item_splits_approved_by_idx on private.payment_item_splits(approved_by) where approved_by is not null;

create or replace function private.is_super_admin_user_v1(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user_id is not null and exists(
    select 1 from private.user_roles ur join public.profiles p on p.id=ur.user_id
    where ur.user_id=p_user_id and ur.role='super_admin'
      and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
      and p.status='active' and p.deleted_at is null
      and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false)
  );
$$;
revoke all on function private.is_super_admin_user_v1(uuid) from public,anon,authenticated;
grant execute on function private.is_super_admin_user_v1(uuid) to service_role;

create or replace function private.order_settlement_state_v1(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  o public.orders%rowtype;
  rr private.order_settlement_releases%rowtype;
  sale_count bigint:=0; pending_sale_count bigint:=0; available_sale_count bigint:=0;
  pending_minor bigint:=0; available_minor bigint:=0;
  split_count bigint:=0; pending_split_count bigint:=0; approved_split_count bigint:=0; disapproved_split_count bigint:=0;
  open_return boolean:=false; refund_block boolean:=false;
  s text; reason text; eligible boolean:=false;
begin
  select * into o from public.orders where id=p_order_id;
  if o.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  select * into rr from private.order_settlement_releases where order_id=o.id;
  select count(*)::bigint,
         count(*) filter(where availability_status='pending')::bigint,
         count(*) filter(where availability_status='available')::bigint,
         coalesce(sum(producer_net_minor) filter(where availability_status='pending'),0)::bigint,
         coalesce(sum(producer_net_minor) filter(where availability_status='available'),0)::bigint
  into sale_count,pending_sale_count,available_sale_count,pending_minor,available_minor
  from private.producer_ledger_entries where order_id=o.id and entry_type='sale';
  select count(*)::bigint,
         count(*) filter(where approval_status='pending')::bigint,
         count(*) filter(where approval_status='approved')::bigint,
         count(*) filter(where approval_status='disapproved')::bigint
  into split_count,pending_split_count,approved_split_count,disapproved_split_count
  from private.payment_item_splits where order_id=o.id and order_item_id is not null;
  select exists(select 1 from public.return_requests r where r.order_id=o.id and r.status in('requested','under_review','approved','in_transit','received')) into open_return;
  select exists(select 1 from public.refunds rf where rf.order_id=o.id and rf.status not in('failed','cancelled')) into refund_block;

  if sale_count=0 and split_count=0 then s:='not_required'; reason:='no_seller_settlement';
  elsif rr.status='released' or (sale_count>0 and pending_sale_count=0 and split_count>0 and pending_split_count=0 and disapproved_split_count=0 and approved_split_count=split_count) then s:='released'; reason:='released';
  elsif o.status<>'completed' then s:='awaiting_completion'; reason:='order_not_completed';
  elsif o.payment_status<>'paid' then s:='blocked'; reason:='payment_not_fully_paid';
  elsif open_return then s:='blocked'; reason:='open_return';
  elsif refund_block then s:='blocked'; reason:='refund_or_refund_review';
  elsif sale_count=0 then s:='blocked'; reason:='seller_ledger_missing';
  elsif split_count=0 then s:='blocked'; reason:='payment_split_missing';
  elsif exists(select 1 from private.producer_ledger_entries le where le.order_id=o.id and le.entry_type='sale' and not exists(select 1 from private.payment_item_splits ps where ps.order_id=o.id and ps.order_item_id=le.order_item_id)) then s:='blocked'; reason:='ledger_split_mismatch';
  elsif disapproved_split_count>0 then s:='blocked'; reason:='provider_split_disapproved';
  elsif rr.status='processing' then s:='processing'; reason:='provider_approval_processing';
  elsif rr.status='failed' then s:='failed'; reason:='provider_approval_failed'; eligible:=true;
  else s:='pending_approval'; reason:='super_admin_approval_required'; eligible:=true;
  end if;

  return jsonb_build_object(
    'status',s,'reason',reason,'eligible',eligible,'currency',o.currency,
    'pendingSellerMinor',pending_minor,'availableSellerMinor',available_minor,
    'saleCount',sale_count,'pendingSaleCount',pending_sale_count,'availableSaleCount',available_sale_count,
    'splitCount',split_count,'pendingSplitCount',pending_split_count,'approvedSplitCount',approved_split_count,
    'hasOpenReturn',open_return,'hasRefundBlock',refund_block,
    'requestedAt',rr.requested_at,'releasedAt',rr.released_at,'lastError',rr.last_error
  );
end;
$$;
revoke all on function private.order_settlement_state_v1(uuid) from public,anon,authenticated;
grant execute on function private.order_settlement_state_v1(uuid) to service_role;

create or replace function private.release_completed_order_settlements_v1(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if o.status<>'completed' then raise exception 'settlement_order_not_completed' using errcode='55000'; end if;
  if o.payment_status<>'paid' then raise exception 'settlement_payment_not_paid' using errcode='55000'; end if;
  if exists(select 1 from public.return_requests r where r.order_id=o.id and r.status in('requested','under_review','approved','in_transit','received')) then raise exception 'settlement_open_return' using errcode='55000'; end if;
  if exists(select 1 from public.refunds rf where rf.order_id=o.id and rf.status not in('failed','cancelled')) then raise exception 'settlement_refund_block' using errcode='55000'; end if;
  if exists(
    select 1 from private.producer_ledger_entries le
    where le.order_id=o.id and le.entry_type='sale' and le.availability_status='pending'
      and not exists(select 1 from private.payment_item_splits ps where ps.order_id=o.id and ps.order_item_id=le.order_item_id and ps.approval_status='approved')
  ) then raise exception 'settlement_split_not_approved' using errcode='55000'; end if;
  update private.producer_ledger_entries
  set availability_status='available',available_at=coalesce(available_at,timezone('utc',now()))
  where order_id=o.id and entry_type='sale' and availability_status='pending';
end;
$$;

create or replace function private.sync_producer_finance_from_order_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.payment_status='paid' and old.payment_status is distinct from new.payment_status then
    perform private.record_order_producer_sales_v1(new.id);
  end if;
  return new;
end;
$$;

create or replace function private.prepare_order_settlement_for_service_v1(p_actor_user_id uuid,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; state jsonb; items jsonb; pending_count bigint:=0; provider_count bigint:=0;
begin
  if p_actor_user_id is null or p_order_id is null then raise exception 'settlement_context_required' using errcode='22023'; end if;
  if not private.is_super_admin_user_v1(p_actor_user_id) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  state:=private.order_settlement_state_v1(o.id);
  if state->>'status'='released' then return jsonb_build_object('action','terminal','released',true,'orderId',o.id,'orderNumber',o.order_number,'state',state); end if;
  if state->>'status' not in('pending_approval','failed','processing') then raise exception 'settlement_not_releasable:%',coalesce(state->>'reason','unknown') using errcode='55000'; end if;
  select count(distinct pr.provider)::bigint,
         count(*) filter(where ps.approval_status='pending')::bigint,
         coalesce(jsonb_agg(jsonb_build_object('paymentTransactionId',ps.provider_payment_transaction_id,'orderItemId',ps.order_item_id,'producerId',ps.producer_id,'provider',pr.provider) order by ps.id) filter(where ps.approval_status='pending'),'[]'::jsonb)
  into provider_count,pending_count,items
  from private.payment_item_splits ps join public.payment_records pr on pr.id=ps.payment_id
  where ps.order_id=o.id and ps.order_item_id is not null;
  if provider_count<>1 or exists(select 1 from private.payment_item_splits ps join public.payment_records pr on pr.id=ps.payment_id where ps.order_id=o.id and ps.order_item_id is not null and pr.provider<>'iyzico') then raise exception 'unsupported_settlement_provider' using errcode='55000'; end if;
  if pending_count=0 then
    perform private.release_completed_order_settlements_v1(o.id);
    insert into private.order_settlement_releases(order_id,status,requested_by,requested_at,released_by,released_at,provider,last_error,updated_at)
    values(o.id,'released',p_actor_user_id,timezone('utc',now()),p_actor_user_id,timezone('utc',now()),'iyzico',null,timezone('utc',now()))
    on conflict(order_id) do update set status='released',requested_by=coalesce(private.order_settlement_releases.requested_by,excluded.requested_by),requested_at=coalesce(private.order_settlement_releases.requested_at,excluded.requested_at),released_by=excluded.released_by,released_at=excluded.released_at,provider='iyzico',last_error=null,updated_at=excluded.updated_at;
    return jsonb_build_object('action','terminal','released',true,'orderId',o.id,'orderNumber',o.order_number,'state',private.order_settlement_state_v1(o.id));
  end if;
  insert into private.order_settlement_releases(order_id,status,requested_by,requested_at,provider,last_error,updated_at)
  values(o.id,'processing',p_actor_user_id,timezone('utc',now()),'iyzico',null,timezone('utc',now()))
  on conflict(order_id) do update set status='processing',requested_by=excluded.requested_by,requested_at=excluded.requested_at,provider='iyzico',last_error=null,updated_at=excluded.updated_at;
  return jsonb_build_object('action','approve','released',false,'orderId',o.id,'orderNumber',o.order_number,'currency',o.currency,'items',items,'state',private.order_settlement_state_v1(o.id));
end;
$$;

create or replace function private.complete_order_settlement_item_for_service_v1(p_actor_user_id uuid,p_order_id uuid,p_payment_transaction_id text,p_provider_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare split_row private.payment_item_splits%rowtype; o public.orders%rowtype; remaining bigint:=0; safe_payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb); producer_owner uuid;
begin
  if p_actor_user_id is null or p_order_id is null or nullif(btrim(coalesce(p_payment_transaction_id,'')),'') is null then raise exception 'settlement_context_required' using errcode='22023'; end if;
  if not private.is_super_admin_user_v1(p_actor_user_id) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if jsonb_typeof(safe_payload)<>'object' then raise exception 'invalid_provider_payload' using errcode='22023'; end if;
  if safe_payload->>'status'<>'success' or coalesce(safe_payload->>'paymentTransactionId','')<>btrim(p_payment_transaction_id) then raise exception 'provider_approval_not_verified' using errcode='55000'; end if;
  select ps.* into split_row from private.payment_item_splits ps where ps.order_id=p_order_id and ps.provider_payment_transaction_id=btrim(p_payment_transaction_id) and ps.order_item_id is not null for update;
  if split_row.id is null then raise exception 'payment_split_not_found' using errcode='P0002'; end if;
  if split_row.approval_status='disapproved' then raise exception 'payment_split_disapproved' using errcode='55000'; end if;
  if split_row.approval_status<>'approved' then
    update private.payment_item_splits set approval_status='approved',approved_at=timezone('utc',now()),approved_by=p_actor_user_id,approval_provider_snapshot=safe_payload,approval_error=null,updated_at=timezone('utc',now()) where id=split_row.id;
  end if;
  select count(*) into remaining from private.payment_item_splits where order_id=p_order_id and order_item_id is not null and approval_status<>'approved';
  if remaining=0 then
    perform private.release_completed_order_settlements_v1(p_order_id);
    select * into o from public.orders where id=p_order_id;
    update private.order_settlement_releases set status='released',released_by=p_actor_user_id,released_at=timezone('utc',now()),last_error=null,provider_snapshot=safe_payload,updated_at=timezone('utc',now()) where order_id=p_order_id;
    for producer_owner in select distinct p.owner_user_id from public.order_items oi join public.producers p on p.id=oi.producer_id where oi.order_id=p_order_id and p.owner_user_id is not null loop
      insert into public.notifications(user_id,type,title,message,action_url,metadata)
      values(producer_owner,'producer','Hakedişiniz serbest bırakıldı',coalesce(o.order_number,'Sipariş')||' siparişindeki hakedişiniz kullanılabilir bakiyeye geçti.','/account',jsonb_build_object('orderId',p_order_id,'settlementStatus','released'));
    end loop;
    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('order',p_order_id,'order.settlement_released',jsonb_build_object('order_id',p_order_id,'actor_user_id',p_actor_user_id));
  end if;
  return jsonb_build_object('ok',true,'orderId',p_order_id,'paymentTransactionId',btrim(p_payment_transaction_id),'remaining',remaining,'released',remaining=0,'state',private.order_settlement_state_v1(p_order_id));
end;
$$;

create or replace function private.fail_order_settlement_for_service_v1(p_actor_user_id uuid,p_order_id uuid,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare safe_error text:=left(nullif(btrim(coalesce(p_error,'')),''),500);
begin
  if p_actor_user_id is null or p_order_id is null then raise exception 'settlement_context_required' using errcode='22023'; end if;
  if not private.is_super_admin_user_v1(p_actor_user_id) then raise exception 'super_admin_required' using errcode='42501'; end if;
  insert into private.order_settlement_releases(order_id,status,requested_by,requested_at,provider,last_error,updated_at)
  values(p_order_id,'failed',p_actor_user_id,timezone('utc',now()),'iyzico',coalesce(safe_error,'provider_approval_failed'),timezone('utc',now()))
  on conflict(order_id) do update set status='failed',last_error=coalesce(safe_error,'provider_approval_failed'),updated_at=timezone('utc',now());
  return jsonb_build_object('ok',true,'orderId',p_order_id,'state',private.order_settlement_state_v1(p_order_id));
end;
$$;

create or replace function public.prepare_order_settlement_for_service_v1(p_actor_user_id uuid,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$begin if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if; return private.prepare_order_settlement_for_service_v1(p_actor_user_id,p_order_id); end;$$;
create or replace function public.complete_order_settlement_item_for_service_v1(p_actor_user_id uuid,p_order_id uuid,p_payment_transaction_id text,p_provider_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$begin if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if; return private.complete_order_settlement_item_for_service_v1(p_actor_user_id,p_order_id,p_payment_transaction_id,p_provider_payload); end;$$;
create or replace function public.fail_order_settlement_for_service_v1(p_actor_user_id uuid,p_order_id uuid,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$begin if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if; return private.fail_order_settlement_for_service_v1(p_actor_user_id,p_order_id,p_error); end;$$;
revoke all on function public.prepare_order_settlement_for_service_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_order_settlement_item_for_service_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.fail_order_settlement_for_service_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_order_settlement_for_service_v1(uuid,uuid) to service_role;
grant execute on function public.complete_order_settlement_item_for_service_v1(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.fail_order_settlement_for_service_v1(uuid,uuid,text) to service_role;

create or replace function private.management_orders_snapshot_v4()
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb; enriched jsonb; caller_is_admin boolean:=coalesce(private.is_admin(),false); caller_can_release boolean:=coalesce(private.has_role('super_admin'),false);
begin
  base:=private.management_orders_snapshot_v3();
  if not caller_is_admin then return base; end if;
  select coalesce(jsonb_agg(jsonb_set(row_item,'{settlement}',private.order_settlement_state_v1((row_item->>'id')::uuid)||jsonb_build_object('canRelease',caller_can_release),true) order by ordinality),'[]'::jsonb)
  into enriched from jsonb_array_elements(coalesce(base->'orders','[]'::jsonb)) with ordinality rows(row_item,ordinality);
  return jsonb_set(base,'{orders}',enriched,true);
end;
$$;
create or replace function public.management_orders_snapshot_v2() returns jsonb language sql set search_path='' as $$select private.management_orders_snapshot_v4();$$;
create or replace function public.management_orders_snapshot_v3() returns jsonb language sql set search_path='' as $$select private.management_orders_snapshot_v4();$$;
create or replace function public.management_orders_snapshot_v4() returns jsonb language sql set search_path='' as $$select private.management_orders_snapshot_v4();$$;
revoke all on function public.management_orders_snapshot_v4() from public,anon;
grant execute on function public.management_orders_snapshot_v4() to authenticated;
