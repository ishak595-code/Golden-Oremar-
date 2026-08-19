alter table private.account_enforcement_events drop constraint if exists account_enforcement_events_action_check;
alter table private.account_enforcement_events add constraint account_enforcement_events_action_check check (action=any(array['blocked','unblocked','closed','reopened','anonymized','ip_blocked','device_blocked','rule_revoked','fraud_flagged']::text[]));

create or replace function private.super_admin_reopen_closed_user_v1(p_user_id uuid,p_reason text,p_restore_producer boolean default false)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); reason_value text:=btrim(coalesce(p_reason,'')); profile_row public.profiles%rowtype; producer_row public.producers%rowtype;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_user_id=caller_id then raise exception 'cannot_reopen_current_user' using errcode='42501'; end if;
 if char_length(reason_value) not between 8 and 1000 then raise exception 'reopen_reason_required' using errcode='22023'; end if;
 select * into profile_row from public.profiles where id=p_user_id for update;
 if profile_row.id is null then raise exception 'user_not_found' using errcode='P0002'; end if;
 if profile_row.status<>'deleted' then raise exception 'account_not_closed' using errcode='55000'; end if;
 if (select email from auth.users where id=p_user_id) like 'deleted+%@invalid.local' then raise exception 'anonymized_account_cannot_be_reopened' using errcode='55000'; end if;
 update public.profiles set status='active',deleted_at=null,updated_at=timezone('utc',now()) where id=p_user_id;
 insert into private.user_roles(user_id,role,granted_by) values(p_user_id,'customer',caller_id) on conflict(user_id,role) do update set expires_at=null,granted_by=excluded.granted_by,granted_at=timezone('utc',now());
 update private.security_block_rules set active=false,revoked_by=caller_id,revoked_at=timezone('utc',now()) where source_user_id=p_user_id and active=true;
 update private.device_push_tokens set disabled_at=null,updated_at=timezone('utc',now()) where user_id=p_user_id;
 select * into producer_row from public.producers where owner_user_id=p_user_id and deleted_at is null order by created_at desc limit 1;
 if producer_row.id is not null and p_restore_producer then
   update public.producers set status='active',updated_at=timezone('utc',now()) where id=producer_row.id;
   insert into private.user_roles(user_id,role,granted_by) values(p_user_id,'producer',caller_id) on conflict(user_id,role) do update set expires_at=null,granted_by=excluded.granted_by,granted_at=timezone('utc',now());
 end if;
 insert into private.account_enforcement_events(user_id,actor_user_id,action,reason,metadata) values(p_user_id,caller_id,'reopened',reason_value,jsonb_build_object('producerRestored',p_restore_producer and producer_row.id is not null,'producerRequiresTrustReview',producer_row.id is not null));
 return jsonb_build_object('id',p_user_id,'status','active','producerStatus',case when producer_row.id is null then null when p_restore_producer then 'active' else producer_row.status end,'producerRestored',p_restore_producer and producer_row.id is not null);
end;
$function$;
create or replace function public.super_admin_reopen_closed_user_v1(p_user_id uuid,p_reason text,p_restore_producer boolean default false)
returns jsonb language sql set search_path='' as $function$select private.super_admin_reopen_closed_user_v1(p_user_id,p_reason,p_restore_producer);$function$;
revoke all on function public.super_admin_reopen_closed_user_v1(uuid,text,boolean) from public,anon;
grant execute on function public.super_admin_reopen_closed_user_v1(uuid,text,boolean) to authenticated;

create table if not exists private.system_error_daily(
 id uuid primary key default gen_random_uuid(),
 event_day date not null default timezone('utc',now())::date,
 fingerprint text not null,
 severity text not null default 'error' check(severity in('warning','error','fatal')),
 source text not null check(char_length(source) between 2 and 80),
 message text not null check(char_length(message) between 1 and 2000),
 sample_stack text,
 route text,
 occurrence_count bigint not null default 1 check(occurrence_count>0),
 first_seen_at timestamptz not null default timezone('utc',now()),
 last_seen_at timestamptz not null default timezone('utc',now()),
 last_user_id uuid references auth.users(id) on delete set null,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 unique(event_day,fingerprint)
);
create index if not exists system_error_daily_last_seen_idx on private.system_error_daily(last_seen_at desc);

