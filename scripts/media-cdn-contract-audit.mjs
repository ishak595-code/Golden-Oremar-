// Media CDN (Cloudflare R2) contract audit.
//
// Public images are mirrored to R2 by the media-cdn-sync edge function and
// served from there, so customer traffic never touches the Supabase egress
// quota again. Three places must agree for that to be safe: the migration
// (what is eligible, the budget), the edge function (what it copies, how), and
// the client (which URL it builds). If they drift, customers get broken
// images or, worse, R2 fills past its free 10 GB. This audit locks them
// together.

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

// 2. Only images: videos stay on Supabase.
check(!/video\//.test(sql.match(/create or replace function private\.media_cdn_sources_v1[\s\S]*?\$\$;/)?.[0] || 'video/'), 'eligible sources must not include video types.');
check(/IMAGE_EXTENSION = \/\\\.\(jpe\?g\|png\|webp\|avif\)\$\/i/.test(client), 'client may only build CDN URLs for image extensions.');
check(fn.includes('detected !== item.contentType'), 'edge function must refuse bytes that are not the image type they claim.');

// 3. The same unsafe-name rule on both sides.
const fnUnsafe = fn.match(/!\/(.+)\/\.test\(name\)/)?.[1];
const clientUnsafe = client.match(/const UNSAFE_NAME = \/(.+)\/;/)?.[1];
check(Boolean(fnUnsafe) && fnUnsafe === clientUnsafe, 'edge function and client must use the identical unsafe-name pattern.');
check(sql.includes("o.name !~ '(^/|//|/$|(^|/)[.]{1,2}(/|$)|[\\\\[:cntrl:]])'"), 'migration must exclude unsafe object names.');

// 4. Budget: the free allowance can never be exceeded.
const budget = Number(sql.match(/budget_bytes bigint not null default (\d+) check \(budget_bytes between 0 and (\d+)\)/)?.[1]);
const ceiling = Number(sql.match(/budget_bytes bigint not null default \d+ check \(budget_bytes between 0 and (\d+)\)/)?.[1]);
const FREE = 10 * 1000 ** 3; // R2 free tier is 10 GB-month (decimal)
check(budget > 0 && budget <= 0.9 * FREE, `default budget ${budget} must leave at least 10% of the 10 GB free tier.`);
check(ceiling > 0 && ceiling < FREE, `budget ceiling ${ceiling} must stay below the free tier.`);
const maxObject = Number(sql.match(/max_object_bytes bigint not null default (\d+)/)?.[1]);
check(maxObject > 0 && maxObject <= 5 * 1024 * 1024, `per-object cap ${maxObject} must be at most 5 MiB.`);
check(/if mirrored - previous \+ p_size > s\.budget_bytes then return false/.test(sql), 'reservation must refuse anything that would pass the budget.');
check(/for update/.test(sql.match(/function private\.media_cdn_reserve_v1[\s\S]*?\$\$;/)?.[0] || ''), 'reservation must lock the settings row so parallel runs cannot overshoot.');
const reserveAt = fn.indexOf('service_media_cdn_reserve_v1'), putAt = fn.indexOf('method: "PUT"');
check(reserveAt > 0 && putAt > reserveAt, 'edge function must reserve in the ledger BEFORE every PUT (ledger is a superset of R2).');
check(/service_media_cdn_forget_v1[\s\S]*\}\s*;\s*\n\s*try \{/.test(fn) || fn.includes('await service.rpc("service_media_cdn_forget_v1", { p_bucket: item.bucket, p_name: item.name });\n    };'), 'a failed upload must release its reservation.');

// 5. Security and cache behaviour.
check(fn.includes('service_validate_media_cdn_worker_v1') && fn.indexOf('service_validate_media_cdn_worker_v1') < fn.indexOf('Deno.env.get("R2_ACCESS_KEY_ID")'), 'edge function must authenticate the worker secret before anything else.');
check(fn.includes('"public, max-age=31536000, immutable"'), 'mirrored objects must be served with a one-year immutable cache header.');
check(!/VITE_[A-Z_]*R2|R2_SECRET|R2_ACCESS/.test(client), 'no R2 credential may ever appear in client code.');
for (const grant of ['service_media_cdn_plan_v1(integer)', 'service_media_cdn_reserve_v1(text,text,text,bigint,text)']) {
  check(sql.includes(`revoke all on function public.${grant} from public, anon, authenticated;`), `${grant} must not be callable by anon or authenticated users.`);
}
check(/enabled boolean not null default false/.test(sql), 'mirroring must be off until explicitly enabled.');

// 6. Every public image URL goes through the one builder, with a fallback.
const offenders = execSync("grep -rln \"getPublicUrl\" src || true", { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(file => !['src/lib/mediaUrl.ts', 'src/features/content/productSafetyApi.ts'].includes(file));
check(offenders.length === 0, `public image URLs must be built with publicMediaUrl, found getPublicUrl in: ${offenders.join(', ')}`);
check(read('src/features/content/productSafetyApi.ts').match(/getPublicUrl/g)?.length === 1 && /videoPath/.test(read('src/features/content/productSafetyApi.ts')), 'productSafetyApi may only call getPublicUrl for its video, which is never mirrored.');
const fallback = read('src/features/catalog/installCatalogMediaFallback.ts');
check(fallback.includes('mediaOriginUrl') && fallback.includes('if (retryFromOrigin(target)) {\n      event.stopImmediatePropagation();'), 'a failing CDN image must be retried from Supabase before the placeholder.');
check(/compressImageForUpload\(rawFile,EVENT_IMAGE_COMPRESSION\)/.test(read('src/features/producer-events/api.ts')), 'event images must be compressed before upload.');

// 7. Behaviour of the URL builder itself.
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
eq(media.publicMediaUrl('catalog-public', 'p1/products/v.mp4', CDN), 'https://origin.test/storage/v1/object/public/catalog-public/p1/products/v.mp4', 'video stays on Supabase');
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
