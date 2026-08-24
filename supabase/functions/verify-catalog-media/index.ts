import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGE=10*1024*1024,MAX_VIDEO=50*1024*1024;

type MediaKind="image"|"video";

function json(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
function text(value:unknown,max:number){const v=typeof value==="string"?value.trim():"";return v&&v.length<=max&&!/[\u0000-\u001F\u007F]/.test(v)?v:"";}
function normalizePath(value:unknown){const raw=text(value,1200).replace(/^\/+/,"");if(!raw||/^[a-z][a-z0-9+.-]*:/i.test(raw)||raw.split("/").some(part=>!part||part==="."||part===".."))return"";return raw;}
function ascii(bytes:Uint8Array,start:number,length:number){return String.fromCharCode(...bytes.slice(start,start+length));}
function eq(bytes:Uint8Array,offset:number,values:number[]){return values.every((value,index)=>bytes[offset+index]===value);}
function brandSet(bytes:Uint8Array){const brands=new Set<string>();if(bytes.length<12||ascii(bytes,4,4)!=="ftyp")return brands;brands.add(ascii(bytes,8,4));for(let offset=16;offset+4<=Math.min(bytes.length,80);offset+=4)brands.add(ascii(bytes,offset,4));return brands;}
function detectImage(bytes:Uint8Array){
  if(bytes.length>=3&&eq(bytes,0,[0xff,0xd8,0xff]))return"image/jpeg";
  if(bytes.length>=8&&eq(bytes,0,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return"image/png";
  if(bytes.length>=12&&ascii(bytes,0,4)==="RIFF"&&ascii(bytes,8,4)==="WEBP")return"image/webp";
  const brands=brandSet(bytes);if(brands.has("avif")||brands.has("avis"))return"image/avif";
  return"";
}
function detectVideo(bytes:Uint8Array){
  if(bytes.length>=4&&eq(bytes,0,[0x1a,0x45,0xdf,0xa3]))return"video/webm";
  const brands=brandSet(bytes);if(brands.has("qt  "))return"video/quicktime";
  const mp4Brands=["isom","iso2","iso3","iso4","iso5","iso6","mp41","mp42","avc1","M4V ","MSNV","dash"];
  if(mp4Brands.some(brand=>brands.has(brand)))return"video/mp4";
  return"";
}
function extensionMatches(path:string,mime:string){const lower=path.toLowerCase();if(mime==="image/jpeg")return/\.(jpg|jpeg)$/.test(lower);if(mime==="image/png")return/\.png$/.test(lower);if(mime==="image/webp")return/\.webp$/.test(lower);if(mime==="image/avif")return/\.avif$/.test(lower);if(mime==="video/mp4")return/\.mp4$/.test(lower);if(mime==="video/webm")return/\.webm$/.test(lower);if(mime==="video/quicktime")return/\.mov$/.test(lower);return false;}
function hex(buffer:ArrayBuffer){return Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,"0")).join("");}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"});
  try{
    const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",authorization=req.headers.get("Authorization")||"";
    if(!url||!anon||!serviceKey||!authorization)return json(401,{ok:false,error:"authentication_required"});
    const body=await req.json().catch(()=>null);if(!body||typeof body!=="object"||Array.isArray(body))return json(400,{ok:false,error:"invalid_request"});
    const path=normalizePath((body as any).path),kind=text((body as any).kind,10) as MediaKind;
    if(!path||!(kind==="image"||kind==="video"))return json(400,{ok:false,error:"invalid_media_request"});

    const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:userData,error:userError}=await caller.auth.getUser();const userId=userData.user?.id||"";
    if(userError||!UUID_RE.test(userId))return json(401,{ok:false,error:"authentication_required"});
    const{data:canUpdate,error:permissionError}=await caller.rpc("authorization_has_permission_v1",{p_permission_key:"product.update"});
    if(permissionError||canUpdate!==true)return json(403,{ok:false,error:"product_update_permission_required"});

    const parts=path.split("/");
    if(parts[0]==="admin"){
      const{data:adminAccess,error:adminError}=await caller.rpc("authorization_has_permission_v1",{p_permission_key:"admin.access"});
      if(adminError||adminAccess!==true||parts.length!==4||parts[1]!==userId||parts[2]!=="official-products")return json(403,{ok:false,error:"catalog_media_path_not_owned"});
    }else{
      const producerId=parts[0];
      if(parts.length!==3||parts[1]!=="products"||!UUID_RE.test(producerId))return json(403,{ok:false,error:"catalog_media_path_not_owned"});
      const{data:producer,error:producerError}=await service.from("producers").select("id").eq("id",producerId).eq("owner_user_id",userId).eq("status","active").eq("is_verified",true).eq("origin_verified",true).is("deleted_at",null).maybeSingle();
      if(producerError||!producer?.id)return json(403,{ok:false,error:"catalog_media_path_not_owned"});
    }

    const{data:blob,error:downloadError}=await service.storage.from("catalog-public").download(path);
    if(downloadError||!blob)return json(404,{ok:false,error:"catalog_media_object_not_found"});
    const max=kind==="image"?MAX_IMAGE:MAX_VIDEO;if(blob.size<=0||blob.size>max)return json(422,{ok:false,error:"catalog_media_size_invalid"});
    const buffer=await blob.arrayBuffer();if(buffer.byteLength!==blob.size)return json(422,{ok:false,error:"catalog_media_size_mismatch"});
    const bytes=new Uint8Array(buffer),detected=kind==="image"?detectImage(bytes):detectVideo(bytes);
    if(!detected||!extensionMatches(path,detected))return json(422,{ok:false,error:"catalog_media_binary_type_invalid"});
    const checksum=hex(await crypto.subtle.digest("SHA-256",buffer));
    const{data:recorded,error:recordError}=await service.rpc("record_catalog_media_verification_v1",{p_path:path,p_media_kind:kind,p_detected_mime:detected,p_byte_size:buffer.byteLength,p_sha256:checksum,p_verified_by:userId});
    if(recordError||!recorded||(recorded as any).ok!==true)return json(422,{ok:false,error:"catalog_media_metadata_mismatch"});
    return json(200,{ok:true,path,kind,detectedMime:detected,byteSize:buffer.byteLength,sha256:checksum});
  }catch(error){
    const message=error instanceof Error?error.message:"catalog_media_verification_failed";
    return json(400,{ok:false,error:message.length<=160?message:"catalog_media_verification_failed"});
  }
});