create or replace function private.report_client_error_v1(p_source text,p_message text,p_stack text default null,p_route text default null,p_severity text default 'error',p_metadata jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare source_value text:=btrim(coalesce(p_source,'')); message_value text:=btrim(coalesce(p_message,'')); stack_value text:=left(nullif(btrim(coalesce(p_stack,'')),''),12000); route_value text:=left(nullif(btrim(coalesce(p_route,'')),''),500); severity_value text:=lower(btrim(coalesce(p_severity,'error'))); metadata_value jsonb:=coalesce(p_metadata,'{}'::jsonb); fingerprint_value text;
begin
 if char_length(source_value) not between 2 and 80 or char_length(message_value) not between 1 and 2000 then return false; end if;
 if severity_value not in('warning','error','fatal') then severity_value:='error'; end if;
 if jsonb_typeof(metadata_value)<>'object' or length(metadata_value::text)>16000 then metadata_value:='{}'::jsonb; end if;
 fingerprint_value:=md5(source_value||'|'||message_value||'|'||coalesce(left(stack_value,2000),''));
 insert into private.system_error_daily(event_day,fingerprint,severity,source,message,sample_stack,route,last_user_id,metadata)
 values(timezone('utc',now())::date,fingerprint_value,severity_value,source_value,message_value,stack_value,route_value,auth.uid(),metadata_value)
 on conflict(event_day,fingerprint) do update set occurrence_count=private.system_error_daily.occurrence_count+1,last_seen_at=timezone('utc',now()),last_user_id=auth.uid(),route=coalesce(excluded.route,private.system_error_daily.route),metadata=excluded.metadata;
 return true;
end;
$function$;
create or replace function public.report_client_error_v1(p_source text,p_message text,p_stack text default null,p_route text default null,p_severity text default 'error',p_metadata jsonb default '{}'::jsonb)
returns boolean language sql set search_path='' as $function$select private.report_client_error_v1(p_source,p_message,p_stack,p_route,p_severity,p_metadata);$function$;
grant execute on function public.report_client_error_v1(text,text,text,text,text,jsonb) to anon,authenticated;

create or replace function private.admin_list_system_errors_v1(p_from date,p_to date)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
 if auth.uid() is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>90 then raise exception 'invalid_error_date_range' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'day',e.event_day,'fingerprint',e.fingerprint,'severity',e.severity,'source',e.source,'message',e.message,'stack',e.sample_stack,'route',e.route,'count',e.occurrence_count,'firstSeenAt',e.first_seen_at,'lastSeenAt',e.last_seen_at) order by e.last_seen_at desc) from private.system_error_daily e where e.event_day between p_from and p_to),'[]'::jsonb);
end;
$function$;
create or replace function public.admin_list_system_errors_v1(p_from date,p_to date)
returns jsonb language sql set search_path='' as $function$select private.admin_list_system_errors_v1(p_from,p_to);$function$;
revoke all on function public.admin_list_system_errors_v1(date,date) from public,anon;
grant execute on function public.admin_list_system_errors_v1(date,date) to authenticated;

