create or replace function private.admin_moderate_review_v1(p_review_id uuid,p_status text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid(); next_status text:=lower(btrim(coalesce(p_status,''))); reason_value text:=nullif(btrim(coalesce(p_reason,'')),''); review_row public.reviews%rowtype; before_value jsonb;
begin
  if caller_id is null or not private.has_permission('review.moderate') then raise exception 'permission_required:review.moderate' using errcode='42501'; end if;
  if next_status not in ('published','rejected','hidden') then raise exception 'invalid_review_moderation_status' using errcode='22023'; end if;
  if next_status='published' and not private.has_permission('review.publish') then raise exception 'permission_required:review.publish' using errcode='42501'; end if;
  if next_status='rejected' and not private.has_permission('review.reject') then raise exception 'permission_required:review.reject' using errcode='42501'; end if;
  if next_status='hidden' and not private.has_permission('review.remove') then raise exception 'permission_required:review.remove' using errcode='42501'; end if;
  if next_status in ('rejected','hidden') and char_length(coalesce(reason_value,''))<5 then raise exception 'review_moderation_reason_required' using errcode='22023'; end if;
  if reason_value is not null and char_length(reason_value)>2000 then raise exception 'review_moderation_reason_too_long' using errcode='22023'; end if;
  select * into review_row from public.reviews where id=p_review_id for update;
  if review_row.id is null then raise exception 'review_not_found' using errcode='P0002'; end if;
  if review_row.status='withdrawn' then raise exception 'withdrawn_review_cannot_be_moderated' using errcode='55000'; end if;
  before_value:=jsonb_build_object('status',review_row.status,'moderatedBy',review_row.moderated_by,'moderatedAt',review_row.moderated_at);
  update public.reviews set status=next_status,moderated_by=caller_id,moderated_at=timezone('utc',now()),moderation_reason=reason_value,updated_at=timezone('utc',now()) where id=review_row.id returning * into review_row;
  insert into public.notifications(user_id,type,title,message,action_url,metadata) values(review_row.user_id,'review',case when next_status='published' then 'Yorumunuz yayınlandı' else 'Yorumunuz incelendi' end,case when next_status='published' then 'Doğrulanmış alışveriş yorumunuz yayınlandı.' else 'Yorumunuzun moderasyon durumu güncellendi.' end,'/account/reviews',jsonb_build_object('reviewId',review_row.id,'status',next_status));
  perform private.write_admin_audit_v2('review.moderated','review',review_row.id::text,before_value,jsonb_build_object('status',review_row.status,'moderatedBy',review_row.moderated_by,'moderatedAt',review_row.moderated_at),jsonb_build_object('reason',reason_value));
  return jsonb_build_object('id',review_row.id,'status',review_row.status,'moderatedAt',review_row.moderated_at,'reason',review_row.moderation_reason);
end; $$;

create or replace function public.admin_list_reviews()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.has_permission('review.read') then raise exception 'permission_required:review.read' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',review.id,'user_name',coalesce(nullif(profile.display_name,''),'Kullanıcı'),'product_name',product.name,'rating',review.rating,'title',review.title,'comment',review.body,'status',review.status,'is_verified_purchase',review.is_verified_purchase,'created_at',review.created_at,'updated_at',review.updated_at) order by review.created_at desc),'[]'::jsonb)
  into result from public.reviews review join public.profiles profile on profile.id=review.user_id join public.products product on product.id=review.product_id;
  return result;
end; $$;
revoke all on function public.admin_list_reviews() from public,anon;
grant execute on function public.admin_list_reviews() to authenticated,service_role;
