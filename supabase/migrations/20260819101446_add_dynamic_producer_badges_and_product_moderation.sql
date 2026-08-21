alter table public.producers
  add column if not exists trust_badge_status text not null default 'none',
  add column if not exists trust_badge_granted_at timestamptz,
  add column if not exists trust_badge_review_due_at timestamptz,
  add column if not exists trust_badge_revoked_at timestamptz,
  add column if not exists trust_badge_reason text;

do $$ begin
  alter table public.producers add constraint producers_trust_badge_status_check
    check (trust_badge_status in ('none','active','revoked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.producers add constraint producers_trust_badge_reason_length_check
    check (trust_badge_reason is null or char_length(trust_badge_reason) <= 1000);
exception when duplicate_object then null; end $$;

create table if not exists private.producer_trust_badge_events (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('granted','revoked','auto_revoked')),
  reason text not null check (char_length(reason) between 10 and 1000),
  review_due_at timestamptz,
  created_at timestamptz not null default timezone('utc',now())
);
create index if not exists producer_trust_badge_events_producer_created_idx on private.producer_trust_badge_events(producer_id,created_at desc);

create or replace function private.is_producer_trust_badge_active_v1(p_producer_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select coalesce((
    select p.status='active'
      and p.is_verified=true
      and p.origin_verified=true
      and p.trust_badge_status='active'
      and (p.trust_badge_review_due_at is null or p.trust_badge_review_due_at > timezone('utc',now()))
      and p.deleted_at is null
    from public.producers p where p.id=p_producer_id
  ),false);
$$;

create or replace function private.admin_set_producer_trust_badge_v1(
  p_producer_id uuid,
  p_active boolean,
  p_reason text,
  p_review_due_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  producer public.producers%rowtype;
  clean_reason text:=btrim(coalesce(p_reason,''));
  review_due timestamptz;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_active is null then raise exception 'trust_badge_state_required' using errcode='22023'; end if;
  if char_length(clean_reason) not between 10 and 1000 then raise exception 'trust_badge_reason_required' using errcode='22023'; end if;
  select * into producer from public.producers where id=p_producer_id and deleted_at is null for update;
  if producer.id is null then raise exception 'producer_profile_not_found' using errcode='P0002'; end if;

  if p_active then
    if producer.status<>'active' or not producer.is_verified or not producer.origin_verified then
      raise exception 'producer_not_trust_badge_eligible' using errcode='55000';
    end if;
    review_due:=coalesce(p_review_due_at,producer.verification_due_at,timezone('utc',now())+interval '365 days');
    if review_due<=timezone('utc',now()) then raise exception 'trust_badge_review_due_must_be_future' using errcode='22023'; end if;
    update public.producers set
      trust_badge_status='active',trust_badge_granted_at=timezone('utc',now()),trust_badge_review_due_at=review_due,
      trust_badge_revoked_at=null,trust_badge_reason=clean_reason,updated_at=timezone('utc',now())
    where id=producer.id;
    insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
    values(producer.id,caller_id,'granted',clean_reason,review_due);
  else
    update public.producers set
      trust_badge_status='revoked',trust_badge_revoked_at=timezone('utc',now()),trust_badge_reason=clean_reason,updated_at=timezone('utc',now())
    where id=producer.id;
    insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
    values(producer.id,caller_id,'revoked',clean_reason,producer.trust_badge_review_due_at);
  end if;

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(producer.owner_user_id,'producer',
    case when p_active then 'Doğrulanmış Üretici rozeti verildi' else 'Doğrulanmış Üretici rozeti kaldırıldı' end,
    case when p_active then 'Golden Oremar doğrulama rozetiniz aktif edildi.' else clean_reason end,
    '/?tab=account',jsonb_build_object('producer_id',producer.id,'trust_badge_active',p_active,'review_due_at',review_due,'reason',clean_reason));

  return jsonb_build_object('producer_id',producer.id,'active',p_active,'status',case when p_active then 'active' else 'revoked' end,'review_due_at',review_due,'reason',clean_reason);
end;
$$;

create or replace function public.admin_set_producer_trust_badge_v1(p_producer_id uuid,p_active boolean,p_reason text,p_review_due_at timestamptz default null)
returns jsonb language sql set search_path=''
as $$ select private.admin_set_producer_trust_badge_v1(p_producer_id,p_active,p_reason,p_review_due_at); $$;
revoke all on function public.admin_set_producer_trust_badge_v1(uuid,boolean,text,timestamptz) from public,anon;
grant execute on function public.admin_set_producer_trust_badge_v1(uuid,boolean,text,timestamptz) to authenticated;

create or replace function private.admin_list_producers_v2()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb; result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  base:=private.admin_list_producers_v1();
  select coalesce(jsonb_agg(item||jsonb_build_object(
    'activity_types',p.activity_types,
    'approved_category_slugs',p.approved_category_slugs,
    'trust_badge_status',p.trust_badge_status,
    'trust_badge_active',private.is_producer_trust_badge_active_v1(p.id),
    'trust_badge_granted_at',p.trust_badge_granted_at,
    'trust_badge_review_due_at',p.trust_badge_review_due_at,
    'trust_badge_revoked_at',p.trust_badge_revoked_at,
    'trust_badge_reason',p.trust_badge_reason
  ) order by ordinality),'[]'::jsonb) into result
  from jsonb_array_elements(base) with ordinality rows(item,ordinality)
  join public.producers p on p.id=(item->>'id')::uuid;
  return result;
end;
$$;
create or replace function public.admin_list_producers_v2()
returns jsonb language sql stable set search_path=''
as $$ select private.admin_list_producers_v2(); $$;
revoke all on function public.admin_list_producers_v2() from public,anon;
grant execute on function public.admin_list_producers_v2() to authenticated;

create or replace function private.admin_set_producer_status_v1(p_producer_id uuid,p_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare producer public.producers%rowtype; clean_reason text:=btrim(coalesce(p_reason,'')); caller_id uuid:=auth.uid();
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_status not in ('active','suspended') then raise exception 'invalid_producer_status' using errcode='22023'; end if;
  if p_status='suspended' and char_length(clean_reason)<10 then raise exception 'producer_status_reason_required' using errcode='22023'; end if;
  select * into producer from public.producers where id=p_producer_id and deleted_at is null for update;
  if producer.id is null then raise exception 'producer_profile_not_found' using errcode='P0002'; end if;
  if p_status='active' and not producer.is_verified then raise exception 'producer_not_verified' using errcode='42501'; end if;
  update public.producers set status=p_status,
    trust_badge_status=case when p_status='suspended' and trust_badge_status='active' then 'revoked' else trust_badge_status end,
    trust_badge_revoked_at=case when p_status='suspended' and trust_badge_status='active' then timezone('utc',now()) else trust_badge_revoked_at end,
    trust_badge_reason=case when p_status='suspended' and trust_badge_status='active' then 'Satıcı hesabı askıya alındı: '||clean_reason else trust_badge_reason end,
    updated_at=timezone('utc',now()) where id=producer.id;
  if p_status='suspended' and producer.trust_badge_status='active' then
    insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
    values(producer.id,caller_id,'auto_revoked','Satıcı hesabı askıya alındı: '||clean_reason,producer.trust_badge_review_due_at);
  end if;
  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(producer.owner_user_id,'producer',case when p_status='active' then 'Mağazanız yeniden etkinleştirildi' else 'Mağazanız geçici olarak askıya alındı' end,
    case when p_status='active' then 'Golden Oremar mağazanız yeniden satışa açıldı. Doğrulama rozeti gerekiyorsa yeniden inceleme yapılır.' else clean_reason end,
    '/?tab=account',jsonb_build_object('producer_id',producer.id,'status',p_status,'reason',nullif(clean_reason,'')));
  return jsonb_build_object('id',producer.id,'status',p_status);
end;
$$;

create or replace function private.admin_set_producer_origin_verified_v1(p_producer_id uuid,p_verified boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare producer public.producers%rowtype; clean_reason text:=btrim(coalesce(p_reason,'')); caller_id uuid:=auth.uid();
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_verified is null then raise exception 'verification_state_required' using errcode='22023'; end if;
  if char_length(clean_reason) not between 10 and 1000 then raise exception 'origin_verification_reason_required' using errcode='22023'; end if;
  select * into producer from public.producers where id=p_producer_id and deleted_at is null for update;
  if producer.id is null then raise exception 'producer_profile_not_found' using errcode='P0002'; end if;
  if p_verified and not producer.is_verified then raise exception 'producer_identity_not_verified' using errcode='42501'; end if;
  if p_verified and char_length(btrim(coalesce(producer.production_location,'')))<2 and (producer.production_village is null or producer.production_district is null or producer.production_province is null) then raise exception 'producer_origin_information_required' using errcode='22023'; end if;
  update public.producers set origin_verified=p_verified,origin_verified_at=case when p_verified then timezone('utc',now()) else null end,
    origin_verification_basis=case when p_verified then 'admin_manual_verification' else null end,
    trust_badge_status=case when not p_verified and trust_badge_status='active' then 'revoked' else trust_badge_status end,
    trust_badge_revoked_at=case when not p_verified and trust_badge_status='active' then timezone('utc',now()) else trust_badge_revoked_at end,
    trust_badge_reason=case when not p_verified and trust_badge_status='active' then 'Menşe doğrulaması kaldırıldı: '||clean_reason else trust_badge_reason end,
    updated_at=timezone('utc',now()) where id=p_producer_id;
  if not p_verified and producer.trust_badge_status='active' then
    insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
    values(producer.id,caller_id,'auto_revoked','Menşe doğrulaması kaldırıldı: '||clean_reason,producer.trust_badge_review_due_at);
  end if;
  return jsonb_build_object('producer_id',p_producer_id,'origin_verified',p_verified,'reason',clean_reason);
end;
$$;

create or replace function private.admin_review_producer_application_v3(p_application_id uuid,p_status text,p_reason text,p_commission_basis_points integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); application public.producer_applications%rowtype; result jsonb; producer_id uuid; product_item jsonb; review_due timestamptz;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select * into application from public.producer_applications where id=p_application_id;
  if application.id is null then raise exception 'producer_application_not_found' using errcode='P0002'; end if;
  if p_status='approved' then
    if cardinality(application.activity_types)=0 then raise exception 'producer_activity_required' using errcode='55000'; end if;
    if cardinality(application.product_categories)=0 then raise exception 'producer_category_scope_required' using errcode='55000'; end if;
    if cardinality(application.sourcing_models)=0 or not (application.sourcing_models <@ array['own_production','family_production','cooperative_production']::text[]) then raise exception 'producer_intermediary_source_not_allowed' using errcode='55000'; end if;
    if exists(select 1 from unnest(application.product_categories) slug where not exists(select 1 from public.categories c where c.slug=slug and c.is_active=true)) then raise exception 'invalid_producer_category_scope' using errcode='55000'; end if;
    for product_item in select value from jsonb_array_elements(application.planned_products) loop
      if not (coalesce(product_item->>'category','')=any(application.product_categories)) then raise exception 'planned_product_outside_category_scope' using errcode='55000'; end if;
    end loop;
  end if;
  if p_status='approved' and application.organic_claim_status='certified' then
    if application.organic_certificate_expires_on is null or application.organic_certificate_expires_on<current_date then raise exception 'organic_certificate_expired' using errcode='55000'; end if;
    if not exists(select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='organic_certificate' and d.verification_status='verified') then raise exception 'organic_certificate_document_not_verified' using errcode='55000'; end if;
  end if;
  result:=public.admin_review_producer_application_v2(p_application_id,p_status,p_reason,p_commission_basis_points);
  if p_status='approved' then
    producer_id:=(result->>'producer_id')::uuid;
    if producer_id is not null then
      update public.producers producer set production_country_code=application.production_country_code,production_province=application.production_province,
        production_district=application.production_district,production_village=application.production_village,production_village_is_custom=application.production_village_is_custom,
        production_latitude=application.production_latitude,production_longitude=application.production_longitude,origin_verified=true,origin_verified_at=timezone('utc',now()),
        origin_verification_basis='application_review',activity_types=application.activity_types,approved_category_slugs=application.product_categories,
        trust_badge_status='active',trust_badge_granted_at=timezone('utc',now()),trust_badge_review_due_at=coalesce(producer.verification_due_at,timezone('utc',now())+interval '365 days'),
        trust_badge_revoked_at=null,trust_badge_reason='KYC, üretim menşei, faaliyet alanı ve kategori kapsamı yönetim tarafından onaylandı.',updated_at=timezone('utc',now())
      where producer.id=producer_id returning trust_badge_review_due_at into review_due;
      insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
      values(producer_id,caller_id,'granted','KYC, üretim menşei, faaliyet alanı ve kategori kapsamı yönetim tarafından onaylandı.',review_due);
    end if;
  end if;
  return result;
end;
$$;

create or replace function private.admin_list_products_v3()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb; result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  base:=private.admin_list_products_v2();
  select coalesce(jsonb_agg(item||jsonb_build_object(
    'producer_badge_active',private.is_producer_trust_badge_active_v1(product.producer_id),
    'producer_badge_status',producer.trust_badge_status,
    'category_scope_ready',category.slug=any(producer.approved_category_slugs),
    'origin_matches_producer',lower(btrim(coalesce(product.origin,'')))=lower(btrim(coalesce(producer.production_location,''))),
    'duplicate_name_count',(select count(*) from public.products p2 where p2.id<>product.id and p2.deleted_at is null and lower(btrim(p2.name))=lower(btrim(product.name))),
    'duplicate_primary_image_count',(select count(*) from public.product_images i2 join public.product_images i1 on i1.product_id=product.id and i1.is_primary=true where i2.product_id<>product.id and i2.is_primary=true and i2.storage_path=i1.storage_path),
    'pending_change_count',(select count(*) from public.product_change_requests cr where cr.product_id=product.id and cr.status='pending'),
    'moderation_risk_count',
      (case when not private.is_producer_trust_badge_active_v1(product.producer_id) then 1 else 0 end)
      +(case when not (category.slug=any(producer.approved_category_slugs)) then 1 else 0 end)
      +(case when lower(btrim(coalesce(product.origin,'')))<>lower(btrim(coalesce(producer.production_location,''))) then 1 else 0 end)
      +(case when exists(select 1 from public.product_images i2 join public.product_images i1 on i1.product_id=product.id and i1.is_primary=true where i2.product_id<>product.id and i2.is_primary=true and i2.storage_path=i1.storage_path) then 1 else 0 end)
      +(case when coalesce((item->>'catalog_issue_count')::integer,0)>0 then 1 else 0 end)
  ) order by ordinality),'[]'::jsonb) into result
  from jsonb_array_elements(base) with ordinality rows(item,ordinality)
  join public.products product on product.id=(item->>'id')::uuid
  join public.producers producer on producer.id=product.producer_id
  join public.categories category on category.id=product.category_id;
  return result;
end;
$$;
create or replace function public.admin_list_products_v3()
returns jsonb language sql stable set search_path=''
as $$ select private.admin_list_products_v3(); $$;
revoke all on function public.admin_list_products_v3() from public,anon;
grant execute on function public.admin_list_products_v3() to authenticated;

create or replace function private.admin_review_product_v3(
  p_product_id uuid,p_approve boolean,p_reason text,
  p_ownership_checked boolean,p_image_checked boolean,p_scope_checked boolean,p_origin_checked boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare product_row public.products%rowtype; producer public.producers%rowtype; category_slug text; clean_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select * into product_row from public.products where id=p_product_id and deleted_at is null for update;
  if product_row.id is null or product_row.status not in ('review','rejected') then raise exception 'product_not_reviewable' using errcode='55000'; end if;
  select * into producer from public.producers where id=product_row.producer_id and deleted_at is null;
  select slug into category_slug from public.categories where id=product_row.category_id and is_active=true;
  if coalesce(p_approve,false) then
    if p_ownership_checked is not true or p_image_checked is not true or p_scope_checked is not true or p_origin_checked is not true then raise exception 'product_moderation_checklist_required' using errcode='22023'; end if;
    if not private.is_producer_trust_badge_active_v1(product_row.producer_id) then raise exception 'producer_trust_badge_required' using errcode='55000'; end if;
    if category_slug is null or not (category_slug=any(producer.approved_category_slugs)) then raise exception 'product_category_outside_producer_scope' using errcode='55000'; end if;
    if lower(btrim(coalesce(product_row.origin,'')))<>lower(btrim(coalesce(producer.production_location,''))) then raise exception 'product_origin_mismatch' using errcode='55000'; end if;
  end if;
  return private.admin_review_product_v2(p_product_id,p_approve,clean_reason);
end;
$$;
create or replace function public.admin_review_product_v3(
  p_product_id uuid,p_approve boolean,p_reason text default null,
  p_ownership_checked boolean default false,p_image_checked boolean default false,p_scope_checked boolean default false,p_origin_checked boolean default false
) returns jsonb language sql set search_path=''
as $$ select private.admin_review_product_v3(p_product_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked); $$;
revoke all on function public.admin_review_product_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_review_product_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) to authenticated;

create or replace function private.admin_list_pending_product_changes_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',cr.id,'product_id',cr.product_id,'product_name',p.name,'product_slug',p.slug,'producer_id',cr.producer_id,'producer_name',producer.display_name,
    'producer_badge_active',private.is_producer_trust_badge_active_v1(cr.producer_id),'category_scope_ready',category.slug=any(producer.approved_category_slugs),
    'origin_matches_producer',lower(btrim(coalesce(cr.proposed_payload->>'origin',p.origin,'')))=lower(btrim(coalesce(producer.production_location,''))),
    'proposed_payload',cr.proposed_payload,'created_at',cr.created_at,'updated_at',cr.updated_at
  ) order by cr.created_at asc) from public.product_change_requests cr
  join public.products p on p.id=cr.product_id and p.deleted_at is null
  join public.producers producer on producer.id=cr.producer_id and producer.deleted_at is null
  join public.categories category on category.id=p.category_id
  where cr.status='pending'),'[]'::jsonb);
end;
$$;
create or replace function public.admin_list_pending_product_changes_v1()
returns jsonb language sql stable set search_path=''
as $$ select private.admin_list_pending_product_changes_v1(); $$;
revoke all on function public.admin_list_pending_product_changes_v1() from public,anon;
grant execute on function public.admin_list_pending_product_changes_v1() to authenticated;

create or replace function private.admin_review_product_change_v2(
  p_change_request_id uuid,p_approve boolean,p_reason text,
  p_ownership_checked boolean,p_image_checked boolean,p_scope_checked boolean,p_origin_checked boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare cr public.product_change_requests%rowtype; producer public.producers%rowtype; product public.products%rowtype; proposed_category text;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select * into cr from public.product_change_requests where id=p_change_request_id and status='pending';
  if cr.id is null then raise exception 'pending_product_change_not_found' using errcode='P0002'; end if;
  select * into product from public.products where id=cr.product_id and deleted_at is null;
  select * into producer from public.producers where id=cr.producer_id and deleted_at is null;
  if coalesce(p_approve,false) then
    if p_ownership_checked is not true or p_image_checked is not true or p_scope_checked is not true or p_origin_checked is not true then raise exception 'product_moderation_checklist_required' using errcode='22023'; end if;
    if not private.is_producer_trust_badge_active_v1(cr.producer_id) then raise exception 'producer_trust_badge_required' using errcode='55000'; end if;
    if cr.proposed_payload ? 'category' or cr.proposed_payload ? 'categoryId' then
      select c.slug into proposed_category from public.categories c where c.is_active=true and (c.slug=coalesce(nullif(cr.proposed_payload->>'category',''),cr.proposed_payload->>'categoryId') or c.id::text=coalesce(nullif(cr.proposed_payload->>'categoryId',''),cr.proposed_payload->>'category')) limit 1;
    else
      select c.slug into proposed_category from public.categories c where c.id=product.category_id;
    end if;
    if proposed_category is null or not (proposed_category=any(producer.approved_category_slugs)) then raise exception 'product_category_outside_producer_scope' using errcode='55000'; end if;
    if lower(btrim(coalesce(cr.proposed_payload->>'origin',producer.production_location,'')))<>lower(btrim(coalesce(producer.production_location,''))) then raise exception 'product_origin_mismatch' using errcode='55000'; end if;
  end if;
  return private.admin_review_product_change_v1(p_change_request_id,p_approve,p_reason);
end;
$$;
create or replace function public.admin_review_product_change_v2(
  p_change_request_id uuid,p_approve boolean,p_reason text default null,
  p_ownership_checked boolean default false,p_image_checked boolean default false,p_scope_checked boolean default false,p_origin_checked boolean default false
) returns jsonb language sql set search_path=''
as $$ select private.admin_review_product_change_v2(p_change_request_id,p_approve,p_reason,p_ownership_checked,p_image_checked,p_scope_checked,p_origin_checked); $$;
revoke all on function public.admin_review_product_change_v2(uuid,boolean,text,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_review_product_change_v2(uuid,boolean,text,boolean,boolean,boolean,boolean) to authenticated;

create or replace function private.get_public_producer_profile_v1(p_reference text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare ref text:=btrim(coalesce(p_reference,'')); producer public.producers%rowtype; result jsonb; badge_active boolean;
begin
  if char_length(ref) not between 1 and 160 then raise exception 'invalid_producer_reference' using errcode='22023'; end if;
  select * into producer from public.producers p where p.status='active' and p.is_verified=true and p.deleted_at is null and (p.id::text=ref or p.slug=lower(ref)) limit 1;
  if producer.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  badge_active:=private.is_producer_trust_badge_active_v1(producer.id);
  select jsonb_build_object(
    'id',producer.id,'slug',producer.slug,'display_name',producer.display_name,'description',producer.description,'story',producer.story,
    'logo_path',producer.logo_path,'cover_path',producer.cover_path,'rating_average',producer.rating_average,'rating_count',producer.rating_count,
    'activity_types',producer.activity_types,'verified_badge_active',badge_active,'location_label',producer.production_location,
    'location',jsonb_build_object('country_code',producer.production_country_code,'province',producer.production_province,'district',producer.production_district,'village',producer.production_village),
    'badges',jsonb_build_array(
      jsonb_build_object('key','verified_producer','label','Golden Oremar Doğrulanmış Üretici','active',badge_active),
      jsonb_build_object('key','verified_origin','label','Menşe ve üretim yeri doğrulandı','active',producer.origin_verified and badge_active)
    ),
    'product_count',(select count(*) from public.products p where p.producer_id=producer.id and p.status='published' and p.is_active=true and p.deleted_at is null),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'slug',q.slug,'name',q.name,'short_description',q.short_description,'origin',q.origin,'unit_label',q.unit_label,'currency',q.currency,'featured',q.is_featured,'variant_id',q.variant_id,'variant_name',q.variant_name,'price_minor',q.price_minor,'compare_at_price_minor',q.compare_at_price_minor,'weight_grams',q.weight_grams,'image_path',q.image_path,'stock_mode',q.stock_mode,'available_quantity',q.available_quantity,'available',q.available) order by q.is_featured desc,q.published_at desc nulls last,q.name)
      from (select p.id,p.slug,p.name,p.short_description,p.origin,p.unit_label,p.currency,p.is_featured,p.stock_mode,p.published_at,v.id variant_id,v.name variant_name,v.price_minor,v.compare_at_price_minor,v.weight_grams,
        case when p.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0)) else null end available_quantity,
        case when p.stock_mode in ('tracked','seasonal') then inv.variant_id is not null and greatest(0,inv.available_quantity-inv.reserved_quantity)>0 else true end available,
        (select i.storage_path from public.product_images i where i.product_id=p.id order by i.is_primary desc,i.sort_order,i.created_at limit 1) image_path
        from public.products p join lateral(select pv.* from public.product_variants pv where pv.product_id=p.id and pv.is_active=true order by pv.is_default desc,pv.created_at limit 1)v on true
        left join public.product_inventory inv on inv.variant_id=v.id where p.producer_id=producer.id and p.status='published' and p.is_active=true and p.deleted_at is null order by p.is_featured desc,p.published_at desc nulls last,p.name limit 12)q),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function private.get_public_product_detail_v1(p_reference text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare ref text:=btrim(coalesce(p_reference,'')); product public.products%rowtype; producer public.producers%rowtype; category public.categories%rowtype; result jsonb; badge_active boolean;
begin
  if char_length(ref) not between 1 and 200 then raise exception 'invalid_product_reference' using errcode='22023'; end if;
  select p.* into product from public.products p join public.producers pr on pr.id=p.producer_id
  where (p.id::text=ref or p.legacy_id=ref or p.slug=lower(ref)) and p.status='published' and p.is_active=true and p.deleted_at is null and pr.status='active' and pr.is_verified=true and pr.deleted_at is null limit 1;
  if product.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select * into producer from public.producers where id=product.producer_id;select * into category from public.categories where id=product.category_id and is_active=true;badge_active:=private.is_producer_trust_badge_active_v1(producer.id);
  select jsonb_build_object(
    'id',product.id,'legacyId',product.legacy_id,'slug',product.slug,'name',product.name,'shortDescription',product.short_description,'description',product.description,'story',product.story,
    'origin',product.origin,'unitLabel',product.unit_label,'currency',product.currency,'stockMode',product.stock_mode,'preorderLeadDays',product.preorder_lead_days,'tags',product.tags,'features',product.features,
    'specifications',jsonb_strip_nulls(jsonb_build_object('cutOptions',case when jsonb_typeof(product.specifications->'cutOptions')='array' then product.specifications->'cutOptions' else null end,'preOrderTime',nullif(product.specifications->>'preOrderTime',''),'pricePrefix',nullif(product.specifications->>'pricePrefix',''),'video',nullif(product.specifications->>'video',''))),
    'translations',product.translations,'featured',product.is_featured,'category',jsonb_build_object('id',category.id,'slug',category.slug,'name',category.name),
    'producer',jsonb_build_object('id',producer.id,'slug',producer.slug,'name',producer.display_name,'description',producer.description,'story',producer.story,'logoPath',producer.logo_path,'coverPath',producer.cover_path,'ratingAverage',producer.rating_average,'ratingCount',producer.rating_count,'locationLabel',producer.production_location,'location',jsonb_build_object('countryCode',producer.production_country_code,'province',producer.production_province,'district',producer.production_district,'village',producer.production_village),'verified',badge_active,'originVerified',producer.origin_verified and badge_active),
    'trustBadges',jsonb_build_array(jsonb_build_object('key','verified_producer','label','Golden Oremar Doğrulanmış Üretici','active',badge_active),jsonb_build_object('key','verified_origin','label','Menşe ve üretim yeri doğrulandı','active',producer.origin_verified and badge_active),jsonb_build_object('key','batch_traceable','label','Lot/QR ile izlenebilir','active',exists(select 1 from public.product_batches b where b.product_id=product.id and b.status='released')),jsonb_build_object('key','certified_organic','label','Sertifikalı organik','active',exists(select 1 from public.product_certifications c where c.product_id=product.id and c.status='valid' and lower(c.certificate_type) in ('organic','organic_certificate','certified_organic') and (c.expires_at is null or c.expires_at>=current_date)))),
    'images',coalesce((select jsonb_agg(jsonb_build_object('path',i.storage_path,'alt',i.alt_text,'width',i.width,'height',i.height,'primary',i.is_primary) order by i.is_primary desc,i.sort_order,i.created_at) from public.product_images i where i.product_id=product.id),'[]'::jsonb),
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'name',v.name,'options',coalesce(v.option_values,'{}'::jsonb)-'legacyWeightOptions','priceMinor',v.price_minor,'compareAtPriceMinor',v.compare_at_price_minor,'weightGrams',v.weight_grams,'default',v.is_default,'availableQuantity',case when product.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0)) else null end,'available',case when product.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0))>0 else true end) order by v.is_default desc,v.created_at) from public.product_variants v left join public.product_inventory inv on inv.variant_id=v.id where v.product_id=product.id and v.is_active=true),'[]'::jsonb),
    'reviewSummary',(select jsonb_build_object('count',count(*),'averageRating',coalesce(round(avg(r.rating)::numeric,2),0),'rating1',count(*) filter(where r.rating=1),'rating2',count(*) filter(where r.rating=2),'rating3',count(*) filter(where r.rating=3),'rating4',count(*) filter(where r.rating=4),'rating5',count(*) filter(where r.rating=5)) from public.reviews r where r.product_id=product.id and r.status='published'),
    'certifications',coalesce((select jsonb_agg(jsonb_build_object('type',c.certificate_type,'issuer',c.issuer,'certificateNumber',c.certificate_number,'issuedAt',c.issued_at,'expiresAt',c.expires_at,'verificationUrl',c.verification_url,'status',c.status) order by c.certificate_type,c.issuer) from public.product_certifications c where c.product_id=product.id and c.status='valid' and (c.expires_at is null or c.expires_at>=current_date)),'[]'::jsonb),
    'traceability',jsonb_build_object('hasReleasedBatches',exists(select 1 from public.product_batches b where b.product_id=product.id and b.status='released'),'batches',coalesce((select jsonb_agg(jsonb_build_object('traceCode',b.trace_code,'batchCode',b.batch_code,'variantId',b.variant_id,'harvestDate',b.harvest_date,'productionDate',b.production_date,'packagingDate',b.packaging_date,'bestBeforeDate',b.best_before_date,'productionMethod',b.production_method,'publicNotes',b.public_notes,'origin',jsonb_build_object('countryCode',b.origin_country_code,'province',b.origin_province,'district',b.origin_district,'village',b.origin_village),'releasedAt',b.released_at) order by b.released_at desc,b.created_at desc) from public.product_batches b where b.product_id=product.id and b.status='released'),'[]'::jsonb)),
    'export',jsonb_build_object('status',product.export_status,'countryOfOriginCode',product.country_of_origin_code,'perishable',product.is_perishable,'requiresColdChain',product.requires_cold_chain,'shelfLifeDays',product.shelf_life_days)
  ) into result;return result;
end;
$$;
