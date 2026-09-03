create or replace function private.get_product_availability_subscription_v1(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_id uuid:=private.resolve_product_id_v1(p_reference);
  active_value boolean:=false;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if product_id is null or not exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.is_active=true and p.deleted_at is null) then
    raise exception 'product_not_available' using errcode='P0002';
  end if;
  select coalesce(s.active,false) into active_value
  from public.product_availability_subscriptions s
  where s.user_id=caller_id and s.product_id=product_id;
  return jsonb_build_object('active',coalesce(active_value,false),'authenticated',true,'productId',product_id);
end;
$$;

revoke all on function private.get_product_availability_subscription_v1(text) from public;

create or replace function public.get_product_availability_subscription_v1(p_reference text)
returns jsonb
language sql
stable
set search_path=''
as $$ select private.get_product_availability_subscription_v1(p_reference); $$;

revoke all on function public.get_product_availability_subscription_v1(text) from public;
grant execute on function public.get_product_availability_subscription_v1(text) to authenticated;
