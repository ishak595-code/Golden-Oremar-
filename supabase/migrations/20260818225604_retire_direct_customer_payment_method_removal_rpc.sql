revoke all on function public.remove_my_payment_method_v1(uuid) from public,anon,authenticated;
comment on function public.remove_my_payment_method_v1(uuid) is 'Retired for direct customer execution. Payment method removal must go through payment-method-vault so provider deletion succeeds before local revocation.';
