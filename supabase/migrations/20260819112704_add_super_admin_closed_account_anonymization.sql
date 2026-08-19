create or replace function private.super_admin_anonymize_closed_user_v1(p_user_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  caller_id uuid:=auth.uid();
  reason_value text:=btrim(coalesce(p_reason,''));
  profile_row public.profiles%rowtype;
  open_orders integer;
  open_returns integer;
  avatar_path text;
  review_media jsonb;
  anon_email text;
begin
  if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_user_id=caller_id then raise exception 'cannot_anonymize_current_user' using errcode='42501'; end if;
  if char_length(reason_value) not between 8 and 1000 then raise exception 'anonymization_reason_required' using errcode='22023'; end if;
  select * into profile_row from public.profiles where id=p_user_id for update;
  if profile_row.id is null then raise exception 'user_not_found' using errcode='P0002'; end if;
  if profile_row.status<>'deleted' then raise exception 'account_must_be_closed_before_anonymization' using errcode='55000'; end if;
  if exists(select 1 from private.user_roles where user_id=p_user_id and role in ('admin','super_admin')) then raise exception 'privileged_account_cannot_be_anonymized_here' using errcode='42501'; end if;
  select count(*)::integer into open_orders from public.orders where user_id=p_user_id and status not in ('completed','cancelled','refunded');
  select count(*)::integer into open_returns from public.return_requests where user_id=p_user_id and status not in ('rejected','refunded','closed');
  if open_orders>0 or open_returns>0 then raise exception 'open_commerce_records_prevent_anonymization' using errcode='55000'; end if;
  avatar_path:=profile_row.avatar_path;
  select coalesce(jsonb_agg(path),'[]'::jsonb) into review_media from (select unnest(media_paths) path from public.reviews where user_id=p_user_id) media;
  delete from public.addresses where user_id=p_user_id;
  delete from public.favorites where user_id=p_user_id;
  delete from public.carts where user_id=p_user_id;
  delete from public.notifications where user_id=p_user_id;
  delete from private.content_favorites where user_id=p_user_id;
  delete from private.producer_follows where user_id=p_user_id;
  delete from private.stock_alert_subscriptions where user_id=p_user_id;
  delete from private.user_app_preferences where user_id=p_user_id;
  delete from private.user_notification_preferences where user_id=p_user_id;
  delete from private.newsletter_subscriptions where user_id=p_user_id;
  delete from private.customer_payment_methods where user_id=p_user_id;
  delete from private.payment_provider_customers where user_id=p_user_id;
  delete from private.order_payment_preferences where user_id=p_user_id;
  delete from private.device_push_tokens where user_id=p_user_id;
  delete from private.push_deliveries where user_id=p_user_id;
  delete from private.contact_messages where user_id=p_user_id;
  delete from private.user_security_contexts where user_id=p_user_id;
  delete from private.user_roles where user_id=p_user_id;
  update public.event_reservations set guest_name='Silinmiş Kullanıcı',guest_email='deleted-'||substr(p_user_id::text,1,8)||'@invalid.local',guest_phone='0000000000',notes=null,updated_at=timezone('utc',now()) where user_id=p_user_id;
  update public.reviews set media_paths='{}'::text[],updated_at=timezone('utc',now()) where user_id=p_user_id;
  update public.profiles set display_name='Silinmiş Kullanıcı',avatar_path=null,phone=null,marketing_consent=false,marketing_consent_at=null,last_seen_at=null,updated_at=timezone('utc',now()) where id=p_user_id;
  delete from auth.refresh_tokens where user_id=p_user_id::text;
  delete from auth.sessions where user_id=p_user_id;
  delete from auth.identities where user_id=p_user_id;
  anon_email:='deleted+'||replace(p_user_id::text,'-','')||'@invalid.local';
  update auth.users set email=anon_email,phone=null,banned_until='infinity'::timestamptz,raw_user_meta_data='{}'::jsonb,updated_at=timezone('utc',now()) where id=p_user_id;
  insert into private.account_enforcement_events(user_id,actor_user_id,action,reason,metadata)
    values(p_user_id,caller_id,'anonymized',reason_value,jsonb_build_object('ordersPreserved',(select count(*) from public.orders where user_id=p_user_id),'paymentsPreserved',(select count(*) from public.payment_records where user_id=p_user_id),'reviewsPreserved',(select count(*) from public.reviews where user_id=p_user_id)));
  return jsonb_build_object('id',p_user_id,'status','anonymized','avatarPath',avatar_path,'reviewMediaPaths',review_media,'ordersPreserved',(select count(*) from public.orders where user_id=p_user_id),'paymentsPreserved',(select count(*) from public.payment_records where user_id=p_user_id));
end;
$function$;

create or replace function public.super_admin_anonymize_closed_user_v1(p_user_id uuid,p_reason text)
returns jsonb language sql set search_path='' as $function$select private.super_admin_anonymize_closed_user_v1(p_user_id,p_reason);$function$;
revoke all on function public.super_admin_anonymize_closed_user_v1(uuid,text) from public,anon;
grant execute on function public.super_admin_anonymize_closed_user_v1(uuid,text) to authenticated;
