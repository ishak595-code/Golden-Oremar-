insert into private.permissions(permission_key,domain,description,is_active,created_at,updated_at)
values
 ('product.publish','product','Satıcı ürününü veya onaylanmış ürün değişikliğini public yayına açan nihai owner imzası.',true,timezone('utc',now()),timezone('utc',now())),
 ('product.health_manage','product','Ürün sağlık, besin, alerjen, saklama ve tarif paketini inceleme, düzenleme, yayınlama veya reddetme yetkisi.',true,timezone('utc',now()),timezone('utc',now()))
on conflict(permission_key) do update
set domain=excluded.domain,description=excluded.description,is_active=true,updated_at=timezone('utc',now());

delete from private.role_permissions
where permission_key in ('product.publish','product.health_manage') and role<>'super_admin';
insert into private.role_permissions(role,permission_key)
values ('super_admin','product.publish'),('super_admin','product.health_manage')
on conflict(role,permission_key) do nothing;

create or replace function private.enforce_super_admin_product_publication_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  exposure_requested boolean:=false;
begin
  if new.status='published' and new.is_active=true then
    if tg_op='INSERT' then exposure_requested:=true;
    else exposure_requested:=old.status is distinct from 'published' or old.is_active is distinct from true;
    end if;
  end if;
  if not exposure_requested then return new; end if;
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
    jsonb_build_object('gate','product.publish','healthPackageVerified',true),null
  );
  return new;
end;
$$;

drop trigger if exists enforce_super_admin_product_publication_v1 on public.products;
create trigger enforce_super_admin_product_publication_v1
before insert or update of status,is_active on public.products
for each row execute function private.enforce_super_admin_product_publication_v1();

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
  if not exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.is_active=true and p.deleted_at is null) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='UPDATE' then
    remains_valid:=new.related_product_id=product_id and new.content_type='product_health' and new.locale='tr' and new.status='published' and new.deleted_at is null;
  end if;
  if not remains_valid then raise exception 'active_product_health_content_cannot_be_removed' using errcode='55000'; end if;
  return new;
end;
$$;

drop trigger if exists protect_active_product_health_content_v1 on public.content_entries;
create trigger protect_active_product_health_content_v1
before update of related_product_id,content_type,locale,status,deleted_at or delete on public.content_entries
for each row execute function private.protect_active_product_health_content_v1();

create or replace function private.admin_review_product_v4(p_product_id uuid,p_approve boolean,p_reason text,p_ownership_checked boolean,p_image_checked boolean,p_scope_checked boolean,p_origin_checked boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); result jsonb; editorial_result jsonb;
begin
  if caller_id is null or not coalesce(private.has_permission('product.moderate'),false) then raise exception 'permission_required:product.moderate' using errcode='42501'; end if;
  if coalesce(p_approve,false) then
    if not private.has_permission('product.approve') then raise exception 'permission_required:product.approve' using errcode='42501'; end if;
    if not private.has_permission('product.publish') then raise exception 'permission_required:product.publish' using errcode='42501'; end if;
  elsif not private.has_permission('product.reject') then raise exception 'permission_required:product.reject' using errcode='42501'; end if;
  if coalesce(p_approve,false) and not exists(select 1 from private.product_editorial_drafts d where d.product_id=p_product_id and d.locale='tr' and d.status='review') then raise exception 'product_editorial_review_required' using errcode='55000'; end if;
  if coalesce(p_approve,false) and not exists(select 1 from public.content_entries e where e.related_product_id=p_product_id and e.content_type='product_health' and e.locale='tr' and e.status='published' and e.deleted_at is null) then raise exception 'published_product_health_required' using errcode='55000'; end if;
  result:=private.admin_review_product_v3(p_product_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked);
  editorial_result:=private.review_product_editorial_with_product_v1(p_product_id,p_approve,p_reason,caller_id);
  return result||jsonb_build_object('editorialReview',editorial_result);
end;
$$;

