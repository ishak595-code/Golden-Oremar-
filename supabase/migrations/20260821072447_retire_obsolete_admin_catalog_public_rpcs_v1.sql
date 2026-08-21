-- Retire obsolete public RPC entrypoints while preserving private implementation
-- layers still used by newer canonical functions.

drop function if exists public.admin_list_producers_v1();
drop function if exists public.admin_list_products_v1();
drop function if exists public.admin_operations_overview_v1();
drop function if exists public.admin_review_product_v1(uuid, boolean, text);
drop function if exists public.admin_review_product_change_v1(uuid, boolean, text);
