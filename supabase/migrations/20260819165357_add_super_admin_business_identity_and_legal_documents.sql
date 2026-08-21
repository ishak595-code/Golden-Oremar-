create or replace function private.super_admin_get_business_identity_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare settings public.brand_settings%rowtype;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('legalName',settings.legal_name,'supportEmail',settings.support_email,'supportPhone',settings.support_phone,'updatedAt',settings.updated_at);
end;
$function$;

create or replace function private.super_admin_update_business_identity_v1(p_legal_name text,p_support_email text,p_support_phone text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); legal_name_value text:=btrim(coalesce(p_legal_name,'')); email_value text:=lower(btrim(coalesce(p_support_email,''))); phone_value text:=btrim(coalesce(p_support_phone,'')); digits text; next_config jsonb; updated public.brand_settings%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if char_length(legal_name_value) not between 2 and 240 then raise exception 'invalid_legal_name' using errcode='22023'; end if;
  if char_length(email_value) not between 5 and 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_support_email' using errcode='22023'; end if;
  if char_length(phone_value) not between 7 and 40 or phone_value !~ '^[+()0-9 .-]+$' then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  digits:=regexp_replace(phone_value,'[^0-9]','','g');
  if char_length(digits) not between 10 and 15 then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  select public_config into next_config from public.brand_settings where slug='golden-oremar' for update;
  if next_config is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  next_config:=jsonb_set(next_config,'{contactInfo,email}',to_jsonb(email_value),true);
  next_config:=jsonb_set(next_config,'{contactInfo,phone}',to_jsonb(phone_value),true);
  update public.brand_settings set legal_name=legal_name_value,support_email=email_value,support_phone=phone_value,public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar' returning * into updated;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'brand.business_identity_updated','brand_settings','golden-oremar',jsonb_build_object('legalNameConfigured',true,'supportEmailConfigured',true,'supportPhoneConfigured',true));
  return jsonb_build_object('legalName',updated.legal_name,'supportEmail',updated.support_email,'supportPhone',updated.support_phone,'updatedAt',updated.updated_at);
end;
$function$;

create or replace function private.super_admin_list_legal_documents_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'locale',c.locale,'title',c.title,'summary',c.summary,'markdown',c.body_markdown,'status',c.status,'publishedAt',c.published_at,'updatedAt',c.updated_at) order by c.slug,c.locale),'[]'::jsonb)
  into result from public.content_entries c
  where c.content_type='legal' and c.slug in ('about','returns','privacy','terms') and c.deleted_at is null;
  return jsonb_build_object('ok',true,'items',result);
end;
$function$;

create or replace function private.super_admin_upsert_legal_document_v1(p_slug text,p_locale text,p_title text,p_summary text,p_markdown text,p_status text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); slug_value text:=lower(btrim(coalesce(p_slug,''))); locale_value text:=lower(btrim(coalesce(p_locale,''))); title_value text:=btrim(coalesce(p_title,'')); summary_value text:=btrim(coalesce(p_summary,'')); markdown_value text:=btrim(coalesce(p_markdown,'')); status_value text:=lower(btrim(coalesce(p_status,''))); row_value public.content_entries%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if slug_value not in ('about','returns','privacy','terms') then raise exception 'invalid_legal_slug' using errcode='22023'; end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then raise exception 'invalid_legal_locale' using errcode='22023'; end if;
  if char_length(title_value) not between 2 and 240 then raise exception 'invalid_legal_title' using errcode='22023'; end if;
  if char_length(summary_value)>2000 or char_length(markdown_value)>200000 then raise exception 'legal_document_too_large' using errcode='22023'; end if;
  if status_value not in ('draft','published') then raise exception 'invalid_legal_status' using errcode='22023'; end if;
  if status_value='published' and char_length(markdown_value)<100 then raise exception 'legal_document_too_short_to_publish' using errcode='22023'; end if;
  insert into public.content_entries(content_type,slug,title,summary,body_markdown,body_html_sanitized,author_user_id,status,locale,published_at,metadata,updated_at,deleted_at)
  values('legal',slug_value,title_value,summary_value,markdown_value,'',caller_id,status_value,locale_value,case when status_value='published' then timezone('utc',now()) else null end,jsonb_build_object('managedBy','super_admin_legal_v1'),timezone('utc',now()),null)
  on conflict(content_type,slug,locale) do update set title=excluded.title,summary=excluded.summary,body_markdown=excluded.body_markdown,body_html_sanitized='',author_user_id=caller_id,status=excluded.status,published_at=case when excluded.status='published' then coalesce(public.content_entries.published_at,timezone('utc',now())) else null end,metadata=public.content_entries.metadata||jsonb_build_object('managedBy','super_admin_legal_v1'),updated_at=timezone('utc',now()),deleted_at=null
  returning * into row_value;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'content.legal_document_upserted','content_entry',row_value.id,jsonb_build_object('slug',slug_value,'locale',locale_value,'status',status_value));
  return jsonb_build_object('id',row_value.id,'slug',row_value.slug,'locale',row_value.locale,'title',row_value.title,'summary',row_value.summary,'markdown',row_value.body_markdown,'status',row_value.status,'publishedAt',row_value.published_at,'updatedAt',row_value.updated_at);
