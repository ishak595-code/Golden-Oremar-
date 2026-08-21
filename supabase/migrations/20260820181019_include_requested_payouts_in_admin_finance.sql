create or replace function private.admin_operations_overview_v3()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare payload jsonb; payout_count bigint;
begin
  payload:=private.admin_operations_overview_v2();
  select count(*) into payout_count from private.producer_payouts where status in('requested','scheduled','processing');
  return jsonb_set(payload,'{counts,producer_payouts}',to_jsonb(payout_count),true);
end;
$$;
revoke all on function private.admin_operations_overview_v3() from public,anon;
grant execute on function private.admin_operations_overview_v3() to authenticated;
create or replace function public.admin_operations_overview_v2()
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.admin_operations_overview_v3();$$;
revoke all on function public.admin_operations_overview_v2() from public,anon;
grant execute on function public.admin_operations_overview_v2() to authenticated;

create or replace function private.admin_finance_report_v3(p_from date,p_to date,p_currency text default 'TRY')
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare payload jsonb; pending_minor bigint; currency_value text:=upper(btrim(coalesce(p_currency,'')));
begin
  payload:=private.admin_finance_report_v2(p_from,p_to,currency_value);
  select coalesce(sum(amount_minor),0)::bigint into pending_minor
  from private.producer_payouts
  where currency=currency_value and status in('requested','scheduled','processing')
    and timezone('utc',coalesce(processed_at,requested_at,scheduled_at,created_at))::date between p_from and p_to;
  return jsonb_set(payload,'{totals,pending_payout_minor}',to_jsonb(pending_minor),true);
end;
$$;
revoke all on function private.admin_finance_report_v3(date,date,text) from public,anon;
grant execute on function private.admin_finance_report_v3(date,date,text) to authenticated;
create or replace function public.admin_finance_report_v2(p_from date,p_to date,p_currency text default 'TRY')
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.admin_finance_report_v3(p_from,p_to,p_currency);$$;
revoke all on function public.admin_finance_report_v2(date,date,text) from public,anon;
grant execute on function public.admin_finance_report_v2(date,date,text) to authenticated;
