import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { cleanString, databaseErrorResponse, idempotencyKey, jsonResponse, readJsonBody, requestCorsHeaders, requestIpHash, sha256, unexpectedErrorResponse } from '../_shared/submission.ts';
export default { fetch: withSupabase({ auth: ["user", "publishable", "secret"] }, async (req, ctx) => {
  const corsHeaders=requestCorsHeaders(req); if(!corsHeaders)return Response.json({ok:false,error:'origin_not_allowed'},{status:403});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders}); if(req.method!=='POST')return jsonResponse({ok:false,error:'method_not_allowed'},405,corsHeaders);
  try { const body=await readJsonBody(req); if(cleanString(body.website,200))return jsonResponse({ok:true,status:'received'},202,corsHeaders);
    const parsedGuestCount=Number(body.guestCount); const payload={eventReference:cleanString(body.eventReference,200),guestName:cleanString(body.guestName,120),guestEmail:cleanString(body.guestEmail,254).toLowerCase(),guestPhone:cleanString(body.guestPhone,40),guestCount:Number.isInteger(parsedGuestCount)?parsedGuestCount:0,notes:cleanString(body.notes,1000)};
    const requestHash=await sha256(JSON.stringify(payload)); const ipHash=await requestIpHash(req); const key=idempotencyKey(req,body,'event');
    const rpcClient=ctx.authMode==='user'?ctx.supabase:ctx.supabaseAdmin;
    const {data,error}=await rpcClient.rpc('submit_event_reservation',{p_idempotency_key:key,p_request_hash:requestHash,p_event_reference:payload.eventReference,p_guest_name:payload.guestName,p_guest_email:payload.guestEmail,p_guest_phone:payload.guestPhone,p_guest_count:payload.guestCount,p_notes:payload.notes,p_ip_hash:ipHash});
    if(error)return databaseErrorResponse(error,corsHeaders); return jsonResponse(data,201,corsHeaders);
  } catch(error){return unexpectedErrorResponse(error,corsHeaders);} }) };
