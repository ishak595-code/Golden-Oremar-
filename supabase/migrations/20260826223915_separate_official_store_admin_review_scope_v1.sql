-- The canonical official store is not an independent producer program member.
-- Keep independent producer category authorization fail-closed while allowing
-- Super Admin owner review of official-store products in active categories.

create or replace function private.admin_review_product_v3(
  p_product_id uuid,
  p_approve boolean,
  p_reason text,
  p_ownership_checked boolean,
  p_image_checked boolean,
  p_scope_checked boolean,
  p_origin_checked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.products%rowtype;
  producer public.producers%rowtype;
  category_slug text;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null or not coalesce(private.has_permission('product.moderate'), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select * into product_row
  from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if product_row.id is null or product_row.status not in ('review', 'rejected') then
    raise exception 'product_not_reviewable' using errcode = '55000';
  end if;

  select * into producer
  from public.producers
  where id = product_row.producer_id and deleted_at is null;

  if producer.id is null then
    raise exception 'product_producer_not_found' using errcode = '55000';
  end if;

  select c.slug into category_slug
  from public.categories c
  where c.id = product_row.category_id and c.is_active = true;

  if coalesce(p_approve, false) then
    if p_ownership_checked is not true or p_image_checked is not true or p_scope_checked is not true or p_origin_checked is not true then
      raise exception 'product_moderation_checklist_required' using errcode = '22023';
    end if;

    if not private.is_producer_trust_badge_active_v1(product_row.producer_id) then
      raise exception 'producer_trust_badge_required' using errcode = '55000';
    end if;

    if category_slug is null then
      raise exception 'product_category_inactive_or_missing' using errcode = '55000';
    end if;

    if coalesce(producer.store_kind, '') <> 'official'
       and not (category_slug = any(producer.approved_category_slugs)) then
      raise exception 'product_category_outside_producer_scope' using errcode = '55000';
    end if;

    if lower(btrim(coalesce(product_row.origin, ''))) <> lower(btrim(coalesce(producer.production_location, ''))) then
      raise exception 'product_origin_mismatch' using errcode = '55000';
    end if;
  end if;

  return private.admin_review_product_v2(p_product_id,p_approve,clean_reason);
end;
$$;

revoke all on function private.admin_review_product_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) from public, anon, authenticated;
