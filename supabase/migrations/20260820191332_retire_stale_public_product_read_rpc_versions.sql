revoke all on function public.get_public_product_detail_v1(text) from public, anon, authenticated;
revoke all on function public.get_public_product_detail_v2(text) from public, anon, authenticated;
revoke all on function public.get_public_product_detail_v3(text) from public, anon, authenticated;
revoke all on function public.get_public_product_detail_v4(text) from public, anon, authenticated;
revoke all on function public.get_public_product_detail_v5(text) from public, anon, authenticated;

revoke all on function public.get_public_producer_profile_v1(text) from public, anon, authenticated;
revoke all on function public.get_public_producer_profile_v2(text) from public, anon, authenticated;

revoke all on function public.get_public_product_safety_v1(text,text) from public, anon, authenticated;
revoke all on function public.get_public_product_safety_v2(text,text) from public, anon, authenticated;

revoke execute on function public.get_public_product_detail_v6(text) from public;
grant execute on function public.get_public_product_detail_v6(text) to anon, authenticated, service_role;

revoke execute on function public.get_public_producer_profile_v3(text) from public;
grant execute on function public.get_public_producer_profile_v3(text) to anon, authenticated, service_role;

revoke execute on function public.get_public_product_safety_v3(text,text) from public;
grant execute on function public.get_public_product_safety_v3(text,text) to anon, authenticated, service_role;
