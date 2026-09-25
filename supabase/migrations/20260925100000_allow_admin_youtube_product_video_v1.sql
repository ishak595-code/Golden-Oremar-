-- Allow admins to set a YouTube link as a product video.
--
-- The operator approved YouTube links for the official store. Two layers
-- blocked them: the product workflow contract in the admin UI, and this write
-- function, which raised stored_product_video_required for any value that was
-- not a verified storage path. Changing only the UI would have produced a form
-- whose save the server rejects.
--
-- Scope, deliberately narrow:
--   * only public.management_upsert_product_v2 (admin, product.update
--     permission, staff MFA enforced by private.has_permission) accepts
--     YouTube links
--   * public.producer_upsert_product_v2 is untouched: third-party producers
--     keep upload-only video, because an approved YouTube video can be swapped
--     by the channel owner after approval
--   * uploaded-file rules are unchanged: a non-YouTube value must still be a
--     verified storage path the admin owns
--   * serving is separately gated: detail v10 returns a YouTube video only for
--     official-store products
--
-- The downstream writer, private.management_upsert_product_core_v1, already
-- caps the value at 2048 characters and rejects blob: and data:, both of which
-- a YouTube link passes.
--
-- The YouTube pattern lives in one function, private.is_youtube_video_url_v1,
-- used by both the write path and detail v10, so the value accepted on save is
-- exactly the value served on read. Its grants mirror
-- private.verified_product_video_path_v1: postgres and authenticated only.
--
-- Verified on production before commit, inside a transaction that stubbed only
-- private.has_permission and then rolled back (no admin currently has a
-- verified TOTP factor, so the real gate cannot be passed in a test):
--   YouTube Shorts link          -> saved, stored value correct
--   https://evil.example/... mp4 -> stored_product_video_required
--   unverified storage path      -> stored_product_video_required
-- Afterwards private.has_permission was confirmed back to its MFA-enforcing
-- definition with SECURITY DEFINER intact, and the product's video still null.
--
-- Resulting definitions (md5 of pg_get_functiondef):
--   public.management_upsert_product_v2   0c97dfa0e01d5ac70ef8aa18a224bed9
--   private.get_public_product_detail_v10 c4474de793cc7040a181e981b8ffe03d
--   private.is_youtube_video_url_v1       5b203128a44095462196123660948699

create or replace function private.is_youtube_video_url_v1(p_value text)
 returns boolean
 language sql
 immutable
 set search_path to ''
as $function$
  select coalesce(
    char_length(p_value) <= 2000
    and p_value ~* '^https://((www|m)\.)?(youtube\.com/(watch\?v=|shorts/|embed/|live/)|youtu\.be/|youtube-nocookie\.com/embed/)[A-Za-z0-9_-]{11}([?&#/].*)?$',
    false
  );
$function$;

revoke all on function private.is_youtube_video_url_v1(text) from public, anon;
grant execute on function private.is_youtube_video_url_v1(text) to authenticated;

create or replace function public.management_upsert_product_v2(p_reference text, p_payload jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  caller_id uuid:=auth.uid();
  safe_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  editorial jsonb;
  requested_publish boolean:=false;
  result jsonb;
  product_id uuid;
  editorial_result jsonb;
  weight_value numeric;
  video_value text;
  existing_product_id uuid:=private.resolve_product_id_v1(p_reference);
  existing_video text;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>393216 then raise exception 'invalid_product_payload' using errcode='22023'; end if;
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  if existing_product_id is not null then select p.specifications->>'video' into existing_video from public.products p where p.id=existing_product_id and p.deleted_at is null; end if;
  if p_payload ? 'video' and nullif(btrim(coalesce(p_payload->>'video','')),'') is not null then
    video_value:=btrim(p_payload->>'video');
    -- A YouTube link is accepted from admins as-is; there is no stored object
    -- to verify. It is served only for official-store products (detail v10).
    if not private.is_youtube_video_url_v1(video_value) then
      if private.verified_product_video_path_v1(video_value) is null then raise exception 'stored_product_video_required' using errcode='55000'; end if;
      if video_value is distinct from existing_video and video_value not like 'admin/'||caller_id::text||'/%' then raise exception 'admin_owned_product_video_required' using errcode='42501'; end if;
    end if;
  end if;
  editorial:=case when p_payload ? 'editorial' then p_payload->'editorial' else null end;
  if editorial is not null and jsonb_typeof(editorial)<>'object' then raise exception 'invalid_product_editorial_payload' using errcode='22023'; end if;
  requested_publish:=coalesce((p_payload->>'is_approved')::boolean,false);
  safe_payload:=safe_payload-'editorial';
  result:=private.management_upsert_product_v2(p_reference,safe_payload);
  if editorial is not null then
    begin product_id:=(result->>'databaseId')::uuid; exception when others then raise exception 'product_write_result_invalid' using errcode='55000'; end;
    if requested_publish then
      perform private.publish_product_editorial_v1(product_id,editorial,caller_id);
      editorial_result:=jsonb_build_object('status','published','productId',product_id);
    else
      editorial_result:=private.save_product_editorial_v1(product_id::text,editorial,'save',null);
    end if;
    result:=result||jsonb_build_object('editorial',editorial_result);
  end if;
  return result;
end;
$function$;

create or replace function private.get_public_product_detail_v10(p_reference text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  base jsonb := private.get_public_product_detail_v9(p_reference);
  product_id uuid;
  raw_video text;
  store_kind text;
begin
  if base = '{}'::jsonb then return base; end if;
  begin
    product_id := (base->>'id')::uuid;
  exception when others then
    product_id := private.resolve_product_id_v1(p_reference);
  end;
  if product_id is null then return base; end if;

  select nullif(btrim(coalesce(p.specifications->>'video','')),''), pr.store_kind
    into raw_video, store_kind
  from public.products p
  join public.producers pr on pr.id = p.producer_id
  where p.id = product_id;

  if raw_video is null or char_length(raw_video) > 2000 then return base; end if;

  if private.is_youtube_video_url_v1(raw_video) then
    if store_kind = 'official' then
      return base || jsonb_build_object('video', jsonb_build_object('kind','youtube','url',raw_video));
    end if;
    return base;
  end if;

  if raw_video !~ '^[a-z]+:' and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'catalog-public' and o.name = raw_video
  ) then
    return base || jsonb_build_object('video', jsonb_build_object('kind','file','path',raw_video));
  end if;

  return base;
end;
$function$;
