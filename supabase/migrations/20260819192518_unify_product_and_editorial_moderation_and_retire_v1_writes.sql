create or replace function private.review_product_editorial_with_product_v1(p_product_id uuid,p_approve boolean,p_reason text,p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  draft_row private.product_editorial_drafts%rowtype;
  reason_value text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
  if p_actor is null or auth.uid() is distinct from p_actor or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select * into draft_row from private.product_editorial_drafts d where d.product_id=p_product_id and d.locale='tr' for update;
  if coalesce(p_approve,false) then
    if draft_row.id is null or draft_row.status<>'review' then raise exception 'product_editorial_review_required' using errcode='55000'; end if;
    perform private.publish_product_editorial_v1(p_product_id,draft_row.payload,p_actor);
    update private.product_editorial_drafts set status='approved',reviewed_by=p_actor,reviewed_at=timezone('utc',now()),review_note=null,updated_at=timezone('utc',now()) where id=draft_row.id;
    return jsonb_build_object('status','approved','draftId',draft_row.id,'productId',p_product_id);
  end if;
  if draft_row.id is not null and draft_row.status='review' then
    update private.product_editorial_drafts set status='rejected',reviewed_by=p_actor,reviewed_at=timezone('utc',now()),review_note=reason_value,updated_at=timezone('utc',now()) where id=draft_row.id;
    return jsonb_build_object('status','rejected','draftId',draft_row.id,'productId',p_product_id);
  end if;
  return jsonb_build_object('status','not_pending','productId',p_product_id);
end;
$$;
revoke all on function private.review_product_editorial_with_product_v1(uuid,boolean,text,uuid) from public;

create or replace function private.admin_review_product_v4(p_product_id uuid,p_approve boolean,p_reason text,p_ownership_checked boolean,p_image_checked boolean,p_scope_checked boolean,p_origin_checked boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare caller_id uuid:=auth.uid(); result jsonb; editorial_result jsonb;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if coalesce(p_approve,false) and not exists(select 1 from private.product_editorial_drafts d where d.product_id=p_product_id and d.locale='tr' and d.status='review') then raise exception 'product_editorial_review_required' using errcode='55000'; end if;
  result:=private.admin_review_product_v3(p_product_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked);
  editorial_result:=private.review_product_editorial_with_product_v1(p_product_id,p_approve,p_reason,caller_id);
  return result||jsonb_build_object('editorialReview',editorial_result);
end;
$$;
revoke all on function private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean) from public;

create or replace function public.admin_review_product_v3(p_product_id uuid,p_approve boolean,p_reason text default null,p_ownership_checked boolean default false,p_image_checked boolean default false,p_scope_checked boolean default false,p_origin_checked boolean default false)
returns jsonb language sql set search_path to '' as $$ select private.admin_review_product_v4(p_product_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked); $$;
grant execute on function public.admin_review_product_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) to authenticated;

create or replace function private.admin_review_product_change_v3(p_change_request_id uuid,p_approve boolean,p_reason text,p_ownership_checked boolean,p_image_checked boolean,p_scope_checked boolean,p_origin_checked boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare caller_id uuid:=auth.uid(); product_id uuid; result jsonb; editorial_result jsonb;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select cr.product_id into product_id from public.product_change_requests cr where cr.id=p_change_request_id and cr.status='pending';
  if product_id is null then raise exception 'pending_product_change_not_found' using errcode='P0002'; end if;
  if coalesce(p_approve,false) and not exists(select 1 from private.product_editorial_drafts d where d.product_id=product_id and d.locale='tr' and d.status='review') then raise exception 'product_editorial_review_required' using errcode='55000'; end if;
  result:=private.admin_review_product_change_v2(p_change_request_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked);
  editorial_result:=private.review_product_editorial_with_product_v1(product_id,p_approve,p_reason,caller_id);
  return result||jsonb_build_object('editorialReview',editorial_result);
end;
$$;
revoke all on function private.admin_review_product_change_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) from public;

create or replace function public.admin_review_product_change_v2(p_change_request_id uuid,p_approve boolean,p_reason text default null,p_ownership_checked boolean default false,p_image_checked boolean default false,p_scope_checked boolean default false,p_origin_checked boolean default false)
returns jsonb language sql set search_path to '' as $$ select private.admin_review_product_change_v3(p_change_request_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked); $$;
grant execute on function public.admin_review_product_change_v2(uuid,boolean,text,boolean,boolean,boolean,boolean) to authenticated;

drop function if exists public.producer_upsert_product_v1(text,jsonb);
drop function if exists public.management_upsert_product_v1(text,jsonb);
