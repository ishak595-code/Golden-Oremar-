// Media (Cloudflare R2) contract audit.
//
// Every public image and video lives in R2; Supabase keeps only the facts.
// New uploads go straight to R2 through media-upload; anything that still
// lands in a public Supabase bucket is adopted by media-cdn-sync and deleted
// from Supabase. Several places must agree for that to be safe: the migrations
// (eligibility, budgets, reservations, garbage collection), the two edge
// functions, and the client (uploads, URLs, fallback). If they drift,
// customers get broken images, a used file gets deleted, or R2 fills past its
// free 10 GB. This audit locks them together.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const fn = read('supabase/functions/media-cdn-sync/index.ts');
const client = read('src/lib/mediaUrl.ts');
const migrationFile = fs.readdirSync('supabase/migrations').filter(name => name.endsWith('_add_media_cdn_mirror_v1.sql'))[0];
check(Boolean(migrationFile), 'Migration add_media_cdn_mirror_v1 is missing.');
const sql = migrationFile ? read(path.join('supabase/migrations', migrationFile)) : '';

// 1. Same buckets everywhere, and never a private one.
const PUBLIC = ['catalog-public', 'content-public', 'event-public'];
const fnBuckets = JSON.parse((fn.match(/const BUCKETS = new Set\((\[[^\]]+\])\)/)?.[1] || '[]'));
const clientBuckets = JSON.parse((client.match(/MIRRORED_BUCKETS = (\[[^\]]+\])/)?.[1] || '[]').replace(/'/g, '"'));
check(JSON.stringify(fnBuckets) === JSON.stringify(PUBLIC), `edge function buckets ${JSON.stringify(fnBuckets)} must be exactly the public buckets.`);
check(JSON.stringify(clientBuckets) === JSON.stringify(PUBLIC), `client buckets ${JSON.stringify(clientBuckets)} must be exactly the public buckets.`);
check(sql.includes("bucket_id in ('catalog-public','content-public','event-public')"), 'migration must restrict mirroring to the three public buckets.');
for (const priv of ['user-private', 'review-media', 'message-attachments', 'return-evidence', 'producer-documents', 'product-certificates', 'accounting-receipts']) {
  check(!fn.includes(priv) && !client.includes(priv) && !sql.includes(`'${priv}'`), `private bucket ${priv} must never be mirrored.`);
}

// 2. Adoption from Supabase is for images; videos go only to R2.
check(!/video\//.test(sql.match(/create or replace function private\.media_cdn_sources_v1[\s\S]*?\$\$;/)?.[0] || 'video/'), 'adoption from Supabase covers images only (videos never go to Supabase).');
check(/IMAGE_EXTENSION = \/\\\.\(jpe\?g\|png\|webp\|avif\)\$\/i/.test(client), 'client may only build CDN URLs for image extensions.');
check(fn.includes('detected !== item.contentType'), 'the worker must refuse bytes that are not the image type they claim.');

// 3. The same unsafe-name rule on both sides.
const fnUnsafe = fn.match(/!\/(.+)\/\.test\(name\)/)?.[1];
const clientUnsafe = client.match(/const UNSAFE_NAME = \/(.+)\/;/)?.[1];
check(Boolean(fnUnsafe) && fnUnsafe === clientUnsafe, 'edge function and client must use the identical unsafe-name pattern.');
check(sql.includes("o.name !~ '(^/|//|/$|(^|/)[.]{1,2}(/|$)|[\\\\[:cntrl:]])'"), 'migration must exclude unsafe object names.');

// 4. Budget: the free allowance can never be exceeded.
const single = read('supabase/migrations/20260926180000_r2_single_home_for_public_media_v1.sql');
const videoSql = read('supabase/migrations/20260926160000_direct_r2_product_video_v1.sql');
const hard = read('supabase/migrations/20260926190000_r2_media_hardening_v1.sql');
const fnBody = (source, name) => source.match(new RegExp(`create or replace function private\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] || '';
const budget = Number(sql.match(/budget_bytes bigint not null default (\d+) check \(budget_bytes between 0 and (\d+)\)/)?.[1]);
const ceiling = Number(sql.match(/budget_bytes bigint not null default \d+ check \(budget_bytes between 0 and (\d+)\)/)?.[1]);
const FREE = 10 * 1000 ** 3; // R2 free tier is 10 GB-month (decimal)
check(budget > 0 && budget <= 0.9 * FREE, `default budget ${budget} must leave at least 10% of the 10 GB free tier.`);
check(ceiling > 0 && ceiling < FREE, `budget ceiling ${ceiling} must stay below the free tier.`);
check(Number(videoSql.match(/video_budget_bytes bigint not null default (\d+)/)?.[1]) <= budget / 2, 'videos must have their own budget of at most half the total, so photos always have room.');
check(/video_budget_bytes <= budget_bytes/.test(videoSql), 'video budget must never exceed the total budget.');
const reserve = fnBody(hard, 'media_direct_reserve_v2');
check(/for update/.test(reserve) && /if total \+ p_size > s\.budget_bytes then return jsonb_build_object\('status', 'budget_full'\)/.test(reserve)
  && /videos \+ p_size > s\.video_budget_bytes then return jsonb_build_object\('status', 'budget_full'\)/.test(reserve), 'direct uploads must be reserved under a lock against both budgets.');
check(/pending >= 20 then return jsonb_build_object\('status', 'too_many_pending'\)/.test(reserve), 'a user may hold only a bounded number of unfinished uploads.');
const daily = Number(hard.match(/user_daily_bytes bigint not null default (\d+)/)?.[1]);
check(daily > 0 && daily <= 2 * 1024 ** 3 && /media_user_recent_bytes_v1\(p_user\) \+ p_size > s\.user_daily_bytes then return jsonb_build_object\('status', 'daily_limit'\)/.test(reserve),
  'one account may upload at most a bounded amount per day, so a single account cannot fill the storage.');
check(/media_user_recent_bytes_v1\(owner\) \+ p_size > s\.user_daily_bytes then return false/.test(fnBody(hard, 'media_adopt_reserve_v1')), 'the daily limit also applies to files adopted from Supabase.');
check(/staging := '_incoming\/' \|\| gen_random_uuid\(\)::text/.test(reserve) && /staging_key ~ '\^_incoming\/\[0-9a-f\]\{8\}/.test(hard), 'every direct upload gets its own random staging key.');
const maxBytes = fnBody(single, 'media_direct_max_bytes_v1');
check(/'brand-logo','brand-cover'\) then 5242880/.test(maxBytes) && /then 10485760/.test(maxBytes) && /s\.max_video_bytes/.test(maxBytes) && /max_video_bytes between 1 and 52428800/.test(videoSql), 'size caps: images 10 MB, brand 5 MB, videos 50 MB.');
const adopt = fnBody(hard, 'media_adopt_reserve_v1');
check(/for update/.test(adopt) && /if total \+ p_size > s\.budget_bytes then return false/.test(adopt), 'adopting from Supabase must also respect the budget under a lock.');
const upload = read('supabase/functions/media-upload/index.ts');
check(upload.indexOf('service_media_direct_reserve_v2') > 0 && upload.indexOf('service_media_direct_reserve_v2') < upload.indexOf('r2.sign('), 'no upload URL may be signed before the bytes are reserved.');
check(/const signUrl = new URL\(stagingUrl\(/.test(upload) && !/const signUrl = new URL\(objectUrl\(/.test(upload), 'the device may only ever upload to its staging key, never to the public name.');
check(upload.indexOf('dimensionProblem(kind') < upload.indexOf('// Publish exactly the bytes that were checked') && /r2\.fetch\(objectUrl\(path\), \{\s*method: "PUT",\s*body: bytes,/.test(upload),
  'the public name receives only the checked bytes, written by the function after the checks.');
check(upload.indexOf('head.headers.get("content-length")') > 0 && upload.indexOf('head.headers.get("content-length")') < upload.indexOf('response.arrayBuffer()'), 'the uploaded size is checked from headers before the file is read.');
check(/signQuery: true, allHeaders: true/.test(upload), 'the upload URL must sign the content type, or any file type could be uploaded.');
check(Number(upload.match(/UPLOAD_URL_SECONDS = (\d+)/)?.[1]) <= 900, 'upload URLs must expire within 15 minutes.');
check(upload.indexOf('detectImageMime(bytes)') > 0 && upload.indexOf('dimensionProblem(kind') > 0 && upload.indexOf('videoMagicMatches(') > 0
  && Math.max(upload.indexOf('detectImageMime(bytes)'), upload.indexOf('videoMagicMatches(')) < upload.indexOf('service_media_direct_confirm_v1'), 'a file is confirmed only after its own bytes prove its type (and dimensions for images).');
check(fn.indexOf('service_media_adopt_reserve_v1') > 0 && fn.indexOf('service_media_adopt_reserve_v1') < fn.indexOf('method: "PUT"'), 'the worker must reserve in the ledger BEFORE every PUT (ledger is a superset of R2).');
check(fn.indexOf('service_media_adopt_confirm_v1') < fn.indexOf('.remove(names)'), 'a Supabase copy may be deleted only after its R2 twin is confirmed.');

// 5. Garbage collection can only ever keep a used file, never delete one.
const gc = fnBody(hard, 'media_gc_candidates_v2'), scan = fnBody(single, 'media_unreferenced_v1');
check(/not confirmed and deleting_at is null and reserved_at < now\(\) - interval '1 hour'/.test(gc) && /reserved_at < now\(\) - interval '72 hours'/.test(gc)
  && /first_unreferenced_at < now\(\) - interval '72 hours'/.test(gc), 'only unfinished uploads (1 h) and files unreferenced in two scans 72 h apart are collected.');
check(/media_kind is distinct from 'adopted'/.test(gc), 'files adopted from Supabase whose owner is unknown are never garbage-collected.');
check(/case when object_name = any\(free\) then coalesce\(first_unreferenced_at, now\(\)\) else null end/.test(gc), 'a file that is referenced again starts its 72 h wait over.');
check(/c\.table_schema in \('public','private'\)/.test(scan) && /'text','character varying','jsonb','json','ARRAY'/.test(scan), 'the reference scan must cover every text/JSON/array column of the public and private schemas.');
check(/table_name in \('audit_log','catalog_media_binary_verifications_v2','media_cdn_objects','media_cdn_failures','media_cdn_settings'\)/.test(scan), 'only audit history and media bookkeeping may be excluded from the reference scan.');
const release = fnBody(hard, 'media_direct_begin_release_v1');
check(/owner_user_id = p_user/.test(release) && /for update/.test(release) && /media_unreferenced_v1\(array\[p_name\]\)/.test(release) && /reserved_at < now\(\) - interval '24 hours' then return null/.test(release),
  'a user may cancel only their own upload, under a lock, only while nothing uses it, and only within a day.');
check(/deleting_at is not null or not confirmed or origin = 'mirror'/.test(fnBody(hard, 'media_cdn_forget_v1')), 'a confirmed file can leave the ledger only after being marked for deletion.');
check(/check \(deleting_at is null or not confirmed\)/.test(hard), 'a file marked for deletion is never served as confirmed.');
for (const [file, source] of [['media-upload', upload], ['media-cdn-sync', fn]]) {
  check(!/service_media_direct_releasable_v1|service_media_direct_release_v1|service_media_direct_reserve_v1|service_media_gc_candidates_v1/.test(source), `${file} must not call functions dropped by the hardening migration.`);
}
check(upload.indexOf('service_media_direct_begin_release_v1') < upload.indexOf('removeFromR2(objectUrl(path))') && upload.indexOf('removeFromR2(objectUrl(path))') < upload.indexOf('service_media_direct_finish_release_v1'),
  'cancel marks the row, clears R2, and only then drops the row.');
check(fn.indexOf('await deleteUrl(objectUrl(item.bucket, item.name))') < fn.indexOf('service_media_cdn_forget_v1", { p_bucket: item.bucket, p_name: item.name });\n  };'), 'the worker forgets a file only after R2 no longer has it.');
check(/if \(!putAttempted\) await service\.rpc\("service_media_cdn_forget_v1"/.test(fn), 'after a PUT was attempted the reservation stays, so a half-written file is still collected.');
check(/STAGING_MAX_AGE_MS = 2 \* 60 \* 60 \* 1000/.test(fn) && fn.includes('list.searchParams.set("prefix", "_incoming/")') && /if \(complete\) await service\.rpc\("service_media_staging_swept_v1"\)/.test(fn),
  'staging keys older than 2 hours are swept, and only a complete sweep is recorded.');
check(/offload_sources set default false/.test(hard), 'Supabase copies are kept until offloading is switched on deliberately.');

// 6. Security and cache behaviour.
check(fn.includes('service_validate_media_cdn_worker_v1') && fn.indexOf('service_validate_media_cdn_worker_v1') < fn.indexOf('Deno.env.get("R2_ACCESS_KEY_ID")'), 'the worker must authenticate its secret before anything else.');
check(fn.includes('"public, max-age=31536000, immutable"'), 'adopted objects must be served with a one-year immutable cache header.');
check(upload.indexOf('auth.getUser()') > 0 && upload.indexOf('auth.getUser()') < upload.indexOf('Deno.env.get("R2_ACCESS_KEY_ID")'), 'media-upload must identify the user before touching R2.');
check(!/VITE_[A-Z_]*R2|R2_SECRET|R2_ACCESS/.test(client + read('src/lib/directMediaUpload.ts')), 'no R2 credential may ever appear in client code.');
for (const grant of ['service_media_direct_confirm_v1', 'service_media_adopt_reserve_v1', 'service_media_adopt_confirm_v1']) {
  check(single.includes(`'public.${grant}(`), `${grant} must be in the revoke-from-anon/authenticated list.`);
}
for (const grant of ['service_media_direct_reserve_v2', 'service_media_direct_reservation_v1', 'service_media_direct_begin_release_v1', 'service_media_direct_finish_release_v1', 'service_media_gc_candidates_v2', 'service_media_staging_swept_v1']) {
  check(hard.includes(`'public.${grant}(`), `${grant} must be in the revoke-from-anon/authenticated list.`);
}
for (const source of [single, hard]) check(/execute format\('revoke all on function %s from public, anon, authenticated', f\)/.test(source), 'service functions must be revoked from anon and authenticated.');
check(/enabled boolean not null default false/.test(sql), 'media storage must be off until explicitly enabled.');

// 7. Client: every public upload goes to R2, every URL through one builder.
const offenders = execSync("grep -rln \"getPublicUrl\" src || true", { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(file => file !== 'src/lib/mediaUrl.ts');
check(offenders.length === 0, `public media URLs must be built with publicMediaUrl, found getPublicUrl in: ${offenders.join(', ')}`);
const storageWrites = execSync("grep -rnE \"storage\\.from\\(['\\\"](catalog|content|event)-public['\\\"]\\)\\.(upload|remove|update|move|copy)\" src || true", { encoding: 'utf8' }).trim();
check(storageWrites === '', `no client code may write to a public Supabase bucket (media lives in R2):\n${storageWrites}`);
const uploaders = {
  'src/features/producer-products/api.ts': ["uploadDirectMedia('product-image'", "uploadDirectMedia('product-video'"],
  'src/admin/officialStoreProductApi.ts': ["uploadDirectMedia('official-image'", "uploadDirectMedia('official-video'"],
  'src/admin/categoryAdminApi.ts': ["uploadDirectMedia('category-image'"],
  'src/features/store-branding/storeBrandingApi.ts': ["uploadDirectMedia(kind==='logo'?'brand-logo':'brand-cover'"],
  'src/features/producer-events/api.ts': ["uploadDirectMedia('event-image'"],
};
for (const [file, needles] of Object.entries(uploaders)) for (const needle of needles) check(read(file).includes(needle), `${file} must upload through ${needle}.`);
const fallback = read('src/features/catalog/installCatalogMediaFallback.ts');
check(fallback.includes('mediaOriginUrl') && fallback.includes('if (retryFromOrigin(target)) {\n      event.stopImmediatePropagation();'), 'an image not yet in R2 must be retried from Supabase before the placeholder.');
check(/compressImageForUpload\(rawFile,EVENT_IMAGE_COMPRESSION\)/.test(read('src/features/producer-events/api.ts')), 'event images must be compressed before upload.');
check(/update storage\.buckets\s+set allowed_mime_types = array\['image\/jpeg','image\/png','image\/webp','image\/avif'\]/.test(videoSql), 'the Supabase catalogue bucket must never accept videos.');

// 8. Behaviour of the URL builder itself.
const stubbed = client
  .replace("import { supabase } from './supabase';", "const supabase = { storage: { from: bucket => ({ getPublicUrl: p => ({ data: { publicUrl: `https://origin.test/storage/v1/object/public/${bucket}/${p}` } }) }) } };")
  .replace('import.meta.env.VITE_MEDIA_CDN_BASE', 'undefined');
const { code } = await transformWithEsbuild(stubbed, 'mediaUrl.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-media-cdn-'));
fs.writeFileSync(path.join(dir, 'mediaUrl.mjs'), code);
const media = await import(pathToFileURL(path.join(dir, 'mediaUrl.mjs')).href);
fs.rmSync(dir, { recursive: true, force: true });
const CDN = 'https://pub-test.r2.dev';
const eq = (actual, expected, label) => check(actual === expected, `${label}: expected ${expected}, got ${actual}`);
eq(media.publicMediaUrl('catalog-public', 'p1/products/a b.webp', CDN), `${CDN}/catalog-public/p1/products/a%20b.webp`, 'image goes to CDN, segments encoded');
eq(media.publicMediaUrl('catalog-public', 'p1/products/v.mp4', CDN), `${CDN}/catalog-public/p1/products/v.mp4`, 'product video is served from R2, its only home');
eq(media.publicMediaUrl('event-public', 'p1/events/v.mp4', CDN), 'https://origin.test/storage/v1/object/public/event-public/p1/events/v.mp4', 'no video outside catalog-public goes to the CDN');
eq(media.publicMediaUrl('user-private', 'u/a.webp', CDN), 'https://origin.test/storage/v1/object/public/user-private/u/a.webp', 'non-mirrored bucket stays on Supabase');
eq(media.publicMediaUrl('catalog-public', '../x.webp', CDN), 'https://origin.test/storage/v1/object/public/catalog-public/../x.webp', 'unsafe name never goes to CDN');
eq(media.publicMediaUrl('catalog-public', 'p1/a.webp', ''), 'https://origin.test/storage/v1/object/public/catalog-public/p1/a.webp', 'no CDN configured behaves exactly as before');
eq(media.mediaOriginUrl(`${CDN}/catalog-public/p1/products/a%20b.webp`, CDN), 'https://origin.test/storage/v1/object/public/catalog-public/p1/products/a b.webp', 'CDN URL maps back to its Supabase origin');
eq(media.mediaOriginUrl('https://elsewhere.test/catalog-public/a.webp', CDN), '', 'foreign URL has no origin');
eq(media.MEDIA_CDN_BASE === '' || /^https:\/\//.test(media.MEDIA_CDN_BASE), true, 'configured CDN base is https');

if (failures.length) {
  console.error('Media CDN contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Media CDN contract audit passed.');
