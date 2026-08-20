grant execute on function private.admin_operations_overview_v2() to authenticated;
create or replace function public.admin_operations_overview_v2()
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.admin_operations_overview_v2();$$;
revoke all on function public.admin_operations_overview_v2() from public,anon;
grant execute on function public.admin_operations_overview_v2() to authenticated;

grant execute on function private.get_my_producer_payment_identity_v1() to authenticated;
create or replace function public.get_my_producer_payment_identity_v1()
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.get_my_producer_payment_identity_v1();$$;
revoke all on function public.get_my_producer_payment_identity_v1() from public,anon;
grant execute on function public.get_my_producer_payment_identity_v1() to authenticated;
