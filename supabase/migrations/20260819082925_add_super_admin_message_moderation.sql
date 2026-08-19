create table if not exists private.message_moderation_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  block_email boolean not null default true,
  block_phone boolean not null default true,
  block_messaging_apps boolean not null default true,
  block_external_links boolean not null default true,
  block_social_handles boolean not null default true,
  block_bank_details boolean not null default true,
  block_external_payments boolean not null default true,
  block_qr_codes boolean not null default true,
  custom_blocked_phrases text[] not null default '{}'::text[],
  apply_to_support boolean not null default false,
  allow_attachments boolean not null default true,
  allow_images boolean not null default true,
  allow_pdf boolean not null default true,
  max_attachments smallint not null default 5 check (max_attachments between 0 and 5),
  max_attachment_mb smallint not null default 20 check (max_attachment_mb between 1 and 20),
  updated_by uuid,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into private.message_moderation_settings(singleton)
values(true)
on conflict(singleton) do nothing;

create or replace function private.get_message_moderation_settings_v1()
returns private.message_moderation_settings
language sql
stable
security definer
set search_path to ''
as $function$
  select * from private.message_moderation_settings where singleton=true;
$function$;

create or replace function private.message_moderation_violation_v1(p_body text,p_conversation_type text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  settings private.message_moderation_settings%rowtype;
  value text:=lower(btrim(coalesce(p_body,'')));
  phrase text;
begin
  select * into settings from private.message_moderation_settings where singleton=true;
  if not found or not settings.enabled then return null; end if;
  if coalesce(p_conversation_type,'') <> 'producer' and not (coalesce(p_conversation_type,'')='support' and settings.apply_to_support) then return null; end if;
  if value='' then return null; end if;

  if settings.block_email and value ~* '(^|[^[:alnum:]_.+-])[[:alnum:]_.+-]+@[[:alnum:]-]+(\.[[:alnum:]-]+)+([^[:alnum:]_.+-]|$)' then return 'email'; end if;
  if settings.block_phone and (value ~* '(^|[^0-9])\+?[0-9]([ .()/-]*[0-9]){9,14}([^0-9]|$)' or value ~* '(^|[^[:alnum:]])tel:') then return 'phone'; end if;
  if settings.block_messaging_apps and value ~* '(^|[^[:alnum:]])(whatsapp|wa\.me|telegram|t\.me|signal|viber)[[:space:]:=@/+_-]*[[:alnum:]@+_.-]{2,}' then return 'messaging_app'; end if;
  if settings.block_external_links and value ~* '(^|[^[:alnum:]])(https?://|www\.)[^[:space:]]+' then return 'external_link'; end if;
  if settings.block_social_handles and value ~* '(^|[^[:alnum:]])(instagram|facebook|tiktok|twitter|snapchat|discord|x\.com)[[:space:]:=@/+_-]*@?[[:alnum:]_.-]{3,}' then return 'social_handle'; end if;
  if settings.block_bank_details and (value ~* '(^|[^[:alnum:]])[a-z]{2}[0-9]{2}[a-z0-9]{11,30}([^[:alnum:]]|$)' or value ~* '(^|[^[:alnum:]])(iban|swift|bic|bank account|banka hesabı|hesap no)[^[:alnum:]]') then return 'bank_details'; end if;
  if settings.block_external_payments and value ~* '(^|[^[:alnum:]])(paypal|wise|revolut|western union|moneygram|cash ?app|venmo|usdt|bitcoin|btc|crypto|kripto|havale|eft)([^[:alnum:]]|$)' then return 'external_payment'; end if;
  if settings.block_qr_codes and value ~* '(^|[^[:alnum:]])(qr[[:space:]_-]*(code|kod)|karekod)([^[:alnum:]]|$)' then return 'qr_code'; end if;

  foreach phrase in array coalesce(settings.custom_blocked_phrases,'{}'::text[])
  loop
    phrase:=lower(btrim(phrase));
    if char_length(phrase)>=2 and position(phrase in value)>0 then return 'custom_phrase'; end if;
  end loop;
  return null;
end;
$function$;

create or replace function private.validate_message_attachments_v1(p_attachment_paths text[])
returns text[]
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  caller_id uuid:=auth.uid();
  path_value text;
  normalized text[]:='{}'::text[];
  settings private.message_moderation_settings%rowtype;
  object_meta jsonb;
  object_type text;
  object_size bigint;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into settings from private.message_moderation_settings where singleton=true;
  if not found then raise exception 'message_moderation_configuration_missing' using errcode='55000'; end if;
  if not settings.allow_attachments and coalesce(array_length(p_attachment_paths,1),0)>0 then raise exception 'message_attachments_disabled' using errcode='22023'; end if;
  if coalesce(array_length(p_attachment_paths,1),0)>settings.max_attachments then raise exception 'message_attachment_limit_exceeded' using errcode='22023'; end if;

  foreach path_value in array coalesce(p_attachment_paths,'{}'::text[])
  loop
    path_value:=btrim(coalesce(path_value,''));
    if char_length(path_value) not between 1 and 500 or split_part(path_value,'/',1)<>caller_id::text then raise exception 'invalid_message_attachment_path' using errcode='22023'; end if;
    select object.metadata into object_meta from storage.objects object where object.bucket_id='message-attachments' and object.name=path_value;
    if object_meta is null then raise exception 'message_attachment_not_uploaded' using errcode='22023'; end if;
    object_type:=lower(coalesce(object_meta->>'mimetype',''));
    object_size:=coalesce((object_meta->>'size')::bigint,0);
    if object_size<=0 or object_size>settings.max_attachment_mb::bigint*1024*1024 then raise exception 'message_attachment_size_not_allowed' using errcode='22023'; end if;
    if object_type like 'image/%' then
      if not settings.allow_images or object_type not in ('image/jpeg','image/png','image/webp','image/avif') then raise exception 'message_attachment_type_not_allowed' using errcode='22023'; end if;
    elsif object_type='application/pdf' then
      if not settings.allow_pdf then raise exception 'message_attachment_type_not_allowed' using errcode='22023'; end if;
    else
      raise exception 'message_attachment_type_not_allowed' using errcode='22023';
    end if;
    normalized:=array_append(normalized,path_value);
  end loop;
  return normalized;
end;
$function$;

create or replace function private.insert_conversation_message_v1(p_conversation_id uuid,p_sender_user_id uuid,p_body text,p_attachment_paths text[],p_message_type text)
returns public.messages
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

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  select participant.user_id,'message','Yeni mesaj',left(body_value,180),'/messages/'||p_conversation_id::text,
         jsonb_build_object('conversationId',p_conversation_id,'messageId',message_row.id,'senderUserId',p_sender_user_id)
  from public.conversation_participants participant
  join public.profiles profile on profile.id=participant.user_id and profile.status='active'
  where participant.conversation_id=p_conversation_id and participant.user_id<>p_sender_user_id;
  return message_row;
end;
$function$;

create or replace function private.admin_get_message_moderation_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare s private.message_moderation_settings%rowtype;
begin
  if auth.uid() is null or not private.has_role('super_admin') then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into s from private.message_moderation_settings where singleton=true;
  if not found then raise exception 'message_moderation_configuration_missing' using errcode='P0002'; end if;
  return jsonb_build_object(
    'enabled',s.enabled,
    'blockEmail',s.block_email,
    'blockPhone',s.block_phone,
    'blockMessagingApps',s.block_messaging_apps,
    'blockExternalLinks',s.block_external_links,
    'blockSocialHandles',s.block_social_handles,
    'blockBankDetails',s.block_bank_details,
    'blockExternalPayments',s.block_external_payments,
    'blockQrCodes',s.block_qr_codes,
    'customBlockedPhrases',to_jsonb(s.custom_blocked_phrases),
    'applyToSupport',s.apply_to_support,
    'allowAttachments',s.allow_attachments,
    'allowImages',s.allow_images,
    'allowPdf',s.allow_pdf,
    'maxAttachments',s.max_attachments,
    'maxAttachmentMb',s.max_attachment_mb,
    'updatedAt',s.updated_at
  );
end;
$function$;

create or replace function public.admin_get_message_moderation_v1()
returns jsonb
language sql
stable
set search_path to ''
as $function$ select private.admin_get_message_moderation_v1(); $function$;

create or replace function private.admin_update_message_moderation_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s private.message_moderation_settings%rowtype;
  phrases text[];
  key text;
begin
  if auth.uid() is null or not private.has_role('super_admin') then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_message_moderation_payload' using errcode='22023'; end if;

  for key in select jsonb_object_keys(p_payload) loop
    if key not in ('enabled','blockEmail','blockPhone','blockMessagingApps','blockExternalLinks','blockSocialHandles','blockBankDetails','blockExternalPayments','blockQrCodes','customBlockedPhrases','applyToSupport','allowAttachments','allowImages','allowPdf','maxAttachments','maxAttachmentMb') then raise exception 'unsupported_message_moderation_setting' using errcode='22023'; end if;
  end loop;

  if p_payload ? 'customBlockedPhrases' then
    if jsonb_typeof(p_payload->'customBlockedPhrases')<>'array' or jsonb_array_length(p_payload->'customBlockedPhrases')>100 then raise exception 'invalid_custom_blocked_phrases' using errcode='22023'; end if;
    select coalesce(array_agg(lower(btrim(value))), '{}'::text[])
      into phrases
      from jsonb_array_elements_text(p_payload->'customBlockedPhrases') t(value)
      where char_length(btrim(value)) between 2 and 80;
    if coalesce(array_length(phrases,1),0)<>jsonb_array_length(p_payload->'customBlockedPhrases') then raise exception 'invalid_custom_blocked_phrase' using errcode='22023'; end if;
  end if;

  if p_payload ? 'maxAttachments' and ((p_payload->>'maxAttachments')::int not between 0 and 5) then raise exception 'invalid_message_attachment_limit' using errcode='22023'; end if;
  if p_payload ? 'maxAttachmentMb' and ((p_payload->>'maxAttachmentMb')::int not between 1 and 20) then raise exception 'invalid_message_attachment_size' using errcode='22023'; end if;

  update private.message_moderation_settings set
    enabled=coalesce((p_payload->>'enabled')::boolean,enabled),
    block_email=coalesce((p_payload->>'blockEmail')::boolean,block_email),
    block_phone=coalesce((p_payload->>'blockPhone')::boolean,block_phone),
    block_messaging_apps=coalesce((p_payload->>'blockMessagingApps')::boolean,block_messaging_apps),
    block_external_links=coalesce((p_payload->>'blockExternalLinks')::boolean,block_external_links),
    block_social_handles=coalesce((p_payload->>'blockSocialHandles')::boolean,block_social_handles),
    block_bank_details=coalesce((p_payload->>'blockBankDetails')::boolean,block_bank_details),
    block_external_payments=coalesce((p_payload->>'blockExternalPayments')::boolean,block_external_payments),
    block_qr_codes=coalesce((p_payload->>'blockQrCodes')::boolean,block_qr_codes),
    custom_blocked_phrases=case when p_payload ? 'customBlockedPhrases' then phrases else custom_blocked_phrases end,
    apply_to_support=coalesce((p_payload->>'applyToSupport')::boolean,apply_to_support),
    allow_attachments=coalesce((p_payload->>'allowAttachments')::boolean,allow_attachments),
    allow_images=coalesce((p_payload->>'allowImages')::boolean,allow_images),
    allow_pdf=coalesce((p_payload->>'allowPdf')::boolean,allow_pdf),
    max_attachments=coalesce((p_payload->>'maxAttachments')::smallint,max_attachments),
    max_attachment_mb=coalesce((p_payload->>'maxAttachmentMb')::smallint,max_attachment_mb),
    updated_by=auth.uid(),
    updated_at=timezone('utc',now())
  where singleton=true
  returning * into s;

  return private.admin_get_message_moderation_v1();
end;
$function$;

create or replace function public.admin_update_message_moderation_v1(p_payload jsonb)
returns jsonb
language sql
set search_path to ''
as $function$ select private.admin_update_message_moderation_v1(p_payload); $function$;

create or replace function private.get_my_message_policy_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare s private.message_moderation_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into s from private.message_moderation_settings where singleton=true;
  if not found then raise exception 'message_moderation_configuration_missing' using errcode='55000'; end if;
  return jsonb_build_object(
    'producerProtectionEnabled',s.enabled,
    'allowAttachments',s.allow_attachments,
    'allowImages',s.allow_images,
    'allowPdf',s.allow_pdf,
    'maxAttachments',s.max_attachments,
    'maxAttachmentMb',s.max_attachment_mb
  );
end;
$function$;

create or replace function public.get_my_message_policy_v1()
returns jsonb
language sql
stable
set search_path to ''
as $function$ select private.get_my_message_policy_v1(); $function$;

create or replace function private.list_my_producer_conversations_v1(p_limit integer default 50,p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  caller_id uuid:=auth.uid();
  producer_id_value uuid;
  result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;

  select p.id into producer_id_value
  from public.producers p
  where p.owner_user_id=caller_id and p.deleted_at is null
  order by p.created_at
  limit 1;

  if producer_id_value is null then raise exception 'producer_required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(item order by sort_time desc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',conversation.id,
      'type',conversation.conversation_type,
      'orderId',conversation.order_id,
      'producerId',conversation.producer_id,
      'productId',conversation.product_id,
      'subject',conversation.subject,
      'status',conversation.status,
      'updatedAt',conversation.updated_at,
      'lastMessageAt',conversation.last_message_at,
      'title',coalesce((
        select profile.display_name
        from public.conversation_participants other_participant
        join public.profiles profile on profile.id=other_participant.user_id
        where other_participant.conversation_id=conversation.id and other_participant.user_id<>caller_id
        order by other_participant.created_at
        limit 1
      ),'Müşteri'),
      'lastMessage',coalesce((
        select case when m.deleted_at is null then left(m.body,180) else 'Mesaj kaldırıldı' end
        from public.messages m
        where m.conversation_id=conversation.id
        order by m.created_at desc
        limit 1
      ),''),
      'unreadCount',(
        select count(*)
        from public.messages m
        where m.conversation_id=conversation.id
          and m.sender_user_id<>caller_id
          and m.created_at>coalesce(participant.last_read_at,'epoch'::timestamptz)
      )
    ) item,
    coalesce(conversation.last_message_at,conversation.updated_at) sort_time
    from public.conversation_participants participant
    join public.conversations conversation on conversation.id=participant.conversation_id
    where participant.user_id=caller_id
      and conversation.conversation_type='producer'
      and conversation.producer_id=producer_id_value
    order by coalesce(conversation.last_message_at,conversation.updated_at) desc
    limit p_limit offset p_offset
  ) rows;

  return result;
end;
$function$;

create or replace function public.list_my_producer_conversations_v1(p_limit integer default 50,p_offset integer default 0)
returns jsonb
language sql
stable
set search_path to ''
as $function$ select private.list_my_producer_conversations_v1(p_limit,p_offset); $function$;