create table if not exists private.accounting_periods(
 id uuid primary key default gen_random_uuid(),
 period_from date not null,
 period_to date not null,
 currency text not null check(currency~'^[A-Z]{3}$'),
 status text not null default 'closed' check(status in('closed','archived')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 closed_by uuid references auth.users(id) on delete set null,
 closed_at timestamptz not null default timezone('utc',now()),
 archived_at timestamptz,
 cleanup_completed_at timestamptz,
 check(period_to>=period_from),
 unique(period_from,period_to,currency)
);
alter table public.orders add column if not exists accounting_archived_at timestamptz;
alter table public.orders add column if not exists accounting_period_id uuid references private.accounting_periods(id) on delete set null;
create index if not exists orders_accounting_active_idx on public.orders(accounting_archived_at,created_at desc);

create or replace function private.admin_finance_report_v2(p_from date,p_to date,p_currency text default 'TRY')
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $function$
declare currency_value text:=upper(btrim(coalesce(p_currency,''))); result jsonb;
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'invalid_finance_date_range' using errcode='22023'; end if;
 if currency_value!~'^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
 with date_series as(select day::date report_date from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') day),
 daily_orders as(select timezone('utc',coalesce(o.placed_at,o.created_at))::date report_date,count(*)::integer order_count,sum(o.total_minor)::bigint gross_sales_minor from public.orders o where timezone('utc',coalesce(o.placed_at,o.created_at))::date between p_from and p_to and o.currency=currency_value and o.payment_status in('paid','partially_refunded','refunded') and o.status<>'cancelled' group by 1),
 daily_refunds as(select timezone('utc',r.created_at)::date report_date,sum(r.amount_minor)::bigint refund_minor from public.refunds r where timezone('utc',r.created_at)::date between p_from and p_to and r.currency=currency_value and r.status='succeeded' group by 1),
 daily as(select d.report_date,coalesce(o.order_count,0) order_count,coalesce(o.gross_sales_minor,0) gross_sales_minor,coalesce(r.refund_minor,0) refund_minor,coalesce(o.gross_sales_minor,0)-coalesce(r.refund_minor,0) net_sales_minor from date_series d left join daily_orders o using(report_date) left join daily_refunds r using(report_date)),
 ledger as(select l.producer_id,count(distinct l.order_id)::integer order_count,sum(l.producer_gross_minor)::bigint producer_gross_minor,sum(l.platform_fee_minor)::bigint commission_minor,sum(l.producer_net_minor)::bigint producer_net_minor from private.producer_ledger_entries l where timezone('utc',l.created_at)::date between p_from and p_to and l.currency=currency_value group by l.producer_id),
 vendor_income as(select l.producer_id,p.display_name vendor_name,l.order_count,l.producer_gross_minor gross_sales_minor,l.commission_minor,l.producer_net_minor estimated_payout_minor from ledger l join public.producers p on p.id=l.producer_id),
 payouts as(select coalesce(sum(amount_minor) filter(where status='paid'),0)::bigint paid_payout_minor,coalesce(sum(amount_minor) filter(where status in('scheduled','processing')),0)::bigint pending_payout_minor from private.producer_payouts where currency=currency_value and timezone('utc',coalesce(processed_at,scheduled_at,created_at))::date between p_from and p_to),
 payments as(select coalesce(sum(amount_minor) filter(where status in('captured','partially_refunded','refunded')),0)::bigint captured_minor from public.payment_records where currency=currency_value and timezone('utc',coalesce(captured_at,created_at))::date between p_from and p_to)
 select jsonb_build_object('currency',currency_value,'from',p_from,'to',p_to,'totals',jsonb_build_object('order_count',coalesce((select sum(order_count) from daily),0),'gross_sales_minor',coalesce((select sum(gross_sales_minor) from daily),0),'refund_minor',coalesce((select sum(refund_minor) from daily),0),'net_sales_minor',coalesce((select sum(net_sales_minor) from daily),0),'commission_minor',coalesce((select sum(commission_minor) from ledger),0),'estimated_payout_minor',coalesce((select sum(producer_net_minor) from ledger),0),'producer_gross_minor',coalesce((select sum(producer_gross_minor) from ledger),0),'paid_payout_minor',(select paid_payout_minor from payouts),'pending_payout_minor',(select pending_payout_minor from payouts),'captured_payment_minor',(select captured_minor from payments),'reconciliation_delta_minor',(select captured_minor from payments)-coalesce((select sum(gross_sales_minor) from daily),0)),'daily_sales',coalesce((select jsonb_agg(jsonb_build_object('date',report_date,'order_count',order_count,'gross_sales_minor',gross_sales_minor,'refund_minor',refund_minor,'net_sales_minor',net_sales_minor) order by report_date) from daily),'[]'::jsonb),'vendor_income',coalesce((select jsonb_agg(jsonb_build_object('producer_id',producer_id,'vendor_name',vendor_name,'order_count',order_count,'gross_sales_minor',gross_sales_minor,'commission_minor',commission_minor,'estimated_payout_minor',estimated_payout_minor) order by gross_sales_minor desc,vendor_name) from vendor_income),'[]'::jsonb),'available_currencies',coalesce((select jsonb_agg(currency order by currency) from(select distinct currency from public.orders union select distinct currency from private.producer_ledger_entries union select distinct currency from private.producer_payouts) c),'[]'::jsonb)) into result;
 return result;
end;
$function$;
create or replace function public.admin_finance_report_v2(p_from date,p_to date,p_currency text default 'TRY') returns jsonb language sql set search_path='' as $function$select private.admin_finance_report_v2(p_from,p_to,p_currency);$function$;
revoke all on function public.admin_finance_report_v2(date,date,text) from public,anon;
grant execute on function public.admin_finance_report_v2(date,date,text) to authenticated;

create or replace function private.super_admin_close_accounting_period_v1(p_from date,p_to date,p_currency text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); currency_value text:=upper(btrim(coalesce(p_currency,''))); snapshot_value jsonb; period_id uuid; archived_count integer;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'invalid_finance_date_range' using errcode='22023'; end if;
 if currency_value!~'^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
 if exists(select 1 from private.accounting_periods ap where ap.currency=currency_value and daterange(ap.period_from,ap.period_to,'[]') && daterange(p_from,p_to,'[]')) then raise exception 'accounting_period_overlap' using errcode='23505'; end if;
 if exists(select 1 from public.orders o where o.currency=currency_value and timezone('utc',coalesce(o.placed_at,o.created_at))::date between p_from and p_to and o.status not in('completed','cancelled','refunded')) then raise exception 'open_orders_prevent_period_close' using errcode='55000'; end if;
 if exists(select 1 from public.return_requests rr join public.orders o on o.id=rr.order_id where o.currency=currency_value and timezone('utc',coalesce(o.placed_at,o.created_at))::date between p_from and p_to and rr.status not in('rejected','refunded','closed')) then raise exception 'open_returns_prevent_period_close' using errcode='55000'; end if;
 snapshot_value:=private.admin_finance_report_v2(p_from,p_to,currency_value);
 insert into private.accounting_periods(period_from,period_to,currency,snapshot,closed_by) values(p_from,p_to,currency_value,snapshot_value,caller_id) returning id into period_id;
 update public.orders set accounting_archived_at=timezone('utc',now()),accounting_period_id=period_id where currency=currency_value and timezone('utc',coalesce(placed_at,created_at))::date between p_from and p_to and status in('completed','cancelled','refunded');
 get diagnostics archived_count=row_count;
 return jsonb_build_object('id',period_id,'from',p_from,'to',p_to,'currency',currency_value,'archivedOrderCount',archived_count,'snapshot',snapshot_value);
end;
$function$;
create or replace function public.super_admin_close_accounting_period_v1(p_from date,p_to date,p_currency text) returns jsonb language sql set search_path='' as $function$select private.super_admin_close_accounting_period_v1(p_from,p_to,p_currency);$function$;
revoke all on function public.super_admin_close_accounting_period_v1(date,date,text) from public,anon;
grant execute on function public.super_admin_close_accounting_period_v1(date,date,text) to authenticated;

create or replace function private.super_admin_cleanup_operational_history_v1(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); period_row private.accounting_periods%rowtype; cutoff timestamptz; notifications_deleted integer:=0; idempotency_deleted integer:=0; outbox_deleted integer:=0; errors_deleted integer:=0;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 select * into period_row from private.accounting_periods where id=p_period_id for update;
 if period_row.id is null then raise exception 'accounting_period_not_found' using errcode='P0002'; end if;
 cutoff=(period_row.period_to+1)::timestamptz;
 delete from public.notifications where created_at<cutoff and read_at is not null; get diagnostics notifications_deleted=row_count;
 delete from private.idempotency_keys where created_at<cutoff; get diagnostics idempotency_deleted=row_count;
 delete from private.outbox_events where created_at<cutoff and processed_at is not null; get diagnostics outbox_deleted=row_count;
 delete from private.system_error_daily where event_day<period_row.period_from; get diagnostics errors_deleted=row_count;
 update private.accounting_periods set status='archived',archived_at=coalesce(archived_at,timezone('utc',now())),cleanup_completed_at=timezone('utc',now()) where id=p_period_id;
 return jsonb_build_object('id',p_period_id,'notificationsDeleted',notifications_deleted,'idempotencyDeleted',idempotency_deleted,'outboxDeleted',outbox_deleted,'errorDaysDeleted',errors_deleted,'financialRecordsPreserved',true);
end;
$function$;
create or replace function public.super_admin_cleanup_operational_history_v1(p_period_id uuid) returns jsonb language sql set search_path='' as $function$select private.super_admin_cleanup_operational_history_v1(p_period_id);$function$;
revoke all on function public.super_admin_cleanup_operational_history_v1(uuid) from public,anon;
grant execute on function public.super_admin_cleanup_operational_history_v1(uuid) to authenticated;

create or replace function private.admin_list_accounting_periods_v1()
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
 if auth.uid() is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'from',period_from,'to',period_to,'currency',currency,'status',status,'closedAt',closed_at,'archivedAt',archived_at,'cleanupCompletedAt',cleanup_completed_at,'snapshot',snapshot) order by period_to desc,currency) from private.accounting_periods),'[]'::jsonb);
end;$function$;
create or replace function public.admin_list_accounting_periods_v1() returns jsonb language sql set search_path='' as $function$select private.admin_list_accounting_periods_v1();$function$;
revoke all on function public.admin_list_accounting_periods_v1() from public,anon;
grant execute on function public.admin_list_accounting_periods_v1() to authenticated;