create or replace function private.admin_review_product_change_v3(p_change_request_id uuid,p_approve boolean,p_reason text,p_ownership_checked boolean,p_image_checked boolean,p_scope_checked boolean,p_origin_checked boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); product_id uuid; result jsonb; editorial_result jsonb;
begin
  if caller_id is null or not coalesce(private.has_permission('product.moderate'),false) then raise exception 'permission_required:product.moderate' using errcode='42501'; end if;
  if coalesce(p_approve,false) then
    if not private.has_permission('product.approve') then raise exception 'permission_required:product.approve' using errcode='42501'; end if;
    if not private.has_permission('product.publish') then raise exception 'permission_required:product.publish' using errcode='42501'; end if;
  elsif not private.has_permission('product.reject') then raise exception 'permission_required:product.reject' using errcode='42501'; end if;
  select cr.product_id into product_id from public.product_change_requests cr where cr.id=p_change_request_id and cr.status='pending';
  if product_id is null then raise exception 'pending_product_change_not_found' using errcode='P0002'; end if;
  if coalesce(p_approve,false) and not exists(select 1 from private.product_editorial_drafts d where d.product_id=product_id and d.locale='tr' and d.status='review') then raise exception 'product_editorial_review_required' using errcode='55000'; end if;
  if coalesce(p_approve,false) and not exists(select 1 from public.content_entries e where e.related_product_id=product_id and e.content_type='product_health' and e.locale='tr' and e.status='published' and e.deleted_at is null) then raise exception 'published_product_health_required' using errcode='55000'; end if;
  result:=private.admin_review_product_change_v2(p_change_request_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked);
  editorial_result:=private.review_product_editorial_with_product_v1(product_id,p_approve,p_reason,caller_id);
  return result||jsonb_build_object('editorialReview',editorial_result);
end;
$$;

revoke all on function private.admin_review_product_v1(uuid,boolean,text) from public,anon,authenticated;
revoke all on function private.admin_review_product_v2(uuid,boolean,text) from public,anon,authenticated;
revoke all on function private.admin_review_product_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function private.admin_review_product_change_v1(uuid,boolean,text) from public,anon,authenticated;
revoke all on function private.admin_review_product_change_v2(uuid,boolean,text,boolean,boolean,boolean,boolean) from public,anon,authenticated;

create or replace function private.super_admin_list_product_health_changes_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or not private.has_permission('product.health_manage') then raise exception 'super_admin_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'productId',r.product_id,'productName',p.name,'productSlug',p.slug,'producerId',producer.id,'producerName',producer.display_name,'proposedBy',r.proposed_by,'payload',r.payload,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at),'[]'::jsonb) into result
 from private.product_health_change_requests r join public.products p on p.id=r.product_id join public.producers producer on producer.id=p.producer_id where r.status='pending';
 return result;
end;
$$;

create or replace function private.super_admin_get_product_health_editor_v1(p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); p public.products%rowtype; producer public.producers%rowtype; entry public.content_entries%rowtype; requests jsonb;
begin
 if uid is null or not private.has_permission('product.health_manage') then raise exception 'super_admin_required' using errcode='42501'; end if;
 select * into p from public.products where id=p_product_id and deleted_at is null; if p.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
 select * into producer from public.producers where id=p.producer_id;
 select * into entry from public.content_entries where related_product_id=p_product_id and content_type='product_health' and locale='tr' and status='published' and deleted_at is null order by updated_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'proposedBy',r.proposed_by,'payload',r.payload,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at),'[]'::jsonb) into requests from private.product_health_change_requests r where r.product_id=p_product_id and r.locale='tr' and r.status='pending';
 return jsonb_build_object('productId',p.id,'productName',p.name,'productStatus',p.status,'producerId',producer.id,'producerName',producer.display_name,'canPublish',true,'published',case when entry.id is null then null else jsonb_build_object('contentId',entry.id,'summary',entry.summary,'productInfo',coalesce(entry.metadata->'productInfoV1','{}'::jsonb),'safety',coalesce(entry.metadata->'safetyV2','{}'::jsonb),'recipe',coalesce(entry.metadata->'recipeV1','{}'::jsonb),'updatedAt',entry.updated_at) end,'requests',requests);
end;
$$;

