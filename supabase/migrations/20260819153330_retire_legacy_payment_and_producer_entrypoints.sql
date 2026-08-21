-- Golden Oremar canonical runtime cleanup.
-- Keep only the current externally callable producer onboarding and hosted iyzico payment paths.

-- Legacy producer onboarding reads/writes are no longer part of the client contract.
drop function if exists public.get_my_producer_application_draft_v3(uuid);
drop function if exists public.get_my_producer_application_draft_v4(uuid);
drop function if exists public.submit_producer_application_v3(uuid, jsonb);

do $$
declare
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_producer_application_draft_v3','save_producer_application_draft_v4')
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, fn.args);
  end loop;
end
$$;

-- Remove obsolete checkout/readiness aliases and pre-hosted service entrypoints.
-- Current runtime uses capabilities_v2 + readiness_v3 + hosted checkout + unified commerce completion.
drop function if exists public.get_checkout_payment_capabilities_v1();
drop function if exists public.get_checkout_payment_readiness_v1();
drop function if exists public.get_checkout_payment_readiness_v2();
drop function if exists public.store_hosted_payment_session_for_service_v1(uuid, text, jsonb);
drop function if exists public.prepare_order_payment_for_service_v1(uuid, uuid, text);
drop function if exists public.prepare_order_payment_for_service_v2(uuid, uuid, text);
drop function if exists public.complete_order_payment_for_service_v1(uuid, text, text, jsonb, text, text);
drop function if exists public.complete_order_payment_for_service_v2(uuid, text, text, text, jsonb, text, text);
drop function if exists public.fail_order_payment_intent_for_service_v1(uuid, text, text, jsonb);

-- Submitted KYC evidence must be immutable at the Storage object layer.
create or replace function private.can_delete_unsubmitted_producer_document_v1(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and split_part(coalesce(p_name,''), '/', 1) = auth.uid()::text
    and not exists (
      select 1
      from private.producer_documents d
      where d.storage_path = p_name
    );
$$;

revoke all on function private.can_delete_unsubmitted_producer_document_v1(text) from public, anon;
grant execute on function private.can_delete_unsubmitted_producer_document_v1(text) to authenticated;

drop policy if exists storage_private_assets_update_own on storage.objects;
create policy storage_private_assets_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = any (array['user-private'::text, 'return-evidence'::text])
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = any (array['user-private'::text, 'return-evidence'::text])
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists storage_private_assets_delete_own on storage.objects;
create policy storage_private_assets_delete_own
on storage.objects
for delete
to authenticated
using (
  (
    bucket_id = any (array['user-private'::text, 'return-evidence'::text])
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  or (
    bucket_id = 'producer-documents'
    and private.can_delete_unsubmitted_producer_document_v1(name)
  )
);
