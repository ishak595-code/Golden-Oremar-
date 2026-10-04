-- Store staff answer product questions and support chats on behalf of the
-- official store. Customers must see the store ("Golden Oremar"), never the
-- admin's personal name: in the thread, in the inbox preview and in the
-- "new message" notification (and so in its push text). Staff still see
-- which admin wrote each message (staffName), and messages.sender_user_id
-- keeps the real author for audit.
--
-- A message counts as the store's when its author takes part in the
-- conversation as 'admin' (support conversations, and producer questions
-- the store answers for producers without an account).

create or replace function private.store_display_name_v1()
 returns text
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare value text;
begin
  begin
    value:=nullif(btrim(public.get_public_storefront_config_v2('tr')->'brand'->>'name'),'');
  exception when others then value:=null;
  end;
  return left(coalesce(value,'Golden Oremar'),120);
end;
$function$;
revoke all on function private.store_display_name_v1() from public, anon, authenticated;

create or replace function private.get_conversation_messages_v1(p_conversation_id uuid, p_limit integer default 50, p_before timestamp with time zone default null::timestamp with time zone)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); result jsonb; caller_is_staff boolean; store_name text:=private.store_display_name_v1();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  if not exists(select 1 from public.conversation_participants where conversation_id=p_conversation_id and user_id=caller_id) then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  caller_is_staff:=exists(select 1 from public.conversation_participants where conversation_id=p_conversation_id and user_id=caller_id and participant_role='admin');
  select coalesce(jsonb_agg(item order by created_at asc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',message.id,'senderUserId',message.sender_user_id,
      'senderName',case when sender.participant_role='admin' then store_name else profile.display_name end,
      'senderIsStore',coalesce(sender.participant_role='admin',false),
      'staffName',case when caller_is_staff and sender.participant_role='admin' then profile.display_name else null end,
      'isMine',message.sender_user_id=caller_id,
      'body',case when message.deleted_at is null then message.body else 'Mesaj kaldırıldı' end,
      'attachmentPaths',case when message.deleted_at is null then message.attachment_paths else '{}'::text[] end,
      'messageType',message.message_type,'createdAt',message.created_at,'editedAt',message.edited_at,'deletedAt',message.deleted_at
    ) item,message.created_at
    from public.messages message
    join public.profiles profile on profile.id=message.sender_user_id
    left join public.conversation_participants sender on sender.conversation_id=message.conversation_id and sender.user_id=message.sender_user_id
    where message.conversation_id=p_conversation_id and (p_before is null or message.created_at<p_before)
    order by message.created_at desc limit p_limit
  ) rows;
  return result;
end;
$function$;

create or replace function private.list_my_conversations_v1(p_limit integer default 50, p_offset integer default 0)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); result jsonb; store_name text:=private.store_display_name_v1();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select coalesce(jsonb_agg(item order by sort_time desc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',conversation.id,'type',conversation.conversation_type,'orderId',conversation.order_id,'producerId',conversation.producer_id,'productId',conversation.product_id,
      'subject',conversation.subject,'status',conversation.status,'updatedAt',conversation.updated_at,'lastMessageAt',conversation.last_message_at,
      'title',case when conversation.conversation_type='support' then store_name||' Destek'
                   when conversation.conversation_type='producer' and producer.owner_user_id is null then store_name
                   else coalesce(producer.display_name,'Üretici') end,
      'answeredByStore',conversation.conversation_type='support' or (conversation.conversation_type='producer' and producer.owner_user_id is null),
      'lastMessage',coalesce(last_message.preview,''),
      'lastMessageSender',case when last_message.sender_user_id is null then null
                               when last_message.sender_user_id=caller_id then 'Siz'
                               when last_message.sender_role='admin' then store_name
                               else null end,
      'lastMessageFromStore',coalesce(last_message.sender_role='admin',false),
      'unreadCount',(select count(*) from public.messages m where m.conversation_id=conversation.id and m.sender_user_id<>caller_id and m.created_at>coalesce(participant.last_read_at,'epoch'::timestamptz))
    ) item,coalesce(conversation.last_message_at,conversation.updated_at) sort_time
    from public.conversation_participants participant
    join public.conversations conversation on conversation.id=participant.conversation_id
    left join public.producers producer on producer.id=conversation.producer_id
    left join lateral (
      select case when m.deleted_at is null then left(m.body,180) else 'Mesaj kaldırıldı' end preview, m.sender_user_id, sp.participant_role sender_role
      from public.messages m
      left join public.conversation_participants sp on sp.conversation_id=m.conversation_id and sp.user_id=m.sender_user_id
      where m.conversation_id=conversation.id order by m.created_at desc limit 1
    ) last_message on true
    where participant.user_id=caller_id
    order by coalesce(conversation.last_message_at,conversation.updated_at) desc
    limit p_limit offset p_offset
  ) rows;
  return result;
