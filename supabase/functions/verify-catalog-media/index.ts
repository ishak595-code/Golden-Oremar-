import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
Deno.serve(()=>new Response(JSON.stringify({ok:false,error:"deprecated_endpoint",replacement:"catalog-media-verify"}),{status:410,headers}));