end;
$function$;

create or replace function private.get_account_help_content_v1(p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare locale_value text:=lower(btrim(coalesce(p_locale,'tr'))); result jsonb;
begin
  if locale_value not in ('tr','en','de','fr','ku','ar') then locale_value:='tr'; end if;
  with canonical as (
    select wanted.key_name,entry.*
    from (values ('about'::text),('returns'::text),('privacy'::text),('terms'::text)) wanted(key_name)
    left join lateral (
      select c.id,c.slug,c.title,c.summary,c.body_markdown,c.body_html_sanitized,c.hero_image_path,c.locale,c.published_at,c.updated_at
      from public.content_entries c
      where c.deleted_at is null and c.status='published' and c.content_type='legal' and c.slug=wanted.key_name and c.locale in (locale_value,'tr')
      order by case when c.locale=locale_value then 0 else 1 end,c.published_at desc nulls last,c.updated_at desc
      limit 1
    ) entry on true
  )
  select jsonb_object_agg(key_name,case when id is null then null else jsonb_build_object('id',id,'slug',slug,'title',title,'summary',summary,'markdown',body_markdown,'sanitizedHtml',body_html_sanitized,'heroImagePath',hero_image_path,'locale',locale,'publishedAt',published_at,'updatedAt',updated_at) end)
  into result from canonical;
  return coalesce(result,'{}'::jsonb);
end;
$function$;

revoke all on function private.super_admin_get_business_identity_v1() from public,anon;
revoke all on function private.super_admin_update_business_identity_v1(text,text,text) from public,anon;
revoke all on function private.super_admin_list_legal_documents_v1() from public,anon;
revoke all on function private.super_admin_upsert_legal_document_v1(text,text,text,text,text,text) from public,anon;
grant execute on function private.super_admin_get_business_identity_v1() to authenticated;
grant execute on function private.super_admin_update_business_identity_v1(text,text,text) to authenticated;
grant execute on function private.super_admin_list_legal_documents_v1() to authenticated;
grant execute on function private.super_admin_upsert_legal_document_v1(text,text,text,text,text,text) to authenticated;

create or replace function public.super_admin_get_business_identity_v1() returns jsonb language sql stable security invoker set search_path to '' as $function$ select private.super_admin_get_business_identity_v1(); $function$;
create or replace function public.super_admin_update_business_identity_v1(p_legal_name text,p_support_email text,p_support_phone text) returns jsonb language sql security invoker set search_path to '' as $function$ select private.super_admin_update_business_identity_v1(p_legal_name,p_support_email,p_support_phone); $function$;
create or replace function public.super_admin_list_legal_documents_v1() returns jsonb language sql stable security invoker set search_path to '' as $function$ select private.super_admin_list_legal_documents_v1(); $function$;
create or replace function public.super_admin_upsert_legal_document_v1(p_slug text,p_locale text,p_title text,p_summary text,p_markdown text,p_status text) returns jsonb language sql security invoker set search_path to '' as $function$ select private.super_admin_upsert_legal_document_v1(p_slug,p_locale,p_title,p_summary,p_markdown,p_status); $function$;

revoke all on function public.super_admin_get_business_identity_v1() from public,anon;
revoke all on function public.super_admin_update_business_identity_v1(text,text,text) from public,anon;
revoke all on function public.super_admin_list_legal_documents_v1() from public,anon;
revoke all on function public.super_admin_upsert_legal_document_v1(text,text,text,text,text,text) from public,anon;
grant execute on function public.super_admin_get_business_identity_v1() to authenticated;
grant execute on function public.super_admin_update_business_identity_v1(text,text,text) to authenticated;
grant execute on function public.super_admin_list_legal_documents_v1() to authenticated;
grant execute on function public.super_admin_upsert_legal_document_v1(text,text,text,text,text,text) to authenticated;
