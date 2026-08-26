create or replace function private.store_branding_can_edit_v1(p_producer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.producers p
    where p.id=p_producer_id
      and p.deleted_at is null
      and p.status='active'
      and p.is_verified=true
      and (
        p.owner_user_id=(select auth.uid())
        or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false))
      )
  );
$$;

create or replace function private.store_branding_verified_path_v1(p_producer_id uuid,p_kind text,p_path text)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  normalized text:=private.catalog_media_binary_verified_path_v2(p_path);
  kind text:=lower(btrim(coalesce(p_kind,'')));
begin
  if p_producer_id is null or kind not in ('logo','cover') or normalized is null then return null; end if;
  if normalized !~* ('^' || p_producer_id::text || '/profile/' || kind || '-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$') then return null; end if;
  return normalized;
end;
$$;

create or replace function private.get_store_branding_editor_v1(p_producer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  p public.producers%rowtype;
  can_edit boolean:=false;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not (
    (p.owner_user_id=caller_id and p.status in ('active','suspended'))
    or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false))
  ) then raise exception 'store_branding_access_required' using errcode='42501'; end if;
  can_edit:=private.store_branding_can_edit_v1(p.id);
  return jsonb_build_object(
    'producerId',p.id,
    'displayName',p.display_name,
    'storeKind',p.store_kind,
    'status',p.status,
    'verified',p.is_verified,
    'logoPath',p.logo_path,
    'coverPath',p.cover_path,
    'canEdit',can_edit,
    'logoBinaryVerified',private.catalog_media_binary_verified_path_v2(p.logo_path) is not null,
    'coverBinaryVerified',private.catalog_media_binary_verified_path_v2(p.cover_path) is not null
  );
end;
$$;

create or replace function private.set_store_branding_asset_v1(p_producer_id uuid,p_kind text,p_path text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  kind text:=lower(btrim(coalesce(p_kind,'')));
  normalized text;
  previous_path text;
  locked_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if kind not in ('logo','cover') then raise exception 'invalid_store_branding_kind' using errcode='22023'; end if;
  select p.id into locked_id from public.producers p where p.id=p_producer_id and p.deleted_at is null for update;
  if locked_id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not private.store_branding_can_edit_v1(p_producer_id) then raise exception 'store_branding_edit_required' using errcode='42501'; end if;
  normalized:=private.store_branding_verified_path_v1(p_producer_id,kind,p_path);
  if normalized is null then raise exception 'store_branding_asset_not_verified' using errcode='22023'; end if;
  if kind='logo' then
    select logo_path into previous_path from public.producers where id=p_producer_id;
    update public.producers set logo_path=normalized,updated_at=timezone('utc',now()) where id=p_producer_id;
  else
    select cover_path into previous_path from public.producers where id=p_producer_id;
    update public.producers set cover_path=normalized,updated_at=timezone('utc',now()) where id=p_producer_id;
  end if;
  return jsonb_build_object('ok',true,'producerId',p_producer_id,'kind',kind,'path',normalized,'previousPath',previous_path);
end;
$$;

create or replace function private.update_my_producer_profile_v2(p_display_name text,p_description text,p_story text,p_logo_path text,p_cover_path text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  producer public.producers%rowtype;
  clean_logo_path text:=nullif(btrim(coalesce(p_logo_path,'')),'');
  clean_cover_path text:=nullif(btrim(coalesce(p_cover_path,'')),'');
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into producer from public.producers where owner_user_id=caller_id and status in ('active','suspended') and deleted_at is null order by created_at desc limit 1;
  if producer.id is null then raise exception 'producer_profile_not_editable' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_display_name,''))) not between 2 and 120 then raise exception 'invalid_producer_display_name' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_description,'')))>1200 then raise exception 'producer_description_too_long' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_story,'')))>5000 then raise exception 'producer_story_too_long' using errcode='22023'; end if;
  if clean_logo_path is distinct from producer.logo_path and clean_logo_path is not null and private.store_branding_verified_path_v1(producer.id,'logo',clean_logo_path) is null then raise exception 'invalid_producer_logo_path' using errcode='22023'; end if;
  if clean_cover_path is distinct from producer.cover_path and clean_cover_path is not null and private.store_branding_verified_path_v1(producer.id,'cover',clean_cover_path) is null then raise exception 'invalid_producer_cover_path' using errcode='22023'; end if;
  update public.producers
  set display_name=btrim(p_display_name),description=btrim(coalesce(p_description,'')),story=btrim(coalesce(p_story,'')),logo_path=clean_logo_path,cover_path=clean_cover_path,updated_at=timezone('utc',now())
  where id=producer.id;
  return private.get_my_producer_profile_v1();
end;
$$;

create or replace function public.get_store_branding_editor_v1(p_producer_id uuid)
returns jsonb
language sql
stable
set search_path=''
as $$ select private.get_store_branding_editor_v1(p_producer_id); $$;

create or replace function public.set_store_branding_asset_v1(p_producer_id uuid,p_kind text,p_path text)
returns jsonb
language sql
set search_path=''
as $$ select private.set_store_branding_asset_v1(p_producer_id,p_kind,p_path); $$;

revoke all on function private.store_branding_can_edit_v1(uuid) from public,anon;
revoke all on function private.store_branding_verified_path_v1(uuid,text,text) from public,anon;
revoke all on function private.get_store_branding_editor_v1(uuid) from public,anon;
revoke all on function private.set_store_branding_asset_v1(uuid,text,text) from public,anon;
grant execute on function private.store_branding_can_edit_v1(uuid) to authenticated;
grant execute on function private.store_branding_verified_path_v1(uuid,text,text) to authenticated;
grant execute on function private.get_store_branding_editor_v1(uuid) to authenticated;
grant execute on function private.set_store_branding_asset_v1(uuid,text,text) to authenticated;
revoke all on function public.get_store_branding_editor_v1(uuid) from public,anon;
revoke all on function public.set_store_branding_asset_v1(uuid,text,text) from public,anon;
grant execute on function public.get_store_branding_editor_v1(uuid) to authenticated;
grant execute on function public.set_store_branding_asset_v1(uuid,text,text) to authenticated;

drop policy if exists storage_catalog_brand_insert_owner_or_official_v1 on storage.objects;
create policy storage_catalog_brand_insert_owner_or_official_v1
on storage.objects for insert to authenticated
with check (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='profile'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/profile/(logo|cover)-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
  and exists(
    select 1 from public.producers p
    where p.id::text=(storage.foldername(name))[1]
      and p.deleted_at is null
      and p.status='active'
      and p.is_verified=true
      and (p.owner_user_id=(select auth.uid()) or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false)))
  )
);

drop policy if exists storage_catalog_brand_delete_owner_or_official_v1 on storage.objects;
create policy storage_catalog_brand_delete_owner_or_official_v1
on storage.objects for delete to authenticated
using (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='profile'
  and exists(
    select 1 from public.producers p
    where p.id::text=(storage.foldername(name))[1]
      and p.deleted_at is null
      and (p.owner_user_id=(select auth.uid()) or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false)))
  )
  and not private.catalog_public_asset_is_referenced_v1(name)
);
