-- "Üreticiye soru sor" failed for every product: the only producer has no
-- seller account (owner_user_id is null), so start_producer_conversation_v1
-- raised producer_not_available. Until a producer has its own account, the
-- store answers on its behalf: active admins join the conversation (as for
-- support conversations), see it in Mesajlar and get the usual new-message
-- notification. Producers with an account are unchanged.
create or replace function private.start_producer_conversation_v1(p_producer_id uuid, p_product_id uuid, p_order_id uuid, p_subject text, p_initial_message text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); producer_row public.producers%rowtype; product_row public.products%rowtype; context_value text; conversation_row public.conversations%rowtype; initial_row public.messages%rowtype; subject_value text:=nullif(btrim(coalesce(p_subject,'')),''); answered_by_store boolean:=false; admin_count integer:=0;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.require_current_terms_v1();
  if ((p_product_id is not null)::integer+(p_order_id is not null)::integer)<>1 then raise exception 'product_or_order_context_required' using errcode='22023'; end if;
  if subject_value is not null and char_length(subject_value)>200 then raise exception 'conversation_subject_too_long' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_initial_message,''))) not between 1 and 5000 then raise exception 'initial_message_required' using errcode='22023'; end if;
  select * into producer_row from public.producers producer where producer.id=p_producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null;
  if producer_row.id is null then raise exception 'producer_not_available' using errcode='P0002'; end if;
  answered_by_store:=producer_row.owner_user_id is null;
  if answered_by_store and not exists(
    select 1 from private.user_roles role join public.profiles profile on profile.id=role.user_id and profile.status='active' and profile.deleted_at is null
    where role.role in ('admin','super_admin') and (role.expires_at is null or role.expires_at>timezone('utc',now())) and role.user_id<>caller_id
  ) then raise exception 'producer_not_available' using errcode='P0002'; end if;
  if producer_row.owner_user_id=caller_id then raise exception 'cannot_message_self' using errcode='22023'; end if;
  if not answered_by_store and exists(select 1 from private.user_blocks b where b.removed_at is null and ((b.blocker_user_id=caller_id and b.blocked_user_id=producer_row.owner_user_id) or (b.blocker_user_id=producer_row.owner_user_id and b.blocked_user_id=caller_id))) then raise exception 'conversation_user_blocked' using errcode='42501'; end if;
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
  if answered_by_store then
    insert into public.conversation_participants(conversation_id,user_id,participant_role)
    select conversation_row.id,role.user_id,'admin'
    from private.user_roles role
    join public.profiles profile on profile.id=role.user_id and profile.status='active' and profile.deleted_at is null
    where role.role in ('admin','super_admin') and (role.expires_at is null or role.expires_at>timezone('utc',now())) and role.user_id<>caller_id
    on conflict(conversation_id,user_id) do nothing;
    get diagnostics admin_count=row_count;
  else
    insert into public.conversation_participants(conversation_id,user_id,participant_role) values(conversation_row.id,producer_row.owner_user_id,'producer') on conflict(conversation_id,user_id) do update set participant_role='producer';
  end if;
  initial_row:=private.insert_conversation_message_v1(conversation_row.id,caller_id,p_initial_message,'{}'::text[],'text');
  return jsonb_build_object('conversationId',conversation_row.id,'messageId',initial_row.id,'status',conversation_row.status,'producerId',producer_row.id,'productId',p_product_id,'orderId',p_order_id,'answeredByStore',answered_by_store);
end;
$function$;