create or replace function private.super_admin_publish_product_health_v1(p_product_id uuid,p_payload jsonb,p_review_note text default null,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); p public.products%rowtype; clean jsonb; entry public.content_entries%rowtype; old_meta jsonb:='{}'::jsonb; slug_value text; request_row private.product_health_change_requests%rowtype;
begin
 if uid is null or not private.has_permission('product.health_manage') then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_review_note is not null and char_length(btrim(p_review_note))>2000 then raise exception 'invalid_review_note' using errcode='22023'; end if;
 select * into p from public.products where id=p_product_id and deleted_at is null; if p.id is null then raise exception 'product_not_found' using errcode='P0002'; end if; clean:=private.validate_product_health_payload_v1(p_payload);
 if p_request_id is not null then select * into request_row from private.product_health_change_requests where id=p_request_id and product_id=p_product_id and status='pending' for update; if request_row.id is null then raise exception 'product_health_request_not_found' using errcode='P0002'; end if; end if;
 select * into entry from public.content_entries where related_product_id=p_product_id and content_type='product_health' and locale='tr' and deleted_at is null order by case when status='published' then 0 else 1 end,updated_at desc limit 1 for update;
 if entry.id is null then
   slug_value:='product-health-'||p.slug; if exists(select 1 from public.content_entries where content_type='product_health' and locale='tr' and slug=slug_value) then slug_value:=slug_value||'-'||substr(gen_random_uuid()::text,1,8); end if;
   insert into public.content_entries(content_type,slug,title,summary,body_markdown,body_html_sanitized,author_user_id,related_product_id,status,locale,metadata,published_at)
   values('product_health',slug_value,p.name||' - ürün bilgileri',clean->>'summary','','',uid,p.id,'published','tr',jsonb_build_object('safetyV2',clean->'safety','productInfoV1',clean->'productInfo','recipeV1',clean->'recipe'),timezone('utc',now())) returning * into entry;
 else
   old_meta:=coalesce(entry.metadata,'{}'::jsonb);
   update public.content_entries set title=p.name||' - ürün bilgileri',summary=clean->>'summary',metadata=(old_meta-'safetyV2'-'productInfoV1'-'recipeV1')||jsonb_build_object('safetyV2',(coalesce(old_meta->'safetyV2','{}'::jsonb)||clean->'safety'),'productInfoV1',clean->'productInfo','recipeV1',clean->'recipe'),status='published',published_at=timezone('utc',now()),author_user_id=uid,deleted_at=null where id=entry.id returning * into entry;
 end if;
 if request_row.id is not null then update private.product_health_change_requests set status='approved',reviewed_by=uid,reviewed_at=timezone('utc',now()),review_note=nullif(btrim(coalesce(p_review_note,'')),''),updated_at=timezone('utc',now()) where id=request_row.id; end if;
 perform private.write_admin_audit_v2('product_health.publish','product',p.id::text,null,jsonb_build_object('contentId',entry.id,'status','published'),jsonb_build_object('requestId',request_row.id,'reviewNoteProvided',nullif(btrim(coalesce(p_review_note,'')),'') is not null),null);
 return jsonb_build_object('productId',p.id,'contentId',entry.id,'status','published','requestId',request_row.id,'updatedAt',entry.updated_at);
end;
$$;

create or replace function private.super_admin_reject_product_health_change_v1(p_request_id uuid,p_review_note text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); changed integer; note text:=btrim(coalesce(p_review_note,'')); product_id_value uuid;
begin
 if uid is null or not private.has_permission('product.health_manage') then raise exception 'super_admin_required' using errcode='42501'; end if;
 if char_length(note) not between 10 and 2000 then raise exception 'product_health_review_note_required' using errcode='22023'; end if;
 update private.product_health_change_requests set status='rejected',reviewed_by=uid,reviewed_at=timezone('utc',now()),review_note=note,updated_at=timezone('utc',now()) where id=p_request_id and status='pending' returning product_id into product_id_value;
 get diagnostics changed=row_count; if changed=0 then raise exception 'product_health_request_not_found' using errcode='P0002'; end if;
 perform private.write_admin_audit_v2('product_health.reject','product',product_id_value::text,null,jsonb_build_object('requestId',p_request_id,'status','rejected'),jsonb_build_object('requestId',p_request_id,'reasonLength',char_length(note)),null);
 return true;
end;
$$;

