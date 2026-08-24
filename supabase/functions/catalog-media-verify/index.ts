import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const MAX_IMAGE_BYTES=10*1024*1024;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_NAME_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$/i;

type Scope={kind:"producer";producerId:string}|{kind:"official_admin"};

function json(status:number,body:Record<string,unknown>){
  return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
}
function safePath(value:unknown){
  const raw=typeof value==="string"?value.trim():"";
  if(!raw||raw.length>1200||raw.startsWith("/")||/^[a-z][a-z0-9+.-]*:/i.test(raw))throw new Error("catalog_media_path_invalid");
  const parts=raw.split("/");
  if(parts.some(part=>!part||part==="."||part===".."))throw new Error("catalog_media_path_invalid");
  return raw;
}
function parseScope(path:string,userId:string):Scope{
  const parts=path.split("/");
  if(parts.length===3&&parts[1]==="products"&&UUID_RE.test(parts[0])&&IMAGE_NAME_RE.test(parts[2]))return{kind:"producer",producerId:parts[0]};
  if(parts.length===4&&parts[0]==="admin"&&parts[1]===userId&&parts[2]==="official-products"&&IMAGE_NAME_RE.test(parts[3]))return{kind:"official_admin"};
  throw new Error("catalog_media_path_invalid");
}
function bytesEqual(bytes:Uint8Array,offset:number,expected:number[]){
  return expected.every((value,index)=>bytes[offset+index]===value);
}
function ascii(bytes:Uint8Array,offset:number,length:number){
  return String.fromCharCode(...bytes.slice(offset,offset+length));
}
function detectMime(bytes:Uint8Array){
  if(bytes.length>=3&&bytesEqual(bytes,0,[0xff,0xd8,0xff]))return"image/jpeg";
  if(bytes.length>=8&&bytesEqual(bytes,0,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return"image/png";
  if(bytes.length>=12&&ascii(bytes,0,4)==="RIFF"&&ascii(bytes,8,4)==="WEBP")return"image/webp";
  if(bytes.length>=16&&ascii(bytes,4,4)==="ftyp"){
    const end=Math.min(bytes.length,64);
    for(let offset=8;offset+4<=end;offset+=4){
      const brand=ascii(bytes,offset,4);
      if(brand==="avif"||brand==="avis")return"image/avif";
    }
  }
  return null;
}
function extensionMatches(path:string,mime:string){
  const ext=path.split(".").pop()?.toLowerCase()||"";
  if(mime==="image/jpeg")return ext==="jpg"||ext==="jpeg";
  if(mime==="image/png")return ext==="png";
  if(mime==="image/webp")return ext==="webp";
  if(mime==="image/avif")return ext==="avif";
  return false;
}
function hex(buffer:ArrayBuffer){
  return Array.from(new Uint8Array(buffer)).map(value=>value.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"});
  try{
    const url=Deno.env.get("SUPABASE_URL")||"";
    const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
    const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    const authorization=req.headers.get("Authorization")||"";
    if(!url||!anon||!serviceRole||!authorization)return json(401,{ok:false,error:"authentication_required"});

    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const serviceClient=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:userData,error:userError}=await userClient.auth.getUser();
    const userId=userData.user?.id||"";
    if(userError||!UUID_RE.test(userId))return json(401,{ok:false,error:"authentication_required"});

    const body=await req.json().catch(()=>null);
    const path=safePath(body&&typeof body==="object"?(body as Record<string,unknown>).path:null);
    const scope=parseScope(path,userId);

    const{data:permission,error:permissionError}=await userClient.rpc("authorization_has_permission_v1",{p_permission_key:"product.create"});
    if(permissionError||permission!==true)return json(403,{ok:false,error:"product_create_permission_required"});

    if(scope.kind==="producer"){
      const{data:producer,error:producerError}=await serviceClient.from("producers").select("id,owner_user_id,status,deleted_at").eq("id",scope.producerId).eq("owner_user_id",userId).eq("status","active").is("deleted_at",null).maybeSingle();
      if(producerError||!producer?.id)return json(403,{ok:false,error:"catalog_media_owner_mismatch"});
    }

    const slash=path.lastIndexOf("/");
    const folder=path.slice(0,slash);
    const fileName=path.slice(slash+1);
    const{data:list,error:listError}=await serviceClient.storage.from("catalog-public").list(folder,{limit:100,search:fileName,sortBy:{column:"name",order:"asc"}});
    if(listError)throw listError;
    const object=(list||[]).find(item=>item.name===fileName&&typeof item.id==="string"&&UUID_RE.test(item.id));
    if(!object)throw new Error("catalog_media_object_missing");
    const metadata=object.metadata&&typeof object.metadata==="object"?object.metadata as Record<string,unknown>:{};
    const metadataSize=Number(metadata.size);
    if(!Number.isSafeInteger(metadataSize)||metadataSize<1||metadataSize>MAX_IMAGE_BYTES)throw new Error("catalog_media_size_invalid");

    const{data:blob,error:downloadError}=await serviceClient.storage.from("catalog-public").download(path);
    if(downloadError||!blob)throw downloadError||new Error("catalog_media_download_failed");
    if(blob.size!==metadataSize||blob.size<1||blob.size>MAX_IMAGE_BYTES)throw new Error("catalog_media_size_mismatch");
    const buffer=await blob.arrayBuffer();
    const bytes=new Uint8Array(buffer);
    const detectedMime=detectMime(bytes);
    if(!detectedMime||!extensionMatches(path,detectedMime))throw new Error("catalog_media_binary_type_invalid");
    const metadataMime=String(metadata.mimetype||metadata.contentType||"").toLowerCase();
    if(metadataMime&&metadataMime!==detectedMime)throw new Error("catalog_media_metadata_mime_mismatch");
    const sha256Hex=hex(await crypto.subtle.digest("SHA-256",buffer));
    const updatedAt=typeof object.updated_at==="string"?object.updated_at:"";
    if(!updatedAt||Number.isNaN(Date.parse(updatedAt)))throw new Error("catalog_media_object_timestamp_invalid");

    const{data:registered,error:registerError}=await serviceClient.rpc("catalog_media_register_verification_service_v1",{
      p_storage_path:path,
      p_uploader_user_id:userId,
      p_storage_object_id:object.id,
      p_storage_object_version:null,
      p_storage_updated_at:updatedAt,
      p_detected_mime:detectedMime,
      p_byte_size:blob.size,
      p_sha256_hex:sha256Hex,
    });
    if(registerError||registered!==true)throw registerError||new Error("catalog_media_verification_registration_failed");
    return json(200,{ok:true,path,detectedMime,byteSize:blob.size});
  }catch(error){
    const message=error instanceof Error?error.message:"catalog_media_verification_failed";
    const safe=/^[a-z0-9_:-]{1,160}$/i.test(message)?message:"catalog_media_verification_failed";
    const status=safe.includes("permission")||safe.includes("owner_mismatch")?403:400;
    return json(status,{ok:false,error:safe});
  }
});
