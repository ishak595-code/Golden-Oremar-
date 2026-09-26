// Client side of direct uploads (src/lib/directMediaUpload.ts), run in Node
// with the Supabase client and fetch replaced by recorders.
//
//   node scripts/media-cdn/direct-media-client-test.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const source = fs.readFileSync('src/lib/directMediaUpload.ts', 'utf8')
  .replace("import { supabase } from './supabase';", 'const supabase = globalThis.__fakeSupabase;');
const { code } = await transformWithEsbuild(source, 'directMediaUpload.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-media-client-'));
fs.writeFileSync(path.join(dir, 'm.mjs'), code);

let calls = [], puts = [], script = {};
globalThis.__fakeSupabase = {
  functions: {
    invoke: async (name, { body }) => {
      calls.push({ name, body });
      const answer = typeof script[body.action] === 'function' ? script[body.action](body) : script[body.action];
      if (answer?.httpError) return { data: null, error: { context: new Response(JSON.stringify({ ok: false, error: answer.httpError }), { status: 400 }) } };
      return { data: answer ?? { ok: true }, error: null };
    },
  },
};
globalThis.fetch = async (url, init) => { puts.push({ url, init }); if (script.putThrows) throw new TypeError('Failed to fetch'); return new Response(null, { status: script.putStatus ?? 200 }); };
const media = await import(pathToFileURL(path.join(dir, 'm.mjs')).href);
fs.rmSync(dir, { recursive: true, force: true });

const results = [];
const check = (ok, label) => results.push([ok, label]);
const file = (type, size) => new File([new Uint8Array(size)], 'f', { type });
const ID = 'b25705d3-399d-42b7-962d-6c7c5698e8a2', P = '22222222-2222-4222-8222-222222222222';
const PRODUCT = `${P}/products/${ID}.png`, VIDEO = `${P}/products/${ID}.mp4`, LOGO = `${P}/profile/logo-${ID}.webp`;
const start = p => ({ ok: true, bucket: 'catalog-public', path: p, uploadUrl: 'https://acc.r2.cloudflarestorage.com/b/catalog-public/x?X-Amz-Signature=1', headers: {} });
const reset = s => { calls = []; puts = []; script = s; };

reset({ start: start(PRODUCT), finish: { ok: true, path: PRODUCT, bucket: 'catalog-public', detectedMime: 'image/png', byteSize: 10, width: 1600, height: 1200 } });
let result = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P });
check(result.path === PRODUCT && result.width === 1600 && calls.map(c => c.body.action).join() === 'start,finish' && puts.length === 1, 'happy path: start, one PUT, finish, dimensions returned');
check(calls[0].name === 'media-upload' && calls[0].body.kind === 'product-image' && calls[0].body.producerId === P && calls[0].body.size === 10, 'start names the function, kind, store and size');
check(puts[0].init.method === 'PUT' && puts[0].init.headers['Content-Type'] === 'image/png', 'PUT sends the signed content type');

reset({ start: start(LOGO), finish: { ok: true, path: LOGO, assetKind: 'logo', width: 1024, height: 1024 } });
result = await media.uploadDirectMedia('brand-logo', file('image/webp', 10), { producerId: P });
check(result.assetKind === 'logo' && result.width === 1024, 'brand logo returns assetKind and dimensions for the client-side match');

reset({ start: start(VIDEO) });
let error = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P }).catch(e => e);
check(error instanceof Error && puts.length === 0, 'a path of the wrong kind from the server is never uploaded to');

reset({ start: start(PRODUCT), putStatus: 403 });
error = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P }).catch(e => e);
check(error instanceof Error && calls.map(c => c.body.action).join() === 'start,cancel', 'failed PUT cancels the reservation');

reset({ start: start(PRODUCT), putThrows: true });
error = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P }).catch(e => e);
check(/Dosya yüklenemedi/.test(error.message) && calls.at(-1)?.body.action === 'cancel', `network failure: Turkish text, not "Failed to fetch" (${error.message})`);

reset({ start: start(PRODUCT), finish: { httpError: 'catalog_media_dimensions_invalid' } });
error = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P }).catch(e => e);
check(/1200 piksel/.test(error.message) && calls.at(-1)?.body.action === 'cancel', `server refusal translated (${error.message})`);

reset({ start: { httpError: 'media_budget_full' } });
error = await media.uploadDirectMedia('product-video', file('video/mp4', 10), { producerId: P }).catch(e => e);
check(/depolama alanı şu anda dolu/.test(error.message) && puts.length === 0, 'budget full: clear message, nothing uploaded');

reset({ start: { httpError: 'media_daily_limit' } });
error = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P }).catch(e => e);
check(/yükleme sınırınıza/.test(error.message) && puts.length === 0, 'daily limit: clear message, nothing uploaded');

reset({});
error = await media.uploadDirectMedia('brand-logo', file('image/avif', 10)).catch(e => e);
check(/kabul edilmiyor/.test(error.message) && calls.length === 0, 'AVIF logo refused before contacting the server');
error = await media.uploadDirectMedia('product-image', file('image/png', 10 * 1024 * 1024 + 1)).catch(e => e);
check(/sınırın üzerinde/.test(error.message) && calls.length === 0, 'over 10 MB image refused before contacting the server');
error = await media.uploadDirectMedia('product-video', file('video/mp4', 50 * 1024 * 1024 + 1)).catch(e => e);
check(/sınırın üzerinde/.test(error.message) && calls.length === 0, 'over 50 MB video refused before contacting the server');

reset({ start: { ...start(PRODUCT), uploadUrl: 'http://evil.test/x' } });
error = await media.uploadDirectMedia('product-image', file('image/png', 10), { producerId: P }).catch(e => e);
check(error instanceof Error && puts.length === 0 && calls.at(-1)?.body.action === 'cancel', 'a non-https upload URL is never used, and the reservation is released');

reset({});
await media.cancelDirectMedia([PRODUCT, VIDEO, 'brand/official-store/golden-oremar-profile.webp', '../x.png']);
check(calls.length === 2 && calls[0].body.kind === 'product-image' && calls[1].body.kind === 'product-video', 'cancel only for paths the uploader could have created, with the right kind');

check(media.directMediaKindOfPath(`admin/${P}/categories/${ID}.webp`) === 'category-image'
  && media.directMediaKindOfPath(`${P}/events/${ID}.jpg`) === 'event-image'
  && media.directMediaKindOfPath(`${P}/profile/cover-${ID}.png`) === 'brand-cover'
  && media.directMediaKindOfPath(`${P}/profile/cover-${ID}.avif`) === null, 'path kinds match the server rules (no AVIF brand assets)');

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} direct media client checks passed.`);
process.exit(failed ? 1 : 0);
