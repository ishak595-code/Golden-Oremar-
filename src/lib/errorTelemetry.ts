import { reportClientError } from '../admin/systemErrorApi';

function errorShape(value:unknown){if(value instanceof Error)return{message:value.message||value.name,stack:value.stack||null};if(typeof value==='string')return{message:value,stack:null};try{return{message:JSON.stringify(value).slice(0,2000),stack:null};}catch{return{message:'Bilinmeyen istemci hatası',stack:null};}}
function route(){try{return`${window.location.pathname}${window.location.search}`.slice(0,500);}catch{return null;}}
export function sendClientError(source:string,value:unknown,severity:'warning'|'error'|'fatal'='error',metadata:Record<string,unknown>={}){const error=errorShape(value);void reportClientError({source,message:error.message.slice(0,2000),stack:error.stack?.slice(0,12000)||null,route:route(),severity,metadata}).catch(()=>{});}
export function installGlobalErrorTelemetry(){window.addEventListener('error',event=>sendClientError('window.error',event.error||event.message,'fatal',{filename:event.filename||null,lineno:event.lineno||null,colno:event.colno||null}));window.addEventListener('unhandledrejection',event=>sendClientError('window.unhandledrejection',event.reason,'error'));}
