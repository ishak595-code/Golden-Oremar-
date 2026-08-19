create or replace function private.can_upload_message_attachment_v1(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  caller_id uuid:=auth.uid();
  owner_segment text:=split_part(coalesce(p_name,''),'/',1);
  conversation_segment text:=split_part(coalesce(p_name,''),'/',2);
  conversation_id_value uuid;
  settings private.message_moderation_settings%rowtype;
begin
  if caller_id is null or owner_segment<>caller_id::text then return false; end if;
  if conversation_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  conversation_id_value:=conversation_segment::uuid;
  select * into settings from private.message_moderation_settings where singleton=true;
  if not found or not settings.allow_attachments or settings.max_attachments<=0 then return false; end if;
  return exists(
    select 1
    from public.conversation_participants participant
    join public.conversations conversation on conversation.id=participant.conversation_id
    where participant.user_id=caller_id
      and participant.conversation_id=conversation_id_value
      and conversation.status<>'closed'
  );
end;
$function$;

drop policy if exists storage_message_attachments_insert_own_v1 on storage.objects;
create policy storage_message_attachments_insert_own_v2
on storage.objects
for insert
to authenticated
with check (
  bucket_id='message-attachments'
  and private.can_upload_message_attachment_v1(name)
);