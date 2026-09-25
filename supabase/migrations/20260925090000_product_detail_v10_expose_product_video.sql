-- Expose a product's own video on the public product detail.
--
-- Until now a product video could be uploaded in the admin panel and was
-- stored in products.specifications.video, but no public detail version ever
-- returned it, so customers never saw it. v10 follows the existing layering
-- pattern exactly - each version takes the previous one and adds a field -
-- so it is additive, backward compatible and reversible by pointing the
-- bridge back at v9.
--
-- Two kinds of value are accepted, and everything else is dropped:
--
--   YouTube link  - returned ONLY for official-store products. This is the
--                   anti-fraud rule the product workflow contract already
--                   enforces in the seller UI, now enforced where it cannot be
--                   bypassed: an approved YouTube video can be swapped by the
--                   channel owner after approval, so a third-party producer's
--                   link is never served, even if one reached the column
--                   through the API rather than the wizard.
--   Storage path  - returned only if the object actually exists in the
--                   catalog-public bucket, so a stale or invented path never
--                   reaches a player.
--
-- Output shape: "video": {"kind":"youtube","url":...} or
--               "video": {"kind":"file","path":...}; absent otherwise.
--
-- Verified on production before commit: detail still returns all 29 v9 fields
-- for anon; the YouTube pattern accepts watch, youtu.be and shorts and rejects
-- http, a spoofed evil.com/youtube.com path and a malformed id; and in a
-- rolled-back transaction an official-store product served its YouTube link
-- while the same product under an independent producer served nothing.

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

  if raw_video ~* '^https://((www|m)\.)?(youtube\.com/(watch\?v=|shorts/|embed/|live/)|youtu\.be/|youtube-nocookie\.com/embed/)[A-Za-z0-9_-]{11}([?&#/].*)?$' then
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

create or replace function api_public_bridge.get_public_product_detail_v6(p_reference text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$ select private.get_public_product_detail_v10(p_reference); $function$;
