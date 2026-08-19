drop policy if exists storage_message_attachments_update_own_unused_v1 on storage.objects;
create policy storage_message_attachments_update_own_unused_v2
on storage.objects
for update
to authenticated
using (
  bucket_id='message-attachments'
  and split_part(name,'/',1)=auth.uid()::text
  and not exists(
    select 1 from public.messages message where storage.objects.name=any(message.attachment_paths)
  )
)
with check (
  bucket_id='message-attachments'
  and private.can_upload_message_attachment_v1(name)
);