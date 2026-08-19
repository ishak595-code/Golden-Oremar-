insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-certificates','product-certificates',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists private.product_certification_documents(
  certification_id uuid primary key references public.product_certifications(id) on delete cascade,
  storage_path text not null unique,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default timezone('utc',now()),
  review_note text,
  created_at timestamptz not null default timezone('utc',now())
);
create index if not exists product_certification_documents_submitted_by_idx on private.product_certification_documents(submitted_by);
create index if not exists product_certification_documents_reviewed_by_idx on private.product_certification_documents(reviewed_by);

create or replace function private.verified_product_certificate_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare normalized text:=btrim(coalesce(p_path,'')); mime text; size_bytes bigint;
begin
  if normalized='' or char_length(normalized)>1200 or normalized~*'^[a-z][a-z0-9+.-]*:' or normalized like '/%' then return null; end if;
  if exists(select 1 from unnest(string_to_array(normalized,'/')) part where part in ('','.','..')) then return null; end if;
  select lower(coalesce(o.metadata->>'mimetype','')),nullif(o.metadata->>'size','')::bigint into mime,size_bytes
  from storage.objects o where o.bucket_id='product-certificates' and o.name=normalized limit 1;
  if mime not in ('application/pdf','image/jpeg','image/png','image/webp') then return null; end if;
  if size_bytes is null or size_bytes<=0 or size_bytes>20971520 then return null; end if;
  return normalized;
exception when others then return null;
end;
$$;
revoke all on function private.verified_product_certificate_path_v1(text) from public;

create policy "product_certificate_admin_read" on storage.objects for select to authenticated using(bucket_id='product-certificates' and coalesce(private.is_admin(),false));
create policy "product_certificate_admin_insert_own" on storage.objects for insert to authenticated with check(bucket_id='product-certificates' and coalesce(private.is_admin(),false) and name like 'admin/'||auth.uid()::text||'/%');
create policy "product_certificate_admin_delete_unlinked_own" on storage.objects for delete to authenticated using(bucket_id='product-certificates' and coalesce(private.is_admin(),false) and name like 'admin/'||auth.uid()::text||'/%' and not exists(select 1 from private.product_certification_documents d where d.storage_path=storage.objects.name));

create or replace function private.admin_get_product_certifications_v1(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.deleted_at is null) then raise exception 'product_not_found' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'certificateType',c.certificate_type,'issuer',c.issuer,'certificateNumber',c.certificate_number,'issuedAt',c.issued_at,'expiresAt',c.expires_at,'status',c.status,'documentPath',d.storage_path,'reviewedAt',d.reviewed_at,'reviewNote',d.review_note) order by c.created_at desc),'[]'::jsonb) into result
  from public.product_certifications c left join private.product_certification_documents d on d.certification_id=c.id where c.product_id=p_product_id;
  return result;
end;
$$;
revoke all on function private.admin_get_product_certifications_v1(uuid) from public;
create or replace function public.admin_get_product_certifications_v1(p_product_id uuid)
returns jsonb language sql stable set search_path to '' as $$select private.admin_get_product_certifications_v1(p_product_id);$$;
grant execute on function public.admin_get_product_certifications_v1(uuid) to authenticated;

create or replace function private.admin_record_product_organic_certificate_v1(p_product_id uuid,p_issuer text,p_certificate_number text,p_issued_at date,p_expires_at date,p_document_path text,p_review_confirmed boolean,p_review_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare caller_id uuid:=auth.uid(); issuer_value text:=btrim(coalesce(p_issuer,'')); number_value text:=btrim(coalesce(p_certificate_number,'')); document_value text:=private.verified_product_certificate_path_v1(p_document_path); note_value text:=nullif(btrim(coalesce(p_review_note,'')),''); certification_id uuid;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if not coalesce(p_review_confirmed,false) then raise exception 'certificate_manual_review_required' using errcode='22023'; end if;
  if not exists(select 1 from public.products p join public.producers pr on pr.id=p.producer_id where p.id=p_product_id and p.deleted_at is null and pr.status='active' and pr.is_verified=true and pr.deleted_at is null) then raise exception 'verified_product_required' using errcode='55000'; end if;
  if char_length(issuer_value) not between 2 and 180 or char_length(number_value) not between 2 and 120 then raise exception 'invalid_certificate_identity' using errcode='22023'; end if;
  if p_issued_at is null or p_expires_at is null or p_issued_at>current_date or p_expires_at<current_date or p_expires_at<p_issued_at then raise exception 'invalid_certificate_dates' using errcode='22023'; end if;
  if document_value is null then raise exception 'stored_certificate_document_required' using errcode='55000'; end if;
  if document_value not like 'admin/'||caller_id::text||'/%' then raise exception 'admin_owned_certificate_document_required' using errcode='42501'; end if;
  if note_value is not null and char_length(note_value)>2000 then raise exception 'certificate_review_note_too_long' using errcode='22023'; end if;
  update public.product_certifications set status='revoked' where product_id=p_product_id and status='valid' and lower(certificate_type) in ('organic','organic_certificate','certified_organic');
  insert into public.product_certifications(product_id,certificate_type,issuer,certificate_number,issued_at,expires_at,verification_url,status)
  values(p_product_id,'organic',issuer_value,number_value,p_issued_at,p_expires_at,null,'valid') returning id into certification_id;
  insert into private.product_certification_documents(certification_id,storage_path,submitted_by,reviewed_by,review_note) values(certification_id,document_value,caller_id,caller_id,note_value);
  return jsonb_build_object('id',certification_id,'productId',p_product_id,'status','valid','certificateType','organic','expiresAt',p_expires_at);
end;
$$;
revoke all on function private.admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text) from public;
create or replace function public.admin_record_product_organic_certificate_v1(p_product_id uuid,p_issuer text,p_certificate_number text,p_issued_at date,p_expires_at date,p_document_path text,p_review_confirmed boolean,p_review_note text default null)
returns jsonb language sql set search_path to '' as $$select private.admin_record_product_organic_certificate_v1(p_product_id,p_issuer,p_certificate_number,p_issued_at,p_expires_at,p_document_path,p_review_confirmed,p_review_note);$$;
grant execute on function public.admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text) to authenticated;

create or replace function private.admin_revoke_product_certification_v1(p_certification_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare reason_value text:=btrim(coalesce(p_reason,'')); product_id uuid;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if char_length(reason_value) not between 8 and 2000 then raise exception 'certificate_revocation_reason_required' using errcode='22023'; end if;
  update public.product_certifications set status='revoked' where id=p_certification_id and status='valid' returning product_certifications.product_id into product_id;
  if product_id is null then raise exception 'valid_certificate_not_found' using errcode='P0002'; end if;
  update private.product_certification_documents set review_note=reason_value,reviewed_by=auth.uid(),reviewed_at=timezone('utc',now()) where certification_id=p_certification_id;
  return jsonb_build_object('id',p_certification_id,'productId',product_id,'status','revoked');
end;
$$;
revoke all on function private.admin_revoke_product_certification_v1(uuid,text) from public;
create or replace function public.admin_revoke_product_certification_v1(p_certification_id uuid,p_reason text)
returns jsonb language sql set search_path to '' as $$select private.admin_revoke_product_certification_v1(p_certification_id,p_reason);$$;
grant execute on function public.admin_revoke_product_certification_v1(uuid,text) to authenticated;
