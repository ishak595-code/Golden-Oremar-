create table if not exists private.platform_expenses(
 id uuid primary key default gen_random_uuid(),
 spent_on date not null,
 category text not null check(category in('payment_fee','shipping_subsidy','marketing','software','staff','tax_accounting','refund_loss','bank_fee','legal','other')),
 description text not null check(char_length(description) between 3 and 1000),
 amount_minor bigint not null check(amount_minor>0),
 currency text not null check(currency~'^[A-Z]{3}$'),
 external_reference text,
 receipt_path text,
 status text not null default 'posted' check(status in('posted','void')),
 void_reason text,
 created_by uuid references auth.users(id) on delete set null,
 voided_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default timezone('utc',now()),
 updated_at timestamptz not null default timezone('utc',now()),
 voided_at timestamptz,
 check((status='posted' and void_reason is null and voided_at is null) or (status='void' and char_length(coalesce(void_reason,'')) between 8 and 1000 and voided_at is not null))
);
create index if not exists platform_expenses_period_idx on private.platform_expenses(currency,spent_on,status);

create or replace function private.super_admin_add_platform_expense_v1(p_spent_on date,p_category text,p_description text,p_amount_minor bigint,p_currency text,p_external_reference text default null,p_receipt_path text default null)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); category_value text:=lower(btrim(coalesce(p_category,''))); description_value text:=btrim(coalesce(p_description,'')); currency_value text:=upper(btrim(coalesce(p_currency,''))); ref_value text:=nullif(btrim(coalesce(p_external_reference,'')),''); receipt_value text:=nullif(btrim(coalesce(p_receipt_path,'')),''); row private.platform_expenses%rowtype;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_spent_on is null or p_spent_on>timezone('utc',now())::date then raise exception 'invalid_expense_date' using errcode='22023'; end if;
 if category_value not in('payment_fee','shipping_subsidy','marketing','software','staff','tax_accounting','refund_loss','bank_fee','legal','other') then raise exception 'invalid_expense_category' using errcode='22023'; end if;
 if char_length(description_value) not between 3 and 1000 then raise exception 'invalid_expense_description' using errcode='22023'; end if;
 if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>100000000000000 then raise exception 'invalid_expense_amount' using errcode='22023'; end if;
 if currency_value!~'^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
 if ref_value is not null and char_length(ref_value)>300 then raise exception 'invalid_expense_reference' using errcode='22023'; end if;
 if receipt_value is not null and (char_length(receipt_value)>1200 or receipt_value~'^[a-z][a-z0-9+.-]*:') then raise exception 'invalid_expense_receipt' using errcode='22023'; end if;
 if exists(select 1 from private.accounting_periods ap where ap.currency=currency_value and p_spent_on between ap.period_from and ap.period_to) then raise exception 'closed_period_cannot_accept_expense' using errcode='55000'; end if;
 insert into private.platform_expenses(spent_on,category,description,amount_minor,currency,external_reference,receipt_path,created_by) values(p_spent_on,category_value,description_value,p_amount_minor,currency_value,ref_value,receipt_value,caller_id) returning * into row;
 return jsonb_build_object('id',row.id,'spentOn',row.spent_on,'category',row.category,'description',row.description,'amountMinor',row.amount_minor,'currency',row.currency,'status',row.status,'externalReference',row.external_reference,'receiptPath',row.receipt_path,'createdAt',row.created_at);
end;$function$;
create or replace function public.super_admin_add_platform_expense_v1(p_spent_on date,p_category text,p_description text,p_amount_minor bigint,p_currency text,p_external_reference text default null,p_receipt_path text default null) returns jsonb language sql set search_path='' as $function$select private.super_admin_add_platform_expense_v1(p_spent_on,p_category,p_description,p_amount_minor,p_currency,p_external_reference,p_receipt_path);$function$;
revoke all on function public.super_admin_add_platform_expense_v1(date,text,text,bigint,text,text,text) from public,anon;
grant execute on function public.super_admin_add_platform_expense_v1(date,text,text,bigint,text,text,text) to authenticated;

create or replace function private.super_admin_void_platform_expense_v1(p_expense_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); reason_value text:=btrim(coalesce(p_reason,'')); row private.platform_expenses%rowtype;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if char_length(reason_value) not between 8 and 1000 then raise exception 'expense_void_reason_required' using errcode='22023'; end if;
 select * into row from private.platform_expenses where id=p_expense_id for update;
 if row.id is null then raise exception 'expense_not_found' using errcode='P0002'; end if;
 if row.status='void' then raise exception 'expense_already_void' using errcode='55000'; end if;
 if exists(select 1 from private.accounting_periods ap where ap.currency=row.currency and row.spent_on between ap.period_from and ap.period_to) then raise exception 'closed_period_expense_cannot_be_voided' using errcode='55000'; end if;
 update private.platform_expenses set status='void',void_reason=reason_value,voided_by=caller_id,voided_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=row.id;
 return jsonb_build_object('id',row.id,'status','void');
