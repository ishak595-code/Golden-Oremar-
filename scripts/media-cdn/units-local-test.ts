// Unit checks for the helpers the edge functions export: the capped body
// reader of media-upload and the staging list parser of media-cdn-sync.
//
//   deno run -A --no-config --node-modules-dir=none scripts/media-cdn/units-local-test.ts

const root = await Deno.makeTempDir();
await Deno.mkdir(`${root}/fn`, { recursive: true });
await Deno.mkdir(`${root}/_shared`, { recursive: true });
await Deno.copyFile(new URL("../../supabase/functions/_shared/media_binary.ts", import.meta.url), `${root}/_shared/media_binary.ts`);
// Load each module without starting its server.
for (const name of ["media-upload", "media-cdn-sync"]) {
  const source = await Deno.readTextFile(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url));
  await Deno.writeTextFile(`${root}/fn/${name}.ts`, source.replace(/^import "jsr:[^"]+";\n/m, "").replace("Deno.serve(", "const __server = ("));
}
const { readCapped } = await import(`file://${root}/fn/media-upload.ts`);
const { parseStagingList } = await import(`file://${root}/fn/media-cdn-sync.ts`);

const results: [boolean, string][] = [];
const check = (ok: boolean, label: string) => results.push([ok, label]);

// A body that keeps coming is cut off right after the limit, not read to the end.
let pulled = 0;
const endless = new ReadableStream<Uint8Array>({ pull(c) { pulled++; c.enqueue(new Uint8Array(1024)); } });
check(await readCapped(new Response(endless), 4096) === null && pulled < 10, `endless body stops after the cap (${pulled} chunks read)`);
const exact = await readCapped(new Response(new Uint8Array(4096).fill(7)), 4096);
check(exact?.byteLength === 4096 && exact[4095] === 7, "a body of exactly the cap is read whole");
check(await readCapped(new Response(new Uint8Array(4097)), 4096) === null, "one byte over the cap is refused");
check((await readCapped(new Response(null), 10))?.byteLength === 0, "empty body reads as empty");

const xml = `<ListBucketResult><Contents><Key>_incoming/0b8c4c3e-3f55-4b8a-9a55-2a4e5b8d9f10</Key><LastModified>2026-09-26T10:00:00.000Z</LastModified></Contents>`
  + `<Contents><Key>catalog-public/x.png</Key><LastModified>2026-09-26T10:00:00.000Z</LastModified></Contents>`
  + `<Contents><Key>_incoming/../etc</Key><LastModified>2026-09-26T10:00:00.000Z</LastModified></Contents>`
  + `<IsTruncated>true</IsTruncated><NextContinuationToken>a&amp;b=</NextContinuationToken></ListBucketResult>`;
const page = parseStagingList(xml);
check(page.items.length === 1 && page.items[0].key.startsWith("_incoming/0b8c"), "only well-formed staging keys are ever deleted by the sweep");
check(page.next === "a&b=", "continuation token is unescaped");
check(parseStagingList("<IsTruncated>false</IsTruncated><NextContinuationToken>z</NextContinuationToken>").next === "", "no token when the list is complete");

await Deno.remove(root, { recursive: true });
const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} unit checks passed.`);
Deno.exit(failed ? 1 : 0);
