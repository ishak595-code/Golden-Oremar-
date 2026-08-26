-- Keep Storage RLS from directly querying a private evidence table.
-- PostgreSQL may evaluate policy predicates in an order different from their
-- textual order, so the bucket_id predicate is not a safe short-circuit.

create or replace function private.product_certificate_document_path_in_use_v1(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from private.product_certification_documents d
    where d.storage_path=p_storage_path
  );
$$;

revoke all on function private.product_certificate_document_path_in_use_v1(text) from public,anon;
grant execute on function private.product_certificate_document_path_in_use_v1(text) to authenticated,service_role;

drop policy if exists product_certificate_admin_delete_unlinked_own on storage.objects;
create policy product_certificate_admin_delete_unlinked_own
on storage.objects
for delete
to authenticated
using (
  bucket_id='product-certificates'
  and coalesce(private.is_admin(),false)
  and name like 'admin/'||auth.uid()::text||'/%'
  and not private.product_certificate_document_path_in_use_v1(name)
);

comment on function private.product_certificate_document_path_in_use_v1(text) is
  'RLS-safe private boundary for determining whether a product certificate Storage object is still referenced.';
