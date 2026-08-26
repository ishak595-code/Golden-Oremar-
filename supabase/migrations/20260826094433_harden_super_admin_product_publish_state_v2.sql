with reset_products as (
  update public.products p
     set status='draft', is_active=false, published_at=null, updated_at=timezone('utc',now())
   where p.status='published'
     and p.is_active=false
     and p.deleted_at is null
     and not private.product_media_integrity_ok_v1(p.id)
  returning p.id
)
delete from public.product_images i
using reset_products r
where i.product_id=r.id
  and private.verified_catalog_product_image_path_v1(i.storage_path) is null;

create or replace function private.assert_published_product_media_integrity_v1(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1 from public.products p
    where p.id=p_product_id
      and p.status='published'
      and p.deleted_at is null
  ) and not private.product_media_integrity_ok_v1(p_product_id) then
    raise exception 'published_product_requires_verified_media' using errcode='23514';
  end if;
end;
$$;

create or replace function private.enforce_super_admin_product_publication_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  publication_requested boolean:=false;
begin
  if new.status='published' then
    if tg_op='INSERT' then
      publication_requested:=true;
    else
      publication_requested:=old.status is distinct from 'published'
        or (new.is_active=true and old.is_active is distinct from true);
    end if;
  end if;
  if not publication_requested then return new; end if;
  if auth.uid() is null or not coalesce(private.has_permission('product.publish'),false) then
    raise exception 'permission_required:product.publish' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.content_entries e
    where e.related_product_id=new.id
      and e.content_type='product_health'
      and e.locale='tr'
      and e.status='published'
      and e.deleted_at is null
  ) then
    raise exception 'published_product_health_required' using errcode='55000';
  end if;
  perform private.write_admin_audit_v2(
    'product.publication_authorized','product',new.id::text,
    case when tg_op='UPDATE' then jsonb_build_object('status',old.status,'isActive',old.is_active) else null end,
    jsonb_build_object('status',new.status,'isActive',new.is_active),
    jsonb_build_object('gate','product.publish','healthPackageVerified',true,'ownerApprovalRequired',true),null
  );
  return new;
end;
$$;

create or replace function private.protect_active_product_health_content_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  product_id uuid:=old.related_product_id;
  remains_valid boolean:=false;
begin
  if old.content_type<>'product_health' or old.locale<>'tr' or old.status<>'published' or old.deleted_at is not null or product_id is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if not exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.deleted_at is null) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='UPDATE' then
    remains_valid:=new.related_product_id=product_id and new.content_type='product_health' and new.locale='tr' and new.status='published' and new.deleted_at is null;
  end if;
  if not remains_valid then raise exception 'published_product_health_content_cannot_be_removed' using errcode='55000'; end if;
  return new;
end;
$$;