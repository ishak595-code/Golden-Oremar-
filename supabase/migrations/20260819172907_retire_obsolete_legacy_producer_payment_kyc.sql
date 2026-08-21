revoke all on function public.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
drop function if exists public.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text);
drop function if exists private.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text);
drop table if exists private.producer_payment_kyc_profiles;
