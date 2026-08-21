revoke execute on function public.create_customer_order(jsonb,jsonb,text,text) from authenticated;
revoke execute on function public.create_customer_order_v2(jsonb,jsonb,text,text) from authenticated;
revoke execute on function public.create_customer_order_v3(jsonb,jsonb,text,text,text) from authenticated;

revoke execute on function public.create_customer_order(jsonb,jsonb,text,text) from anon, public;
revoke execute on function public.create_customer_order_v2(jsonb,jsonb,text,text) from anon, public;
revoke execute on function public.create_customer_order_v3(jsonb,jsonb,text,text,text) from anon, public;

grant execute on function public.create_customer_order_v4(jsonb,jsonb,text,text,jsonb,text) to authenticated;
revoke execute on function public.create_customer_order_v4(jsonb,jsonb,text,text,jsonb,text) from anon, public;
