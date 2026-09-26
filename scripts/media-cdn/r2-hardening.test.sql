-- Rollback-only test for migration r2_media_hardening_v1 (run after it in the
-- same batch; the final RAISE aborts everything).
do $t$
declare
  r text[] := '{}';
  admin_uid uuid := '67895865-4a76-4219-b8dd-849c4fd782d5';
  other uuid := gen_random_uuid();
  a text; b text; c text; res jsonb; gc jsonb; n int;
begin
  update private.media_cdn_settings set enabled = true, public_base_url = 'https://pub-test.r2.dev';
  a := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.webp';
  b := 'admin/' || admin_uid || '/categories/' || gen_random_uuid() || '.webp';
  c := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.png';
  res := private.media_direct_reserve_v2(admin_uid, 'catalog-public', a, 1000, 'image/webp');
  r := r || ('reserve=' || (res->>'status') || ' staging ok=' || ((res->>'staging') ~ '^_incoming/[0-9a-f-]{36}$'));
  r := r || ('reservation=' || coalesce(private.media_direct_reservation_v1(admin_uid, 'catalog-public', a)->>'size', 'null')
         || ' other sees=' || coalesce(private.media_direct_reservation_v1(other, 'catalog-public', a)::text, 'null'));
  update private.media_cdn_settings set user_daily_bytes = 1500;
  r := r || ('daily limit=' || (private.media_direct_reserve_v2(admin_uid, 'catalog-public', b, 1000, 'image/webp')->>'status'));
  update private.media_cdn_settings set user_daily_bytes = 1073741824;
  perform private.media_direct_reserve_v2(admin_uid, 'catalog-public', b, 1000, 'image/webp');
  perform private.media_direct_confirm_v1(admin_uid, 'catalog-public', a, 1000, 'image/webp', repeat('a',64), 1600, 1200);
  perform private.media_direct_confirm_v1(admin_uid, 'catalog-public', b, 1000, 'image/webp', repeat('b',64), 1600, 1200);
  r := r || ('staging cleared=' || ((select staging_key from private.media_cdn_objects where object_name = a) is null));
  -- forget refuses a confirmed, unmarked row
  r := r || ('forget confirmed=' || private.media_cdn_forget_v1('catalog-public', a));
  -- cancel: other user refused; own young unreferenced accepted and immediately invisible
  r := r || ('begin release other=' || coalesce(private.media_direct_begin_release_v1(other, 'catalog-public', a)::text, 'null'));
  res := private.media_direct_begin_release_v1(admin_uid, 'catalog-public', a);
  r := r || ('begin release own=' || coalesce(res->>'name' = a, false) || ' helper after mark=' || coalesce(private.verified_public_storage_path_v1('catalog-public', a), 'null'));
  r := r || ('finish release=' || private.media_direct_finish_release_v1(admin_uid, 'catalog-public', a));
  -- referenced files cannot be cancelled
  update public.categories set image_path = b where id = (select id from public.categories limit 1);
  r := r || ('begin release referenced=' || coalesce(private.media_direct_begin_release_v1(admin_uid, 'catalog-public', b)::text, 'null'));
  -- old files cannot be cancelled by users (bounded scans)
  perform private.media_direct_reserve_v2(admin_uid, 'catalog-public', c, 500, 'image/png');
  perform private.media_direct_confirm_v1(admin_uid, 'catalog-public', c, 500, 'image/png', repeat('c',64), 1600, 1200);
  update private.media_cdn_objects set reserved_at = now() - interval '2 days' where object_name = c;
  r := r || ('begin release old=' || coalesce(private.media_direct_begin_release_v1(admin_uid, 'catalog-public', c)::text, 'null'));
  -- GC: first scan only notes the file, a scan 72h later collects it; referenced b never
  update private.media_cdn_objects set reserved_at = now() - interval '4 days', last_reference_check_at = null where object_name in (b, c);
  gc := private.media_gc_candidates_v2(50);
  r := r || ('gc first scan deletes=' || jsonb_array_length(gc->'delete')
         || ' c noted=' || ((select first_unreferenced_at from private.media_cdn_objects where object_name = c) is not null)
         || ' b noted=' || ((select first_unreferenced_at from private.media_cdn_objects where object_name = b) is not null));
  update private.media_cdn_objects set first_unreferenced_at = now() - interval '73 hours', last_reference_check_at = now() - interval '7 hours' where object_name in (b, c);
  gc := private.media_gc_candidates_v2(50);
  r := r || ('gc second scan=' || (select string_agg(right(d->>'name', 9), ',') from jsonb_array_elements(gc->'delete') d)
         || ' c confirmed=' || (select confirmed from private.media_cdn_objects where object_name = c)
         || ' b confirmed=' || (select confirmed from private.media_cdn_objects where object_name = b)
         || ' b first_unref reset=' || ((select first_unreferenced_at from private.media_cdn_objects where object_name = b) is null));
  r := r || ('forget marked=' || private.media_cdn_forget_v1('catalog-public', c));
  -- adopted free-form files are never collected
  insert into private.media_cdn_objects (bucket_id, object_name, byte_size, content_type, confirmed, reserved_at, origin, media_kind, sha256)
  values ('content-public', 'banners/summer.jpg', 10, 'image/jpeg', true, now() - interval '30 days', 'direct', 'adopted', repeat('e',64));
  gc := private.media_gc_candidates_v2(50);
  r := r || ('adopted collected=' || (select count(*) from jsonb_array_elements(gc->'delete') d where d->>'name' = 'banners/summer.jpg'));
  -- abandoned upload is marked and returned with its staging key
  res := private.media_direct_reserve_v2(admin_uid, 'catalog-public', a, 700, 'image/webp');
  update private.media_cdn_objects set reserved_at = now() - interval '2 hours' where object_name = a;
  gc := private.media_gc_candidates_v2(50);
  r := r || ('abandoned=' || (select count(*) from jsonb_array_elements(gc->'delete') d where d->>'name' = a and d->>'staging' = res->>'staging'));
  r := r || ('plan flags=' || (select (p->>'offloadSources') || '/' || (p->>'stagingSweepDue') from (select private.media_cdn_plan_v1(5) p) x));
  r := r || ('has_work=' || private.media_cdn_has_work_v1());
  perform private.media_staging_swept_v1();
  r := r || ('swept flag=' || (private.media_cdn_plan_v1(5)->>'stagingSweepDue'));
  r := r || ('anon begin_release=' || has_function_privilege('anon', 'public.service_media_direct_begin_release_v1(uuid,text,text)', 'execute')
         || ' auth reserve2=' || has_function_privilege('authenticated', 'public.service_media_direct_reserve_v2(uuid,text,text,bigint,text)', 'execute'));
  raise exception 'TEST_RESULTS %', array_to_string(r, ' | ');
end;
$t$;
