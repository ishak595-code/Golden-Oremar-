create index if not exists orders_finance_period_idx on public.orders(currency,(coalesce(placed_at,created_at)),payment_status,status);
create index if not exists refunds_finance_period_idx on public.refunds(currency,created_at,status);
create index if not exists producer_ledger_finance_period_idx on private.producer_ledger_entries(currency,created_at,producer_id);
create index if not exists producer_payouts_finance_period_idx on private.producer_payouts(currency,(coalesce(processed_at,scheduled_at,created_at)),status);
create index if not exists payment_records_finance_period_idx on public.payment_records(currency,(coalesce(captured_at,created_at)),status);

create or replace function private.super_admin_close_accounting_period_v1(p_from date,p_to date,p_currency text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 caller_id uuid:=auth.uid();
 currency_value text:=upper(btrim(coalesce(p_currency,'')));
 snapshot_value jsonb;
 period_id uuid;
 archived_count integer;
 reconciliation_delta bigint;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'invalid_finance_date_range' using errcode='22023'; end if;
 if currency_value!~'^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
 if exists(select 1 from private.accounting_periods ap where ap.currency=currency_value and daterange(ap.period_from,ap.period_to,'[]') && daterange(p_from,p_to,'[]')) then raise exception 'accounting_period_overlap' using errcode='23505'; end if;
 if exists(select 1 from public.orders o where o.currency=currency_value and coalesce(o.placed_at,o.created_at)>=(p_from::timestamp at time zone 'UTC') and coalesce(o.placed_at,o.created_at)<((p_to+1)::timestamp at time zone 'UTC') and o.status not in('completed','cancelled','refunded')) then raise exception 'open_orders_prevent_period_close' using errcode='55000'; end if;
 if exists(select 1 from public.return_requests rr join public.orders o on o.id=rr.order_id where o.currency=currency_value and coalesce(o.placed_at,o.created_at)>=(p_from::timestamp at time zone 'UTC') and coalesce(o.placed_at,o.created_at)<((p_to+1)::timestamp at time zone 'UTC') and rr.status not in('rejected','refunded','closed')) then raise exception 'open_returns_prevent_period_close' using errcode='55000'; end if;
 snapshot_value:=private.admin_finance_report_v2(p_from,p_to,currency_value);
 reconciliation_delta:=coalesce((snapshot_value#>>'{totals,reconciliation_delta_minor}')::bigint,0);
 if reconciliation_delta<>0 then raise exception 'accounting_reconciliation_required:%',reconciliation_delta using errcode='55000'; end if;
 insert into private.accounting_periods(period_from,period_to,currency,snapshot,closed_by) values(p_from,p_to,currency_value,snapshot_value,caller_id) returning id into period_id;
 update public.orders set accounting_archived_at=timezone('utc',now()),accounting_period_id=period_id where currency=currency_value and coalesce(placed_at,created_at)>=(p_from::timestamp at time zone 'UTC') and coalesce(placed_at,created_at)<((p_to+1)::timestamp at time zone 'UTC') and status in('completed','cancelled','refunded');
 get diagnostics archived_count=row_count;
 return jsonb_build_object('id',period_id,'from',p_from,'to',p_to,'currency',currency_value,'archivedOrderCount',archived_count,'snapshot',snapshot_value);
end;
$function$;