create or replace function public.authorization_policy_self_test_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare permission_count integer; role_count integer;
begin
 select count(*) into permission_count from private.permissions where is_active=true;
 select count(distinct role) into role_count from private.role_permissions;
 if permission_count<60 or role_count<>8 then raise exception 'authorization_contract_invalid' using errcode='55000'; end if;
 if exists(select 1 from private.role_permissions where role='moderator' and permission_key in ('refund.execute','payout.release','role.manage','system.configure','payment.manage','security.manage','finance.manage','user.erase','product.remove','product.publish','product.health_manage')) then raise exception 'moderator_privilege_escalation' using errcode='55000'; end if;
 if exists(select 1 from private.role_permissions where role='support' and permission_key in ('refund.execute','payout.release','role.manage','system.configure','payment.manage','security.manage','product.publish','product.health_manage')) then raise exception 'support_privilege_escalation' using errcode='55000'; end if;
 if exists(select 1 from private.role_permissions where role='operations' and permission_key in ('refund.execute','payout.release','role.manage','system.configure','payment.manage','security.manage','user.erase','product.remove','product.publish','product.health_manage')) then raise exception 'operations_privilege_escalation' using errcode='55000'; end if;
 if exists(select 1 from private.role_permissions where role='admin' and permission_key in ('payout.release','role.manage','system.configure','payment.manage','security.manage','user.erase','product.remove','product.publish','product.health_manage')) then raise exception 'admin_privilege_escalation' using errcode='55000'; end if;
 if exists(select 1 from private.role_permissions where role<>'super_admin' and permission_key in ('product.publish','product.health_manage')) then raise exception 'owner_only_product_capability_leak' using errcode='55000'; end if;
 if exists(select 1 from private.role_permissions where role in ('customer','producer') and permission_key='admin.access') then raise exception 'customer_or_producer_admin_access' using errcode='55000'; end if;
 if exists(select 1 from private.permissions p where p.is_active=true and not exists(select 1 from private.role_permissions rp where rp.role='super_admin' and rp.permission_key=p.permission_key)) then raise exception 'super_admin_missing_permission' using errcode='55000'; end if;
 return jsonb_build_object('ok',true,'permissionCount',permission_count,'roleCount',role_count);
end;
$$;

create or replace function public.authorization_enforcement_self_test_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare policy jsonb; checks jsonb; ok boolean;
begin
 policy:=public.authorization_policy_self_test_v1();
 checks:=jsonb_build_object(
  'policyMatrix',coalesce((policy->>'ok')::boolean,false),
  'roleGovernance',private.authorization_function_mentions_v1('private.admin_set_platform_user_role_v2(uuid,text,text)',array['role.manage','cannot_change_current_user_role']),
  'userTargetOwnerGuard',private.authorization_function_mentions_v1('private.admin_set_platform_user_status_v1(uuid,text,text)',array['user.manage','role.manage']),
  'refundExecution',private.authorization_function_mentions_v1('private.admin_record_manual_refund_v1(uuid,uuid,text,bigint,text)',array['refund.execute']),
  'payoutSeparation',private.authorization_function_mentions_v1('private.admin_update_producer_payout_v1(uuid,text,text,text,text)',array['payout.review','payout.release']),
  'productModeration',private.authorization_function_mentions_v1('private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean)',array['product.moderate','product.approve','product.reject','product.publish','published_product_health_required']),
  'productHealthOwnerOnly',private.authorization_function_mentions_v1('private.super_admin_publish_product_health_v1(uuid,jsonb,text,uuid)',array['product.health_manage']) and private.authorization_function_mentions_v1('private.super_admin_reject_product_health_change_v1(uuid,text)',array['product.health_manage']),
  'productPublishTrigger',exists(select 1 from pg_trigger where tgrelid='public.products'::regclass and tgname='enforce_super_admin_product_publication_v1' and not tgisinternal),
  'sellerReview',private.authorization_function_mentions_v1('private.admin_review_producer_application_v3(uuid,text,text,integer)',array['seller.review','seller.approve','seller.reject','seller.request_information']),
  'producerOwnership',private.authorization_function_mentions_v1('private.producer_archive_product_v1(text)',array['product.archive','product.producer_id=caller_producer_id','product_access_denied']),
  'settlementRelease',private.authorization_function_mentions_v1('private.prepare_order_settlement_for_service_v1(uuid,uuid)',array['user_has_permission_v1','payout.release']),
  'adminShell',private.authorization_function_mentions_v1('private.admin_session_status_impl_v1()',array['admin.access','moderator','support']),
  'dashboardAnalytics',private.authorization_function_mentions_v1('private.admin_operations_overview_v2()',array['analytics.read']),
  'breakGlassServiceOnly',private.authorization_function_mentions_v1('private.bootstrap_super_admin_v1(uuid,text)',array['service_role','super_admin_already_configured','pg_advisory_xact_lock']),
  'lastSuperAdminTrigger',exists(select 1 from pg_trigger where tgrelid='private.user_roles'::regclass and tgname='protect_last_super_admin_role_v1' and not tgisinternal),
  'legacyReviewWriteRetired',to_regprocedure('public.admin_set_review_status(uuid,text)') is null,
  'activeSuperAdminPresent',private.active_super_admin_count_v1()>=1
 );
 select bool_and((entry.value)::text='true') into ok from jsonb_each(checks) entry;
 return jsonb_build_object('ok',coalesce(ok,false),'checks',checks,'policy',policy);
end;
$$;