end;$function$;
create or replace function public.super_admin_void_platform_expense_v1(p_expense_id uuid,p_reason text) returns jsonb language sql set search_path='' as $function$select private.super_admin_void_platform_expense_v1(p_expense_id,p_reason);$function$;
revoke all on function public.super_admin_void_platform_expense_v1(uuid,text) from public,anon;
grant execute on function public.super_admin_void_platform_expense_v1(uuid,text) to authenticated;

create or replace function private.admin_list_platform_expenses_v1(p_from date,p_to date,p_currency text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare currency_value text:=upper(btrim(coalesce(p_currency,'')));
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'invalid_finance_date_range' using errcode='22023'; end if;
 if currency_value!~'^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'spentOn',e.spent_on,'category',e.category,'description',e.description,'amountMinor',e.amount_minor,'currency',e.currency,'status',e.status,'externalReference',e.external_reference,'receiptPath',e.receipt_path,'voidReason',e.void_reason,'createdAt',e.created_at) order by e.spent_on desc,e.created_at desc) from private.platform_expenses e where e.spent_on between p_from and p_to and e.currency=currency_value),'[]'::jsonb);
end;$function$;
create or replace function public.admin_list_platform_expenses_v1(p_from date,p_to date,p_currency text) returns jsonb language sql set search_path='' as $function$select private.admin_list_platform_expenses_v1(p_from,p_to,p_currency);$function$;
revoke all on function public.admin_list_platform_expenses_v1(date,date,text) from public,anon;
grant execute on function public.admin_list_platform_expenses_v1(date,date,text) to authenticated;

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
 payments as(select coalesce(sum(amount_minor) filter(where status in('captured','partially_refunded','refunded')),0)::bigint captured_minor from public.payment_records where currency=currency_value and timezone('utc',coalesce(captured_at,created_at))::date between p_from and p_to),
 expenses as(select coalesce(sum(amount_minor),0)::bigint expense_minor from private.platform_expenses where currency=currency_value and status='posted' and spent_on between p_from and p_to),
 scalars as(select coalesce((select sum(commission_minor) from ledger),0)::bigint commission_minor,coalesce((select sum(producer_net_minor) from ledger),0)::bigint producer_net_minor,coalesce((select sum(producer_gross_minor) from ledger),0)::bigint producer_gross_minor,(select paid_payout_minor from payouts)::bigint paid_payout_minor,(select pending_payout_minor from payouts)::bigint pending_payout_minor,(select captured_minor from payments)::bigint captured_minor,(select expense_minor from expenses)::bigint expense_minor,coalesce((select sum(refund_minor) from daily),0)::bigint refund_minor,coalesce((select sum(gross_sales_minor) from daily),0)::bigint gross_sales_minor)
 select jsonb_build_object('currency',currency_value,'from',p_from,'to',p_to,'totals',jsonb_build_object('order_count',coalesce((select sum(order_count) from daily),0),'gross_sales_minor',(select gross_sales_minor from scalars),'refund_minor',(select refund_minor from scalars),'net_sales_minor',(select gross_sales_minor-refund_minor from scalars),'commission_minor',(select commission_minor from scalars),'estimated_payout_minor',(select producer_net_minor from scalars),'producer_gross_minor',(select producer_gross_minor from scalars),'paid_payout_minor',(select paid_payout_minor from scalars),'pending_payout_minor',(select pending_payout_minor from scalars),'captured_payment_minor',(select captured_minor from scalars),'reconciliation_delta_minor',(select captured_minor-gross_sales_minor from scalars),'expense_minor',(select expense_minor from scalars),'platform_profit_minor',(select commission_minor-expense_minor from scalars),'cash_out_minor',(select refund_minor+paid_payout_minor+expense_minor from scalars),'cash_delta_minor',(select captured_minor-refund_minor-paid_payout_minor-expense_minor from scalars)),'daily_sales',coalesce((select jsonb_agg(jsonb_build_object('date',report_date,'order_count',order_count,'gross_sales_minor',gross_sales_minor,'refund_minor',refund_minor,'net_sales_minor',net_sales_minor) order by report_date) from daily),'[]'::jsonb),'vendor_income',coalesce((select jsonb_agg(jsonb_build_object('producer_id',producer_id,'vendor_name',vendor_name,'order_count',order_count,'gross_sales_minor',gross_sales_minor,'commission_minor',commission_minor,'estimated_payout_minor',estimated_payout_minor) order by gross_sales_minor desc,vendor_name) from vendor_income),'[]'::jsonb),'available_currencies',coalesce((select jsonb_agg(currency order by currency) from(select distinct currency from public.orders union select distinct currency from private.producer_ledger_entries union select distinct currency from private.producer_payouts union select distinct currency from private.platform_expenses) c),'[]'::jsonb)) into result;
 return result;
end;$function$;
