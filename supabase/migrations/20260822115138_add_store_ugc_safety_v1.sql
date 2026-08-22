create table private.user_terms_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  source text not null default 'app' check (source in ('app','admin','migration'))
);
alter table private.user_terms_acceptances enable row level security;
revoke all on private.user_terms_acceptances from public, anon, authenticated;

create table private.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);
alter table private.user_blocks enable row level security;
revoke all on private.user_blocks from public, anon, authenticated;
create index user_blocks_active_blocked_idx on private.user_blocks(blocked_user_id, blocker_user_id) where removed_at is null;

create table private.user_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('review','conversation')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment','hate','sexual','violence','spam','fraud','privacy','illegal','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'new' check (status in ('new','reviewing','actioned','dismissed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table private.user_content_reports enable row level security;
revoke all on private.user_content_reports from public, anon, authenticated;
create unique index user_content_reports_active_unique on private.user_content_reports(reporter_user_id,target_type,target_id) where status in ('new','reviewing');
create index user_content_reports_queue_idx on private.user_content_reports(status, created_at desc);

create or replace function private.require_current_terms_v1()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from private.user_terms_acceptances a where a.user_id=caller_id and a.terms_version='2026-08-22-store-v1') then
    raise exception 'terms_acceptance_required' using errcode='42501';
  end if;
end;
$$;
revoke all on function private.require_current_terms_v1() from public, anon, authenticated;

create or replace function private.get_my_terms_acceptance_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); accepted_row private.user_terms_acceptances%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into accepted_row from private.user_terms_acceptances where user_id=caller_id;
  return jsonb_build_object(
    'accepted', accepted_row.user_id is not null and accepted_row.terms_version='2026-08-22-store-v1',
    'termsVersion','2026-08-22-store-v1',
    'acceptedAt',case when accepted_row.terms_version='2026-08-22-store-v1' then accepted_row.accepted_at else null end
  );
end;
$$;

create or replace function private.accept_current_terms_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); accepted_time timestamptz;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  insert into private.user_terms_acceptances(user_id,terms_version,accepted_at,source)
  values(caller_id,'2026-08-22-store-v1',timezone('utc',now()),'app')
  on conflict(user_id) do update set terms_version=excluded.terms_version,accepted_at=excluded.accepted_at,source=excluded.source
  returning accepted_at into accepted_time;
  return jsonb_build_object('accepted',true,'termsVersion','2026-08-22-store-v1','acceptedAt',accepted_time);
end;
$$;

create or replace function private.get_conversation_safety_context_v1(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); target_id uuid; target_name text; target_role text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.conversation_participants p where p.conversation_id=p_conversation_id and p.user_id=caller_id) then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  select p.user_id, profile.display_name, p.participant_role into target_id,target_name,target_role
  from public.conversation_participants p join public.profiles profile on profile.id=p.user_id
  where p.conversation_id=p_conversation_id and p.user_id<>caller_id and p.participant_role in ('customer','producer')
  order by case p.participant_role when 'producer' then 0 else 1 end, p.joined_at asc limit 1;
  return jsonb_build_object(
    'conversationId',p_conversation_id,
    'canBlock',target_id is not null,
    'counterpartName',target_name,
    'counterpartRole',target_role,
    'blockedByMe',target_id is not null and exists(select 1 from private.user_blocks b where b.blocker_user_id=caller_id and b.blocked_user_id=target_id and b.removed_at is null),
    'blocksMe',target_id is not null and exists(select 1 from private.user_blocks b where b.blocker_user_id=target_id and b.blocked_user_id=caller_id and b.removed_at is null)
  );
end;
$$;

