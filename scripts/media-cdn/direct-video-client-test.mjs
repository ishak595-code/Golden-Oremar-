// Client side of direct video uploads (src/lib/directVideoUpload.ts), run in
// Node with the Supabase client and fetch replaced by recorders.
//
//   node scripts/media-cdn/direct-video-client-test.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const source = fs.readFileSync('src/lib/directVideoUpload.ts', 'utf8')
  .replace("import { supabase } from './supabase';", 'const supabase = globalThis.__fakeSupabase;');
const { code } = await transformWithEsbuild(source, 'directVideoUpload.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-video-client-'));
fs.writeFileSync(path.join(dir, 'm.mjs'), code);

let calls = [], puts = [], script = {};
globalThis.__fakeSupabase = {
  functions: {
    invoke: async (name, { body }) => {
      calls.push({ name, body });
      const answer = script[body.action];
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
const file = (type, size) => new File([new Uint8Array(size)], 'v', { type });
const PATH = '22222222-2222-4222-8222-222222222222/products/b25705d3-399d-42b7-962d-6c7c5698e8a2.mp4';
const reset = s => { calls = []; puts = []; script = s; };
const start = { ok: true, path: PATH, uploadUrl: 'https://acc.r2.cloudflarestorage.com/b/catalog-public/x?X-Amz-Signature=1', headers: {} };

reset({ start, finish: { ok: true, path: PATH } });
const result = await media.uploadDirectVideo({ scope: 'producer', producerId: 'p' }, file('video/mp4', 10));
check(result === PATH && calls.map(c => c.body.action).join() === 'start,finish' && puts.length === 1, 'happy path: start, one PUT, finish');
check(puts[0]?.init.method === 'PUT' && puts[0]?.init.headers['Content-Type'] === 'video/mp4', 'PUT sends the signed content type');
check(calls[0].body.size === 10 && calls[0].body.contentType === 'video/mp4' && calls[0].body.scope === 'producer', 'start carries size, type and scope');

reset({ start, putStatus: 403 });
let error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/mp4', 10)).catch(e => e);
check(error instanceof Error && calls.map(c => c.body.action).join() === 'start,cancel', `failed PUT cancels the reservation (${calls.map(c => c.body.action)})`);

reset({ start, putThrows: true });
error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/mp4', 10)).catch(e => e);
check(/Video yüklenemedi/.test(error.message) && calls.at(-1)?.body.action === 'cancel', `network failure shows Turkish text, not "Failed to fetch" (${error.message})`);

reset({ start, finish: { httpError: 'video_content_invalid' } });
error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/mp4', 10)).catch(e => e);
check(/bir video gibi görünmüyor/.test(error.message) && calls.at(-1)?.body.action === 'cancel', `server refusal is translated and cancelled (${error.message})`);

reset({ start: { httpError: 'video_budget_full' } });
error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/mp4', 10)).catch(e => e);
check(/depolama alanı şu anda dolu/.test(error.message) && puts.length === 0, 'budget full: clear message, nothing uploaded');

reset({});
error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/avi', 10)).catch(e => e);
check(/MP4, WebM veya MOV/.test(error.message) && calls.length === 0, 'wrong type refused before contacting the server');
error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/mp4', 50 * 1024 * 1024 + 1)).catch(e => e);
check(/50 MB/.test(error.message) && calls.length === 0, 'over 50 MB refused before contacting the server');

reset({ start: { ...start, uploadUrl: 'http://evil.test/x' } });
error = await media.uploadDirectVideo({ scope: 'admin' }, file('video/mp4', 10)).catch(e => e);
check(error instanceof Error && puts.length === 0 && calls.at(-1)?.body.action === 'cancel', 'a non-https upload URL is never used, and the reservation is released');

reset({});
await media.cancelDirectVideos([PATH, 'p/products/a.webp']);
check(calls.length === 1 && calls[0].body.action === 'cancel' && calls[0].body.path === PATH, 'cancelDirectVideos only touches video paths');

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} direct video client checks passed.`);
process.exit(failed ? 1 : 0);