end;
$function$;

create or replace function private.insert_conversation_message_v1(p_conversation_id uuid, p_sender_user_id uuid, p_body text, p_attachment_paths text[], p_message_type text)
 returns messages
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  body_value text:=btrim(coalesce(p_body,''));
  type_value text:=lower(btrim(coalesce(p_message_type,'text')));
  attachments text[];
  message_row public.messages%rowtype;
  conversation_type_value text;
  violation text;
  path_value text;
  sender_is_store boolean;
  store_name text;
begin
  if char_length(body_value) not between 1 and 5000 then raise exception 'invalid_message_body' using errcode='22023'; end if;
  select c.conversation_type into conversation_type_value from public.conversations c where c.id=p_conversation_id;
  violation:=private.message_moderation_violation_v1(body_value,conversation_type_value);
  if violation is not null then raise exception 'message_moderation_blocked:%',violation using errcode='22023'; end if;
  if type_value not in ('text','image','file') then raise exception 'invalid_message_type' using errcode='22023'; end if;
  attachments:=private.validate_message_attachments_v1(p_attachment_paths);
  foreach path_value in array attachments loop
    if split_part(path_value,'/',2)<>p_conversation_id::text then raise exception 'message_attachment_conversation_mismatch' using errcode='22023'; end if;
  end loop;
  if type_value in ('image','file') and coalesce(array_length(attachments,1),0)=0 then raise exception 'message_attachment_required' using errcode='22023'; end if;

  insert into public.messages(conversation_id,sender_user_id,body,attachment_paths,message_type)
  values(p_conversation_id,p_sender_user_id,body_value,attachments,type_value)
  returning * into message_row;

  update public.conversations set last_message_at=message_row.created_at,updated_at=message_row.created_at where id=p_conversation_id;
  update public.conversation_participants set last_read_at=message_row.created_at where conversation_id=p_conversation_id and user_id=p_sender_user_id;

  sender_is_store:=exists(select 1 from public.conversation_participants where conversation_id=p_conversation_id and user_id=p_sender_user_id and participant_role='admin');
  store_name:=case when sender_is_store then private.store_display_name_v1() else null end;

  -- Customers get the store as sender (no staff id); fellow staff keep the author for audit.
  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  select participant.user_id,'message',
         case when sender_is_store and participant.participant_role<>'admin' then store_name||' yanıt verdi' else 'Yeni mesaj' end,
         left(body_value,180),'/messages/'||p_conversation_id::text,
         case when sender_is_store and participant.participant_role<>'admin'
              then jsonb_build_object('conversationId',p_conversation_id,'messageId',message_row.id,'senderIsStore',true,'senderName',store_name)
              else jsonb_build_object('conversationId',p_conversation_id,'messageId',message_row.id,'senderUserId',p_sender_user_id,'senderIsStore',sender_is_store) end
  from public.conversation_participants participant
  join public.profiles profile on profile.id=participant.user_id and profile.status='active'
  where participant.conversation_id=p_conversation_id and participant.user_id<>p_sender_user_id;
  return message_row;
end;
$function$;