create or replace function private.report_published_review_v1(p_review_id uuid,p_reason text,p_details text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); target_user uuid; reason_value text:=lower(btrim(coalesce(p_reason,''))); details_value text:=nullif(btrim(coalesce(p_details,'')),''); report_row private.user_content_reports%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if reason_value not in ('harassment','hate','sexual','violence','spam','fraud','privacy','illegal','other') then raise exception 'invalid_report_reason' using errcode='22023'; end if;
  if details_value is not null and char_length(details_value)>1000 then raise exception 'report_details_too_long' using errcode='22023'; end if;
  select user_id into target_user from public.reviews where id=p_review_id and status='published';
  if target_user is null then raise exception 'published_review_not_found' using errcode='P0002'; end if;
  if target_user=caller_id then raise exception 'cannot_report_self' using errcode='22023'; end if;
  if (select count(*) from private.user_content_reports where reporter_user_id=caller_id and created_at>timezone('utc',now())-interval '1 hour')>=20 then raise exception 'content_report_rate_limit' using errcode='P0001'; end if;
  insert into private.user_content_reports(reporter_user_id,reported_user_id,target_type,target_id,reason,details)
  values(caller_id,target_user,'review',p_review_id,reason_value,details_value)
  on conflict(reporter_user_id,target_type,target_id) where status in ('new','reviewing')
  do update set reason=excluded.reason,details=excluded.details,updated_at=timezone('utc',now())
  returning * into report_row;
  return jsonb_build_object('id',report_row.id,'status',report_row.status,'targetType',report_row.target_type,'targetId',report_row.target_id,'createdAt',report_row.created_at);
end;
$$;

create or replace function private.report_conversation_v1(p_conversation_id uuid,p_reason text,p_details text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); target_user uuid; reason_value text:=lower(btrim(coalesce(p_reason,''))); details_value text:=nullif(btrim(coalesce(p_details,'')),''); report_row private.user_content_reports%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if reason_value not in ('harassment','hate','sexual','violence','spam','fraud','privacy','illegal','other') then raise exception 'invalid_report_reason' using errcode='22023'; end if;
  if details_value is not null and char_length(details_value)>1000 then raise exception 'report_details_too_long' using errcode='22023'; end if;
  if not exists(select 1 from public.conversation_participants p where p.conversation_id=p_conversation_id and p.user_id=caller_id) then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  select p.user_id into target_user from public.conversation_participants p where p.conversation_id=p_conversation_id and p.user_id<>caller_id and p.participant_role in ('customer','producer') order by case p.participant_role when 'producer' then 0 else 1 end,p.joined_at asc limit 1;
  if (select count(*) from private.user_content_reports where reporter_user_id=caller_id and created_at>timezone('utc',now())-interval '1 hour')>=20 then raise exception 'content_report_rate_limit' using errcode='P0001'; end if;
  insert into private.user_content_reports(reporter_user_id,reported_user_id,target_type,target_id,reason,details)
  values(caller_id,target_user,'conversation',p_conversation_id,reason_value,details_value)
  on conflict(reporter_user_id,target_type,target_id) where status in ('new','reviewing')
  do update set reason=excluded.reason,details=excluded.details,updated_at=timezone('utc',now())
  returning * into report_row;
  return jsonb_build_object('id',report_row.id,'status',report_row.status,'targetType',report_row.target_type,'targetId',report_row.target_id,'createdAt',report_row.created_at);
end;
$$;

create or replace function private.set_conversation_user_block_v1(p_conversation_id uuid,p_block boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); target_id uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_block is null then raise exception 'invalid_block_state' using errcode='22023'; end if;
  if not exists(select 1 from public.conversation_participants p where p.conversation_id=p_conversation_id and p.user_id=caller_id) then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  select p.user_id into target_id from public.conversation_participants p where p.conversation_id=p_conversation_id and p.user_id<>caller_id and p.participant_role in ('customer','producer') order by case p.participant_role when 'producer' then 0 else 1 end,p.joined_at asc limit 1;
  if target_id is null then raise exception 'conversation_user_not_blockable' using errcode='55000'; end if;
  if p_block then
    insert into private.user_blocks(blocker_user_id,blocked_user_id,created_at,removed_at)
    values(caller_id,target_id,timezone('utc',now()),null)
    on conflict(blocker_user_id,blocked_user_id) do update set created_at=excluded.created_at,removed_at=null;
  else
    update private.user_blocks set removed_at=timezone('utc',now()) where blocker_user_id=caller_id and blocked_user_id=target_id and removed_at is null;
  end if;
  return private.get_conversation_safety_context_v1(p_conversation_id);
end;
$$;

