import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { cleanString, databaseErrorResponse, idempotencyKey, jsonResponse, readJsonBody, requestCorsHeaders, requestIpHash, sha256, unexpectedErrorResponse } from '../_shared/submission.ts';
export default { fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
  const corsHeaders=requestCorsHeaders(req); if(!corsHeaders)return Response.json({ok:false,error:'origin_not_allowed'},{status:403});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders}); if(req.method!=='POST')return jsonResponse({ok:false,error:'method_not_allowed'},405,corsHeaders);
  try { const body=await readJsonBody(req); if(cleanString(body.website,200))return jsonResponse({ok:true,status:'received'},202,corsHeaders);
    const payload={name:cleanString(body.name,120),email:cleanString(body.email,254).toLowerCase(),phone:cleanString(body.phone,40),subject:cleanString(body.subject,160),message:cleanString(body.message,5000),locale:cleanString(body.locale,10)||'tr',source:cleanString(body.source,40)||'web'};
    const requestHash=await sha256(JSON.stringify(payload)); const ipHash=await requestIpHash(req); const key=idempotencyKey(req,body,'contact');
    const {data,error}=await ctx.supabaseAdmin.rpc('submit_contact_message',{p_idempotency_key:key,p_request_hash:requestHash,p_name:payload.name,p_email:payload.email,p_phone:payload.phone,p_subject:payload.subject,p_message:payload.message,p_locale:payload.locale,p_source:payload.source,p_ip_hash:ipHash,p_user_agent:cleanString(req.headers.get('user-agent'),500)});
    if(error)return databaseErrorResponse(error,corsHeaders); return jsonResponse(data,201,corsHeaders);
  } catch(error){return unexpectedErrorResponse(error,corsHeaders);} }) };
