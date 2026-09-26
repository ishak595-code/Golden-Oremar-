-- Rollback-only test of 20260926210000_r2_media_race_fixes_v1.sql.
-- Run the migration text followed by this block in ONE execute_sql call; the
-- final raise rolls everything back and prints the results.
do $t$
declare
  r text[] := '{}';
  admin_uid uuid := '67895865-4a76-4219-b8dd-849c4fd782d5';
  other uuid := gen_random_uuid();
  a text; b text; c text; d text; res jsonb; gc jsonb; ok boolean;
begin
  update private.media_cdn_settings set enabled = true, public_base_url = 'https://pub-test.r2.dev', user_daily_bytes = 3000, last_staging_sweep_at = null;
  a := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.webp';
  b := 'admin/' || admin_uid || '/categories/' || gen_random_uuid() || '.webp';
  c := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.png';
  d := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.png';

  -- Allowance is not refunded by a cancel.
  res := private.media_direct_reserve_v2(admin_uid, 'catalog-public', a, 1000, 'image/webp');
  r := r || ('usage after reserve=' || private.media_user_recent_bytes_v1(admin_uid));
  res := private.media_direct_begin_release_v2(admin_uid, 'catalog-public', a, true);
  r := r || ('cancel unconfirmed deferred=' || (res->>'deferred') || ' finish=' || private.media_direct_finish_release_v1(admin_uid, 'catalog-public', a));
  r := r || ('usage after cancel=' || private.media_user_recent_bytes_v1(admin_uid));
  perform private.media_direct_reserve_v2(admin_uid, 'catalog-public', a, 1000, 'image/webp');
  r := r || ('third reserve over 3000=' || (private.media_direct_reserve_v2(admin_uid, 'catalog-public', b, 1500, 'image/webp')->>'status'));
  update private.media_cdn_settings set user_daily_bytes = 1073741824;

  -- Publishing claim.
  r := r || ('confirm without claim=' || private.media_direct_confirm_v1(admin_uid, 'catalog-public', a, 1000, 'image/webp', repeat('a',64), 1600, 1200));
  res := private.media_direct_begin_publish_v1(admin_uid, 'catalog-public', a);
  r := r || ('claim=' || coalesce(res->>'size', 'null') || ' second claim=' || coalesce(private.media_direct_begin_publish_v1(admin_uid, 'catalog-public', a)::text, 'null')
         || ' other user claim=' || coalesce(private.media_direct_begin_publish_v1(other, 'catalog-public', a)::text, 'null'));
  r := r || ('cancel while publishing=' || coalesce(private.media_direct_begin_release_v2(admin_uid, 'catalog-public', a, true)::text, 'null'));
  update private.media_cdn_objects set reserved_at = now() - interval '2 hours' where object_name = a;
  gc := private.media_gc_candidates_v3(50);
  r := r || ('gc skips publishing=' || ((select count(*) from jsonb_array_elements(gc->'delete') x where x->>'name' = a) = 0)
         || ' still not deleting=' || ((select deleting_at from private.media_cdn_objects where object_name = a) is null));
  update private.media_cdn_objects set reserved_at = now() where object_name = a;
  -- Two statements: a subquery in the same expression would read the row
  -- from before the confirm.
  ok := private.media_direct_confirm_v1(admin_uid, 'catalog-public', a, 1000, 'image/webp', repeat('a',64), 1600, 1200);
  r := r || ('confirm with claim=' || ok || ' claim cleared=' || ((select publishing_at from private.media_cdn_objects where object_name = a) is null));
  r := r || ('claim after confirm=' || coalesce(private.media_direct_begin_publish_v1(admin_uid, 'catalog-public', a)::text, 'null'));

  -- Release of a confirmed file: refusals never, cancel only deferred.
  r := r || ('reject path on confirmed=' || coalesce(private.media_direct_begin_release_v2(admin_uid, 'catalog-public', a, false)::text, 'null'));
  res := private.media_direct_begin_release_v2(admin_uid, 'catalog-public', a, true);
  r := r || ('cancel confirmed deferred=' || (res->>'deferred')
         || ' usable now=' || coalesce(private.verified_public_storage_path_v1('catalog-public', a), 'null')
         || ' finish_release=' || private.media_direct_finish_release_v1(admin_uid, 'catalog-public', a)
         || ' forget early=' || private.media_cdn_forget_v1('catalog-public', a));

  -- The second check restores a file that got used in the meantime.
  update public.categories set image_path = a where id = (select id from public.categories limit 1);
  update private.media_cdn_objects set delete_after = now() - interval '1 minute' where object_name = a;
  gc := private.media_gc_candidates_v3(50);
  r := r || ('referenced meanwhile restored=' || (select confirmed and binary_verified and deleting_at is null from private.media_cdn_objects where object_name = a)
         || ' not handed out=' || ((select count(*) from jsonb_array_elements(gc->'delete') x where x->>'name' = a) = 0));

  -- Reference-scan path: marked, handed out only after the delay.
  perform private.media_direct_reserve_v2(admin_uid, 'catalog-public', c, 500, 'image/png');
  perform private.media_direct_begin_publish_v1(admin_uid, 'catalog-public', c);
  perform private.media_direct_confirm_v1(admin_uid, 'catalog-public', c, 500, 'image/png', repeat('c',64), 1600, 1200);
  update private.media_cdn_objects set reserved_at = now() - interval '5 days', first_unreferenced_at = now() - interval '73 hours', last_reference_check_at = now() - interval '7 hours' where object_name = c;
  gc := private.media_gc_candidates_v3(50);
  r := r || ('scan marks=' || ((select deleting_at from private.media_cdn_objects where object_name = c) is not null)
         || ' handed out at once=' || ((select count(*) from jsonb_array_elements(gc->'delete') x where x->>'name' = c) > 0));
  update private.media_cdn_objects set delete_after = now() - interval '1 minute' where object_name = c;
  gc := private.media_gc_candidates_v3(50);
  r := r || ('after delay handed out=' || ((select count(*) from jsonb_array_elements(gc->'delete') x where x->>'name' = c) = 1)
         || ' forget=' || private.media_cdn_forget_v1('catalog-public', c));

  -- Abandoned upload: handed out at once with its staging key.
  res := private.media_direct_reserve_v2(admin_uid, 'catalog-public', d, 500, 'image/png');
  update private.media_cdn_objects set reserved_at = now() - interval '2 hours' where object_name = d;
  gc := private.media_gc_candidates_v3(50);
  r := r || ('abandoned=' || (select count(*) from jsonb_array_elements(gc->'delete') x where x->>'name' = d and x->>'staging' = res->>'staging'));

  -- Settings, plan, sweep.
  r := r || ('target=' || (select (t->>'stagingBucket') || '/' || (t->>'signContentLength') from (select private.media_cdn_target_v1() t) x)
         || ' plan staging=' || (private.media_cdn_plan_v1(5)->>'stagingBucket'));
  begin
    update private.media_cdn_settings set r2_staging_bucket = r2_bucket;
    r := array_append(r, 'same bucket allowed=true');
  exception when check_violation then
    r := array_append(r, 'same bucket allowed=false');
  end;
  perform private.media_staging_swept_v1();
  r := r || ('sweep due right after uploads=' || private.media_staging_sweep_due_v1());
  update private.media_upload_usage set used_at = now() - interval '2 hours';
  r := r || ('sweep due once quiet=' || private.media_staging_sweep_due_v1());
  r := r || ('usage table private=' || (not has_table_privilege('authenticated', 'private.media_upload_usage', 'select'))
         || ' anon claim=' || has_function_privilege('anon', 'public.service_media_direct_begin_publish_v1(uuid,text,text)', 'execute')
         || ' auth gc=' || has_function_privilege('authenticated', 'public.service_media_gc_candidates_v3(integer)', 'execute')
         || ' old gone=' || (to_regprocedure('public.service_media_gc_candidates_v2(integer)') is null and to_regprocedure('public.service_media_direct_begin_release_v1(uuid,text,text)') is null));
  raise exception 'TEST_RESULTS %', array_to_string(r, ' | ');
end;
$t$;