create or replace function private.admin_list_content_reports_v1(p_status text default null,p_limit integer default 100,p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare status_value text:=nullif(lower(btrim(coalesce(p_status,''))),''); result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if status_value is not null and status_value not in ('new','reviewing','actioned','dismissed') then raise exception 'invalid_report_status' using errcode='22023'; end if;
  if p_limit not between 1 and 200 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into result from (
    select jsonb_build_object('id',r.id,'targetType',r.target_type,'targetId',r.target_id,'reason',r.reason,'details',r.details,'status',r.status,'createdAt',r.created_at,'reporterUserId',r.reporter_user_id,'reportedUserId',r.reported_user_id) item,r.created_at
    from private.user_content_reports r where status_value is null or r.status=status_value order by r.created_at desc limit p_limit offset p_offset
  ) rows;
  return result;
end;
$$;

create or replace function private.admin_set_content_report_status_v1(p_report_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare status_value text:=lower(btrim(coalesce(p_status,''))); report_row private.user_content_reports%rowtype;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if status_value not in ('reviewing','actioned','dismissed') then raise exception 'invalid_report_status' using errcode='22023'; end if;
  update private.user_content_reports set status=status_value,updated_at=timezone('utc',now()) where id=p_report_id returning * into report_row;
  if report_row.id is null then raise exception 'content_report_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('id',report_row.id,'status',report_row.status,'updatedAt',report_row.updated_at);
end;
$$;

create or replace function private.send_conversation_message_v1(p_conversation_id uuid,p_body text,p_attachment_paths text[] default '{}'::text[],p_message_type text default 'text')
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); conversation_row public.conversations%rowtype; message_row public.messages%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.require_current_terms_v1();
  select conversation.* into conversation_row from public.conversations conversation where conversation.id=p_conversation_id and exists(select 1 from public.conversation_participants participant where participant.conversation_id=conversation.id and participant.user_id=caller_id) for update;
  if conversation_row.id is null then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  if conversation_row.status='closed' then raise exception 'conversation_closed' using errcode='55000'; end if;
  if exists(select 1 from public.conversation_participants other join private.user_blocks b on b.removed_at is null and ((b.blocker_user_id=caller_id and b.blocked_user_id=other.user_id) or (b.blocker_user_id=other.user_id and b.blocked_user_id=caller_id)) where other.conversation_id=conversation_row.id and other.user_id<>caller_id) then raise exception 'conversation_user_blocked' using errcode='42501'; end if;
  if (select count(*) from public.messages message where message.sender_user_id=caller_id and message.created_at>timezone('utc',now())-interval '1 minute')>=20 then raise exception 'message_rate_limit' using errcode='P0001'; end if;
  message_row:=private.insert_conversation_message_v1(conversation_row.id,caller_id,p_body,p_attachment_paths,p_message_type);
  return jsonb_build_object('id',message_row.id,'conversationId',conversation_row.id,'messageType',message_row.message_type,'createdAt',message_row.created_at);
end;
$$;

create or replace function private.start_producer_conversation_v1(p_producer_id uuid,p_product_id uuid,p_order_id uuid,p_subject text,p_initial_message text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); producer_row public.producers%rowtype; product_row public.products%rowtype; context_value text; conversation_row public.conversations%rowtype; initial_row public.messages%rowtype; subject_value text:=nullif(btrim(coalesce(p_subject,'')),'');
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.require_current_terms_v1();
  if ((p_product_id is not null)::integer+(p_order_id is not null)::integer)<>1 then raise exception 'product_or_order_context_required' using errcode='22023'; end if;
  if subject_value is not null and char_length(subject_value)>200 then raise exception 'conversation_subject_too_long' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_initial_message,''))) not between 1 and 5000 then raise exception 'initial_message_required' using errcode='22023'; end if;
  select * into producer_row from public.producers producer where producer.id=p_producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null;
  if producer_row.id is null or producer_row.owner_user_id is null then raise exception 'producer_not_available' using errcode='P0002'; end if;
  if producer_row.owner_user_id=caller_id then raise exception 'cannot_message_self' using errcode='22023'; end if;
  if exists(select 1 from private.user_blocks b where b.removed_at is null and ((b.blocker_user_id=caller_id and b.blocked_user_id=producer_row.owner_user_id) or (b.blocker_user_id=producer_row.owner_user_id and b.blocked_user_id=caller_id))) then raise exception 'conversation_user_blocked' using errcode='42501'; end if;
  if p_product_id is not null then
    select * into product_row from public.products product where product.id=p_product_id and product.producer_id=producer_row.id and product.status='published' and product.is_active=true and product.deleted_at is null;
    if product_row.id is null then raise exception 'product_not_available' using errcode='P0002'; end if;
    context_value:='producer:'||caller_id::text||':'||producer_row.id::text||':product:'||product_row.id::text;
  else
    if not exists(select 1 from public.orders customer_order join public.order_items item on item.order_id=customer_order.id where customer_order.id=p_order_id and customer_order.user_id=caller_id and item.producer_id=producer_row.id) then raise exception 'order_producer_context_not_found' using errcode='P0002'; end if;
    context_value:='producer:'||caller_id::text||':'||producer_row.id::text||':order:'||p_order_id::text;
  end if;
  if (select count(*) from public.conversations c where c.created_by=caller_id and c.created_at>timezone('utc',now())-interval '1 hour')>=10 then raise exception 'conversation_start_rate_limit' using errcode='P0001'; end if;
  insert into public.conversations(conversation_type,order_id,producer_id,product_id,subject,status,created_by,context_key) values('producer',p_order_id,producer_row.id,p_product_id,subject_value,'open',caller_id,context_value)
  on conflict (context_key) where context_key is not null do update set status='open',closed_at=null,closed_by=null,subject=coalesce(excluded.subject,public.conversations.subject),updated_at=timezone('utc',now()) returning * into conversation_row;
  insert into public.conversation_participants(conversation_id,user_id,participant_role,last_read_at) values(conversation_row.id,caller_id,'customer',timezone('utc',now())) on conflict(conversation_id,user_id) do update set participant_role='customer';
  insert into public.conversation_participants(conversation_id,user_id,participant_role) values(conversation_row.id,producer_row.owner_user_id,'producer') on conflict(conversation_id,user_id) do update set participant_role='producer';
  initial_row:=private.insert_conversation_message_v1(conversation_row.id,caller_id,p_initial_message,'{}'::text[],'text');
  return jsonb_build_object('conversationId',conversation_row.id,'messageId',initial_row.id,'status',conversation_row.status,'producerId',producer_row.id,'productId',p_product_id,'orderId',p_order_id);
