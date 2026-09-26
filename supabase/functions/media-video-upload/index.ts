import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Retired on 2026-09-26: every public image and video now goes through
// media-upload (kind "product-video" / "official-video" for videos). This stub
// only tells an old caller where to go; it holds no credentials and touches
// nothing.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-golden-device-id", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  return new Response(JSON.stringify({ ok: false, error: "media_video_upload_retired", use: "media-upload" }), {
    status: 410,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
});
