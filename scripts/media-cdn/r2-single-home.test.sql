-- Rollback-only test for migration r2_single_home_for_public_media_v1.
-- Run AFTER the migration text in the same statement batch; the final
-- RAISE aborts the whole batch, so nothing is kept. Every line of the report
-- is "name=value"; a reviewer compares against the expectations in the
-- comments.
do $t$
declare
  r text[] := '{}';
  admin_uid uuid := '67895865-4a76-4219-b8dd-849c4fd782d5';
  other uuid := gen_random_uuid();
  official uuid;
  official_img text; category_img text; brand_logo text; video text; stray text;
  png record; plan jsonb; gc jsonb; n int; ok boolean; txt text;
begin
  select id into official from public.producers where store_kind = 'official' limit 1;
  update private.media_cdn_settings set enabled = true, public_base_url = 'https://pub-test.r2.dev';

  -- the four functions now read the view (expect 4)
  select count(*) into n from pg_proc where oid in ('private.admin_operations_overview_v2()'::regprocedure, 'private.super_admin_catalog_media_health_v3()'::regprocedure,
    'private.super_admin_get_production_readiness_snapshot_v1()'::regprocedure, 'private.validate_product_change_payload_v1(uuid,uuid,uuid,jsonb)'::regprocedure)
    and strpos(prosrc, 'private.media_objects_all') > 0 and strpos(prosrc, 'storage.objects') = 0;
  r := r || ('patched=' || n);
  -- view lists the 11 Supabase objects of catalog-public (expect 11)
  r := r || ('view catalog before=' || (select count(*) from private.media_objects_all where bucket_id = 'catalog-public'));

  official_img := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.webp';
  category_img := 'admin/' || admin_uid || '/categories/' || gen_random_uuid() || '.webp';
  brand_logo := official || '/profile/logo-' || gen_random_uuid() || '.webp';
  video := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.mp4';

  -- kinds (expect official-image, category-image, brand-logo, official-video, event-image, null, null)
  r := r || ('kinds=' || concat_ws(',', private.media_direct_kind_v1('catalog-public', official_img), private.media_direct_kind_v1('catalog-public', category_img),
    private.media_direct_kind_v1('catalog-public', brand_logo), private.media_direct_kind_v1('catalog-public', video),
    private.media_direct_kind_v1('event-public', official || '/events/' || gen_random_uuid() || '.jpg'),
    coalesce(private.media_direct_kind_v1('catalog-public', '../x.webp'), 'null'), coalesce(private.media_direct_kind_v1('user-private', official_img), 'null')));

  -- reservation rules (expect owner_mismatch, invalid_name, invalid_name, size_invalid, size_invalid, owner_mismatch, reserved x4)
  r := r || ('other user admin path=' || private.media_direct_reserve_v1(other, 'catalog-public', official_img, 1000, 'image/webp'));
  r := r || ('ext mismatch=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', official_img, 1000, 'image/png'));
  r := r || ('video type on image path=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', official_img, 1000, 'video/mp4'));
  r := r || ('image over 10MB=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', official_img, 10485761, 'image/webp'));
  r := r || ('brand over 5MB=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', brand_logo, 5242881, 'image/webp'));
  r := r || ('event without owner=' || private.media_direct_reserve_v1(admin_uid, 'event-public', official || '/events/' || gen_random_uuid() || '.jpg', 1000, 'image/jpeg'));
  r := r || ('official img=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', official_img, 1000, 'image/webp'));
  r := r || ('category img=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', category_img, 1000, 'image/webp'));
  r := r || ('brand logo official=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', brand_logo, 1000, 'image/webp'));
  r := r || ('video=' || private.media_direct_reserve_v1(admin_uid, 'catalog-public', video, 2000, 'video/mp4'));

  -- not visible anywhere before confirm (expect null null null)
  r := r || ('before confirm=' || concat_ws(',', coalesce(private.verified_public_storage_path_v1('catalog-public', official_img), 'null'),
    coalesce(private.catalog_media_binary_verified_path_v2(official_img), 'null'), coalesce(private.verified_product_video_path_v1(video), 'null')));

  -- confirm rules (expect false false true true true true)
  r := r || ('confirm other user=' || private.media_direct_confirm_v1(other, 'catalog-public', official_img, 1000, 'image/webp', repeat('a', 64), 1600, 1200));
  r := r || ('confirm bad sha=' || private.media_direct_confirm_v1(admin_uid, 'catalog-public', official_img, 1000, 'image/webp', 'nope', 1600, 1200));
  r := r || ('confirm img=' || private.media_direct_confirm_v1(admin_uid, 'catalog-public', official_img, 1000, 'image/webp', repeat('a', 64), 1600, 1200));
  r := r || ('confirm cat=' || private.media_direct_confirm_v1(admin_uid, 'catalog-public', category_img, 1000, 'image/webp', repeat('b', 64), 1600, 1200));
  r := r || ('confirm logo=' || private.media_direct_confirm_v1(admin_uid, 'catalog-public', brand_logo, 1000, 'image/webp', repeat('c', 64), 1024, 1024));
  r := r || ('confirm video=' || private.media_direct_confirm_v1(admin_uid, 'catalog-public', video, 2000, 'video/mp4', repeat('d', 64), null, null));

  -- now every helper sees them (expect all true)
  r := r || ('after confirm=' || concat_ws(',', private.verified_public_storage_path_v1('catalog-public', official_img) = official_img,
    private.catalog_media_binary_verified_path_v2(official_img) = official_img, private.verified_catalog_product_image_path_v1(category_img) = category_img,
    private.store_branding_verified_path_v1(official, 'logo', brand_logo) = brand_logo, private.verified_product_video_path_v1(video) = video,
    private.media_public_url_v1('catalog-public', video) = 'https://pub-test.r2.dev/catalog-public/' || video));
  -- a video is never a "verified catalogue image" (expect null)
  r := r || ('video as image=' || coalesce(private.catalog_media_binary_verified_path_v2(video), 'null'));
  -- view now has the 4 R2 objects too (expect 15)
  r := r || ('view catalog after=' || (select count(*) from private.media_objects_all where bucket_id = 'catalog-public'));

  -- reference scan (expect: brand profile referenced -> empty; fresh names -> free)
  r := r || ('referenced brand=' || coalesce(array_length(private.media_unreferenced_v1(array['brand/official-store/golden-oremar-profile.webp']), 1), 0));
  r := r || ('free fresh=' || coalesce(array_length(private.media_unreferenced_v1(array[official_img, category_img]), 1), 0));
  -- the same scan sees a JSON reference (expect 0 after binding the video to a product)
  update public.products set specifications = coalesce(specifications, '{}'::jsonb) || jsonb_build_object('video', video)
  where id = (select id from public.products where producer_id = official limit 1);
  r := r || ('video after binding=' || coalesce(array_length(private.media_unreferenced_v1(array[video]), 1), 0));

  -- release rules (expect false for other user, false for referenced video, true for unreferenced image)
  r := r || ('release by other=' || private.media_direct_release_v1(other, 'catalog-public', official_img));
  r := r || ('release referenced video=' || private.media_direct_release_v1(admin_uid, 'catalog-public', video));
  r := r || ('release unreferenced=' || private.media_direct_release_v1(admin_uid, 'catalog-public', category_img));

  -- garbage collection: age everything, expect official_img (unreferenced) in, video (referenced) out
  update private.media_cdn_objects set reserved_at = now() - interval '4 days', last_reference_check_at = null where origin = 'direct';
  gc := private.media_gc_candidates_v1(50);
  r := r || ('gc img=' || (select count(*) from jsonb_array_elements(gc->'delete') d where d->>'name' = official_img)
         || ' gc video=' || (select count(*) from jsonb_array_elements(gc->'delete') d where d->>'name' = video)
         || ' gc logo(unreferenced, official)=' || (select count(*) from jsonb_array_elements(gc->'delete') d where d->>'name' = brand_logo));
  -- checked objects are not re-scanned for 6 hours (expect 0)
  gc := private.media_gc_candidates_v1(50);
  r := r || ('gc rescan=' || jsonb_array_length(gc->'delete'));
  -- abandoned upload is collected without a scan (expect 1)
  stray := 'admin/' || admin_uid || '/official-products/' || gen_random_uuid() || '.png';
  perform private.media_direct_reserve_v1(admin_uid, 'catalog-public', stray, 500, 'image/png');
  update private.media_cdn_objects set reserved_at = now() - interval '2 hours' where object_name = stray;
  gc := private.media_gc_candidates_v1(50);
  r := r || ('gc abandoned=' || (select count(*) from jsonb_array_elements(gc->'delete') d where d->>'name' = stray));

  -- adopting a verified Supabase PNG: binary_verified inherited only with the right sha
  select o.name, o.metadata->>'eTag' etag, (o.metadata->>'size')::bigint size, v.sha256 into png
  from storage.objects o join private.catalog_media_binary_verifications_v2 v on v.object_id = o.id where o.bucket_id = 'catalog-public' limit 1;
  update private.media_cdn_objects set reserved_at = now() - interval '1 day' where false;
  r := r || ('adopt reserve=' || private.media_adopt_reserve_v1('catalog-public', png.name, png.etag, png.size, 'image/png'));
  r := r || ('adopt confirm=' || private.media_adopt_confirm_v1('catalog-public', png.name, png.etag, png.sha256, 1, 1));
  r := r || ('adopted verified=' || (select binary_verified from private.media_cdn_objects where object_name = png.name));
  r := r || ('adopted listed once=' || (select count(*) from private.media_objects_all where bucket_id = 'catalog-public' and name = png.name)
         || ' store=' || (select store from private.media_objects_all where bucket_id = 'catalog-public' and name = png.name));
  plan := private.media_cdn_plan_v1(25);
  r := r || ('offload planned=' || (select count(*) from jsonb_array_elements(plan->'offloads') d where d->>'name' = png.name)
         || ' re-adopt planned=' || (select count(*) from jsonb_array_elements(plan->'uploads') d where d->>'name' = png.name));

  -- admin views still work with the view in place (run as the super admin)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);
  begin txt := left(private.super_admin_catalog_media_health_v3()::text, 60); r := r || ('health ok'); exception when others then r := r || ('health ERROR ' || sqlerrm); end;
  begin txt := left(private.super_admin_get_production_readiness_snapshot_v1()::text, 60); r := r || ('readiness ok'); exception when others then r := r || ('readiness ERROR ' || sqlerrm); end;
  begin txt := left(private.admin_operations_overview_v2()::text, 60); r := r || ('overview ok'); exception when others then r := r || ('overview ERROR ' || sqlerrm); end;
  begin txt := left(private.super_admin_media_cdn_status_v1()::text, 400); r := r || ('status ' || txt); exception when others then r := r || ('status ERROR ' || sqlerrm); end;

  -- privileges (expect false false true)
  r := r || ('anon reserve=' || has_function_privilege('anon', 'public.service_media_direct_reserve_v1(uuid,text,text,bigint,text)', 'execute')
         || ' authenticated gc=' || has_function_privilege('authenticated', 'public.service_media_gc_candidates_v1(integer)', 'execute')
         || ' service reserve=' || has_function_privilege('service_role', 'public.service_media_direct_reserve_v1(uuid,text,text,bigint,text)', 'execute'));
  raise exception 'TEST_RESULTS %', array_to_string(r, ' | ');
end;
$t$;