end;
$$;

create or replace function private.submit_verified_review_v1(p_order_item_id uuid,p_rating integer,p_title text,p_body text,p_media_paths text[] default '{}'::text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid(); target record; review_row public.reviews%rowtype; normalized_title text:=nullif(btrim(coalesce(p_title,'')),''); normalized_body text:=btrim(coalesce(p_body,'')); normalized_media text[];
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.require_current_terms_v1();
  if p_rating not between 1 and 5 then raise exception 'invalid_review_rating' using errcode='22023'; end if;
  if normalized_title is not null and char_length(normalized_title)>120 then raise exception 'review_title_too_long' using errcode='22023'; end if;
  if char_length(normalized_body) not between 10 and 3000 then raise exception 'invalid_review_body' using errcode='22023'; end if;
  normalized_media:=private.validate_review_media_paths_v1(p_media_paths);
  select item.id as order_item_id,item.product_id,customer_order.id as order_id,customer_order.status as order_status,product.producer_id,producer.owner_user_id into target from public.order_items item join public.orders customer_order on customer_order.id=item.order_id join public.products product on product.id=item.product_id join public.producers producer on producer.id=product.producer_id where item.id=p_order_item_id and customer_order.user_id=caller_id;
  if target.order_item_id is null then raise exception 'purchased_item_not_found' using errcode='P0002'; end if;
  if target.order_status not in ('delivered','completed') then raise exception 'review_requires_delivered_order' using errcode='55000'; end if;
  if target.owner_user_id=caller_id then raise exception 'producer_cannot_review_own_product' using errcode='42501'; end if;
  if exists(select 1 from public.reviews r where r.order_item_id=target.order_item_id) then raise exception 'review_already_exists_for_order_item' using errcode='23505'; end if;
  insert into public.reviews(user_id,product_id,order_item_id,rating,title,body,media_paths,status,is_verified_purchase) values(caller_id,target.product_id,target.order_item_id,p_rating,normalized_title,normalized_body,normalized_media,'pending',true) returning * into review_row;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('review',review_row.id,'review.submitted',jsonb_build_object('review_id',review_row.id,'product_id',review_row.product_id,'user_id',caller_id));
  return jsonb_build_object('id',review_row.id,'productId',review_row.product_id,'orderItemId',review_row.order_item_id,'rating',review_row.rating,'status',review_row.status,'verifiedPurchase',true);
end; $$;

create or replace function private.update_my_review_v1(p_review_id uuid,p_rating integer,p_title text,p_body text,p_media_paths text[] default '{}'::text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid(); review_row public.reviews%rowtype; normalized_title text:=nullif(btrim(coalesce(p_title,'')),''); normalized_body text:=btrim(coalesce(p_body,'')); normalized_media text[];
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.require_current_terms_v1();
  if p_rating not between 1 and 5 then raise exception 'invalid_review_rating' using errcode='22023'; end if;
  if normalized_title is not null and char_length(normalized_title)>120 then raise exception 'review_title_too_long' using errcode='22023'; end if;
  if char_length(normalized_body) not between 10 and 3000 then raise exception 'invalid_review_body' using errcode='22023'; end if;
  normalized_media:=private.validate_review_media_paths_v1(p_media_paths);
  select * into review_row from public.reviews where id=p_review_id and user_id=caller_id for update;
  if review_row.id is null then raise exception 'review_not_found' using errcode='P0002'; end if;
  if review_row.status='withdrawn' then raise exception 'withdrawn_review_cannot_be_edited' using errcode='55000'; end if;
  update public.reviews set rating=p_rating,title=normalized_title,body=normalized_body,media_paths=normalized_media,status='pending',moderated_by=null,moderated_at=null,moderation_reason=null,merchant_reply=null,merchant_replied_at=null,merchant_reply_by=null,edited_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=review_row.id returning * into review_row;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('review',review_row.id,'review.resubmitted',jsonb_build_object('review_id',review_row.id,'user_id',caller_id));
  return jsonb_build_object('id',review_row.id,'rating',review_row.rating,'status',review_row.status,'editedAt',review_row.edited_at);
end; $$;

create or replace function private.producer_reply_to_review_v1(p_review_id uuid,p_reply text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid(); reply_value text:=btrim(coalesce(p_reply,'')); review_row public.reviews%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.require_current_terms_v1();
  if char_length(reply_value) not between 2 and 2000 then raise exception 'invalid_review_reply' using errcode='22023'; end if;
  select review.* into review_row from public.reviews review join public.products product on product.id=review.product_id join public.producers producer on producer.id=product.producer_id where review.id=p_review_id and producer.owner_user_id=caller_id and producer.status='active' and producer.deleted_at is null for update of review;
  if review_row.id is null then raise exception 'review_reply_access_denied' using errcode='42501'; end if;
  if review_row.status<>'published' then raise exception 'only_published_review_can_be_replied' using errcode='55000'; end if;
  update public.reviews set merchant_reply=reply_value,merchant_replied_at=timezone('utc',now()),merchant_reply_by=caller_id,updated_at=timezone('utc',now()) where id=review_row.id returning * into review_row;
  insert into public.notifications(user_id,type,title,message,action_url,metadata) values(review_row.user_id,'review','Üretici yorumunuza cevap verdi','Satın aldığınız ürünün üreticisi yorumunuza cevap verdi.','/account/reviews',jsonb_build_object('reviewId',review_row.id));
  return jsonb_build_object('id',review_row.id,'merchantReply',review_row.merchant_reply,'merchantRepliedAt',review_row.merchant_replied_at);
end; $$;

create or replace function private.get_product_reviews_v1(p_product_id uuid,p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; summary jsonb; caller_id uuid:=auth.uid();
begin
  if p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select jsonb_build_object('count',count(*),'averageRating',coalesce(round(avg(rating)::numeric,2),0),'rating1',count(*) filter(where rating=1),'rating2',count(*) filter(where rating=2),'rating3',count(*) filter(where rating=3),'rating4',count(*) filter(where rating=4),'rating5',count(*) filter(where rating=5)) into summary
  from public.reviews review where review.product_id=p_product_id and review.status='published' and (caller_id is null or not exists(select 1 from private.user_blocks b where b.blocker_user_id=caller_id and b.blocked_user_id=review.user_id and b.removed_at is null));
  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into result from (
    select jsonb_build_object('id',review.id,'rating',review.rating,'title',review.title,'body',review.body,'mediaPaths',review.media_paths,'verifiedPurchase',review.is_verified_purchase,'createdAt',review.created_at,'editedAt',review.edited_at,'reviewerName',case when position(' ' in profile.display_name)>0 then split_part(profile.display_name,' ',1)||' '||left(split_part(profile.display_name,' ',2),1)||'.' else profile.display_name end,'merchantReply',review.merchant_reply,'merchantRepliedAt',review.merchant_replied_at,'helpfulCount',(select count(*) from private.review_helpful_votes vote where vote.review_id=review.id),'helpfulByMe',exists(select 1 from private.review_helpful_votes vote where vote.review_id=review.id and vote.user_id=auth.uid())) as item,review.created_at
    from public.reviews review join public.profiles profile on profile.id=review.user_id where review.product_id=p_product_id and review.status='published' and (caller_id is null or not exists(select 1 from private.user_blocks b where b.blocker_user_id=caller_id and b.blocked_user_id=review.user_id and b.removed_at is null)) order by review.created_at desc limit p_limit offset p_offset
  ) rows;
  return jsonb_build_object('summary',summary,'items',result);
end; $$;

create or replace function public.get_my_terms_acceptance_v1() returns jsonb language sql stable set search_path='' as $$ select private.get_my_terms_acceptance_v1(); $$;
create or replace function public.accept_current_terms_v1() returns jsonb language sql set search_path='' as $$ select private.accept_current_terms_v1(); $$;
create or replace function public.get_conversation_safety_context_v1(p_conversation_id uuid) returns jsonb language sql stable set search_path='' as $$ select private.get_conversation_safety_context_v1(p_conversation_id); $$;
create or replace function public.report_published_review_v1(p_review_id uuid,p_reason text,p_details text default null) returns jsonb language sql set search_path='' as $$ select private.report_published_review_v1(p_review_id,p_reason,p_details); $$;
create or replace function public.report_conversation_v1(p_conversation_id uuid,p_reason text,p_details text default null) returns jsonb language sql set search_path='' as $$ select private.report_conversation_v1(p_conversation_id,p_reason,p_details); $$;
create or replace function public.set_conversation_user_block_v1(p_conversation_id uuid,p_block boolean) returns jsonb language sql set search_path='' as $$ select private.set_conversation_user_block_v1(p_conversation_id,p_block); $$;
create or replace function public.admin_list_content_reports_v1(p_status text default null,p_limit integer default 100,p_offset integer default 0) returns jsonb language sql stable set search_path='' as $$ select private.admin_list_content_reports_v1(p_status,p_limit,p_offset); $$;
create or replace function public.admin_set_content_report_status_v1(p_report_id uuid,p_status text) returns jsonb language sql set search_path='' as $$ select private.admin_set_content_report_status_v1(p_report_id,p_status); $$;

revoke all on function public.get_my_terms_acceptance_v1() from public, anon;
revoke all on function public.accept_current_terms_v1() from public, anon;
revoke all on function public.get_conversation_safety_context_v1(uuid) from public, anon;
revoke all on function public.report_published_review_v1(uuid,text,text) from public, anon;
revoke all on function public.report_conversation_v1(uuid,text,text) from public, anon;
revoke all on function public.set_conversation_user_block_v1(uuid,boolean) from public, anon;
revoke all on function public.admin_list_content_reports_v1(text,integer,integer) from public, anon;
revoke all on function public.admin_set_content_report_status_v1(uuid,text) from public, anon;
grant execute on function public.get_my_terms_acceptance_v1() to authenticated;
grant execute on function public.accept_current_terms_v1() to authenticated;
grant execute on function public.get_conversation_safety_context_v1(uuid) to authenticated;
grant execute on function public.report_published_review_v1(uuid,text,text) to authenticated;
grant execute on function public.report_conversation_v1(uuid,text,text) to authenticated;
grant execute on function public.set_conversation_user_block_v1(uuid,boolean) to authenticated;
grant execute on function public.admin_list_content_reports_v1(text,integer,integer) to authenticated;
grant execute on function public.admin_set_content_report_status_v1(uuid,text) to authenticated;

grant execute on function private.get_my_terms_acceptance_v1() to authenticated;
grant execute on function private.accept_current_terms_v1() to authenticated;
grant execute on function private.get_conversation_safety_context_v1(uuid) to authenticated;
grant execute on function private.report_published_review_v1(uuid,text,text) to authenticated;
grant execute on function private.report_conversation_v1(uuid,text,text) to authenticated;
grant execute on function private.set_conversation_user_block_v1(uuid,boolean) to authenticated;
grant execute on function private.admin_list_content_reports_v1(text,integer,integer) to authenticated;
grant execute on function private.admin_set_content_report_status_v1(uuid,text) to authenticated;
