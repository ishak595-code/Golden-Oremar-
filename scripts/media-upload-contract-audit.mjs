// Media upload contract audit.
//
// Client-side image compression and the server-side verifier have to agree on
// one number. catalog-media-verify rejects any catalogue image whose width or
// height is below MIN_PRODUCT_IMAGE_EDGE. If the compressor ever shrank a photo
// under that floor, every such upload would be refused by the server - and
// nothing in the UI would explain why. This audit reads the floor straight out
// of the edge function and checks the compressor against it, so changing one
// without the other fails the build instead of failing customers.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const verifier = fs.readFileSync('supabase/functions/catalog-media-verify/index.ts', 'utf8');
const floor = Number(verifier.match(/MIN_PRODUCT_IMAGE_EDGE\s*=\s*(\d+)/)?.[1]);
check(Number.isFinite(floor) && floor > 0, 'Could not read MIN_PRODUCT_IMAGE_EDGE from catalog-media-verify.');

const { code } = await transformWithEsbuild(fs.readFileSync('src/lib/compressImage.ts', 'utf8'), 'compressImage.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-media-'));
const file = path.join(dir, 'compressImage.mjs');
fs.writeFileSync(file, code);
const media = await import(pathToFileURL(file).href);
fs.rmSync(dir, { recursive: true, force: true });

for (const [name, options] of [['PRODUCT', media.PRODUCT_IMAGE_COMPRESSION], ['CATEGORY', media.CATEGORY_IMAGE_COMPRESSION]]) {
  check(options.minShortEdge >= floor, `${name}_IMAGE_COMPRESSION.minShortEdge (${options.minShortEdge}) must be at least the verifier floor (${floor}).`);
  // Real camera shapes, including the tall 9:16 case a long-edge-only resize
  // would have pushed below the floor.
  for (const [w, h] of [[3024, 4032], [4032, 3024], [2268, 4032], [3000, 3000], [1500, 6000], [floor, floor]]) {
    const s = media.resizeScale(w, h, options);
    check(Math.min(Math.round(w * s), Math.round(h * s)) >= floor, `${name}: ${w}x${h} would be resized below the ${floor}px floor.`);
    check(s <= 1, `${name}: ${w}x${h} must never be enlarged.`);
  }
}
check(media.resizeScale(800, 1000, media.PRODUCT_IMAGE_COMPRESSION) === 1, 'An image already below the floor must be left at its original size, not enlarged to pass.');

// Video source routing. A YouTube link must reach the embedded player, never
// the <video> element (which cannot play a YouTube page), and nothing but https
// may become a playable source.
const { code: videoCode } = await transformWithEsbuild(fs.readFileSync('src/features/media/videoSource.ts', 'utf8'), 'videoSource.ts', { loader: 'ts', format: 'esm' });
const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-video-'));
const videoFile = path.join(videoDir, 'videoSource.mjs');
fs.writeFileSync(videoFile, videoCode);
const video = await import(pathToFileURL(videoFile).href);
fs.rmSync(videoDir, { recursive: true, force: true });
const ID = 'dQw4w9WgXcQ';
for (const [label, url] of [
  ['watch', `https://www.youtube.com/watch?v=${ID}`],
  ['watch with extra params', `https://www.youtube.com/watch?v=${ID}&t=42s&list=abc`],
  ['mobile', `https://m.youtube.com/watch?v=${ID}`],
  ['short link', `https://youtu.be/${ID}?si=share`],
  ['embed', `https://www.youtube.com/embed/${ID}`],
  ['nocookie embed', `https://www.youtube-nocookie.com/embed/${ID}`],
  ['live', `https://www.youtube.com/live/${ID}`],
]) {
  const parsed = video.parseVideoSource(url);
  check(parsed?.kind === 'youtube' && parsed.id === ID && parsed.vertical === false, `YouTube ${label} link must resolve to id ${ID}, landscape.`);
}
const shorts = video.parseVideoSource(`https://www.youtube.com/shorts/${ID}`);
check(shorts?.kind === 'youtube' && shorts.vertical === true, 'YouTube Shorts must be recognised as vertical.');
check(video.parseVideoSource('https://cdn.example.com/bal.mp4')?.kind === 'file', 'A non-YouTube https URL must be treated as a direct file.');
for (const [label, bad] of [
  ['javascript:', 'javascript:alert(1)'],
  ['data:', 'data:video/mp4;base64,AAAA'],
  ['plain http', `http://www.youtube.com/watch?v=${ID}`],
  ['malformed id', 'https://www.youtube.com/watch?v=short'],
  ['YouTube page without an id', 'https://www.youtube.com/@goldenoremar'],
  ['empty', ''],
]) check(video.parseVideoSource(bad) === null, `${label} must never become a playable video source.`);
// Admin input normalisation must produce exactly what the server accepts
// (private.is_youtube_video_url_v1), so a link accepted in the form is never
// rejected on save.
const serverPattern = /^https:\/\/((www|m)\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)[A-Za-z0-9_-]{11}([?&#/].*)?$/i;
for (const pasted of [`youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}?si=share`, `www.youtube.com/shorts/${ID}`, `m.youtube.com/watch?v=${ID}&t=5`]) {
  const out = video.normalizeYoutubeInput(pasted);
  check(out !== null && serverPattern.test(out), `Pasted ${pasted} must normalise to a link the server accepts.`);
}
check(!/si=/.test(video.normalizeYoutubeInput(`https://youtu.be/${ID}?si=share`) || ''), 'Share-sheet tracking parameters must be stripped.');
for (const bad of ['https://evil.com/watch?v=' + ID, 'javascript:alert(1)', 'youtube.com/@kanal', '']) {
  check(video.normalizeYoutubeInput(bad) === null, `${JSON.stringify(bad)} must not normalise to a YouTube link.`);
}
check(video.youtubeEmbedUrl(ID).startsWith('https://www.youtube-nocookie.com/embed/'), 'Embeds must use the privacy-enhanced youtube-nocookie.com domain.');

for (const source of ['src/admin/officialStoreProductApi.ts', 'src/features/producer-products/api.ts', 'src/admin/categoryAdminApi.ts']) {
  check(fs.readFileSync(source, 'utf8').includes('compressImageForUpload('), `${source} must compress images before uploading them.`);
}

if (failures.length) {
  console.error('Media upload contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Media upload contract audit passed: client compression respects the ${floor}px verifier floor across real camera shapes, never enlarges, and is applied on every catalogue upload path; video links route YouTube to the embedded player and reject non-https sources.`);
