create or replace function public.catalog_media_register_verification_service_v1(
  p_storage_path text,
  p_uploader_user_id uuid,
  p_storage_object_id uuid,
  p_storage_object_version text,
  p_storage_updated_at timestamptz,
  p_detected_mime text,
  p_byte_size bigint,
  p_sha256_hex text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized text:=private.verified_public_storage_path_v1('catalog-public',p_storage_path);
  parts text[];
  filename text;
  extension text;
  source_kind text;
  resolved_producer_id uuid;
  object_row storage.objects%rowtype;
  official_count integer:=0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role_required'; end if;
  if normalized is null or p_uploader_user_id is null or p_storage_object_id is null or p_storage_updated_at is null then raise exception 'catalog_media_verification_input_invalid'; end if;
  if lower(coalesce(p_detected_mime,'')) not in ('image/jpeg','image/png','image/webp','image/avif') then raise exception 'catalog_media_detected_mime_invalid'; end if;
  if p_byte_size is null or p_byte_size not between 1 and 10485760 then raise exception 'catalog_media_size_invalid'; end if;
  if lower(coalesce(p_sha256_hex,'')) !~ '^[0-9a-f]{64}$' then raise exception 'catalog_media_checksum_invalid'; end if;

  parts:=string_to_array(normalized,'/');
  if array_length(parts,1)=3 and parts[2]='products' then
    begin resolved_producer_id:=parts[1]::uuid; exception when others then raise exception 'catalog_media_path_invalid'; end;
    filename:=parts[3];
    if filename !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$' then raise exception 'catalog_media_path_invalid'; end if;
    if not exists(select 1 from public.producers p where p.id=resolved_producer_id and p.owner_user_id=p_uploader_user_id and p.status='active' and p.deleted_at is null) then raise exception 'catalog_media_owner_mismatch'; end if;
    source_kind:='producer';
  elsif array_length(parts,1)=4 and parts[1]='admin' and parts[3]='official-products' then
    if parts[2]<>p_uploader_user_id::text then raise exception 'catalog_media_owner_mismatch'; end if;
    filename:=parts[4];
    if filename !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$' then raise exception 'catalog_media_path_invalid'; end if;
    if not private.user_has_permission_v1(p_uploader_user_id,'product.create') then raise exception 'catalog_media_admin_permission_required'; end if;
    select count(*)::integer into official_count from public.producers p where p.store_kind='official' and p.status='active' and p.deleted_at is null;
    if official_count<>1 then raise exception 'official_store_not_ready'; end if;
    select p.id into resolved_producer_id from public.producers p where p.store_kind='official' and p.status='active' and p.deleted_at is null order by p.created_at limit 1;
    if resolved_producer_id is null then raise exception 'official_store_not_ready'; end if;
    source_kind:='official_admin';
  else
    raise exception 'catalog_media_path_invalid';
  end if;

  extension:=lower(regexp_replace(filename,'^.*\.','','g'));
  if not ((lower(p_detected_mime)='image/jpeg' and extension in ('jpg','jpeg')) or (lower(p_detected_mime)='image/png' and extension='png') or (lower(p_detected_mime)='image/webp' and extension='webp') or (lower(p_detected_mime)='image/avif' and extension='avif')) then raise exception 'catalog_media_extension_mismatch'; end if;

  select o.* into object_row from storage.objects o where o.bucket_id='catalog-public' and o.name=normalized and coalesce(o.is_delete_marker,false)=false and o.archived_at is null;
  if not found then raise exception 'catalog_media_object_missing'; end if;
  if object_row.id<>p_storage_object_id or object_row.updated_at is distinct from p_storage_updated_at or (p_storage_object_version is not null and object_row.version is distinct from p_storage_object_version) then raise exception 'catalog_media_object_changed'; end if;
  if coalesce(object_row.owner::text,object_row.owner_id,'')<>p_uploader_user_id::text then raise exception 'catalog_media_storage_owner_mismatch'; end if;
  if lower(coalesce(object_row.metadata->>'mimetype',''))<>lower(p_detected_mime) then raise exception 'catalog_media_metadata_mime_mismatch'; end if;
  if coalesce(object_row.metadata->>'size','') !~ '^[0-9]{1,12}$' or (object_row.metadata->>'size')::bigint<>p_byte_size then raise exception 'catalog_media_metadata_size_mismatch'; end if;

  insert into private.catalog_media_verifications(storage_path,storage_object_id,storage_object_version,storage_updated_at,uploader_user_id,producer_id,source_kind,detected_mime,byte_size,sha256_hex,verified_at)
  values(normalized,object_row.id,object_row.version,object_row.updated_at,p_uploader_user_id,resolved_producer_id,source_kind,lower(p_detected_mime),p_byte_size,lower(p_sha256_hex),timezone('utc',now()))
  on conflict(storage_path) do update set storage_object_id=excluded.storage_object_id,storage_object_version=excluded.storage_object_version,storage_updated_at=excluded.storage_updated_at,uploader_user_id=excluded.uploader_user_id,producer_id=excluded.producer_id,source_kind=excluded.source_kind,detected_mime=excluded.detected_mime,byte_size=excluded.byte_size,sha256_hex=excluded.sha256_hex,verified_at=excluded.verified_at;
  return true;
end;
$$;

revoke all on function public.catalog_media_register_verification_service_v1(text,uuid,uuid,text,timestamptz,text,bigint,text) from public,anon,authenticated;
grant execute on function public.catalog_media_register_verification_service_v1(text,uuid,uuid,text,timestamptz,text,bigint,text) to service_role;
