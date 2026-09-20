import React,{Component,ErrorInfo,ReactNode}from'react';
import{sendClientError}from'./lib/errorTelemetry';
import{isStaleChunkError,recoverFromStaleChunk}from'./lib/staleChunkRecovery';

interface Props{children?:ReactNode;fallback?:ReactNode;}
interface State{hasError:boolean;error?:Error;recovering:boolean;}

class ErrorBoundary extends Component<Props,State>{
 public state:State={hasError:false,recovering:false};

 public static getDerivedStateFromError(error:Error):State{
  // A stale-deployment failure is recoverable, so enter the recovering state
  // rather than showing an error the user cannot act on.
  return{hasError:true,error,recovering:isStaleChunkError(error)};
 }

 public componentDidCatch(error:Error,errorInfo:ErrorInfo){
  const stale=isStaleChunkError(error);
  // Still reported, at a lower severity: a spike in these is the signal that
  // deployments are leaving clients stranded, which is worth seeing.
  sendClientError('react.error_boundary',error,stale?'warning':'fatal',{
   componentStack:errorInfo.componentStack?.slice(0,12000)||null,
   staleChunk:stale,
  });
  if(stale){
   void recoverFromStaleChunk().then(started=>{
    // Recovery was declined - most likely a second failure inside the guard
    // window, meaning the deployment itself is broken rather than the cache.
    // Fall through to the normal error screen instead of looping.
    if(!started)this.setState({recovering:false});
   });
  }
 }

 public render(){
  const props=this.props as Props;
  if(!this.state.hasError)return props.children;

  if(this.state.recovering){
   return <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center bg-[#0a1911] text-white p-4"><div className="max-w-md w-full text-center"><div aria-hidden="true" className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"/><h2 className="text-lg font-bold mb-2">Yeni sürüm yükleniyor</h2><p className="text-gray-300 text-sm">Uygulama güncellendi. Birkaç saniye içinde yenilenecek.</p></div></div>;
  }

  if(props.fallback)return props.fallback;

  return <div role="alert" className="min-h-screen flex items-center justify-center bg-[#0a1911] text-white p-4"><div className="max-w-md w-full bg-red-950/20 border border-red-500/30 p-6 rounded-2xl"><h2 className="text-xl font-bold text-red-500 mb-2">Bir şey ters gitti</h2><p className="text-gray-300 mb-4 text-sm">Bu ekran şu anda açılamadı. Sayfayı yenileyip yeniden deneyin.</p><button onClick={()=>{void recoverFromStaleChunk().then(started=>{if(!started)window.location.reload();});}} aria-label="Sayfayı yenile ve uygulamayı yeniden başlat" className="min-h-11 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors px-4 py-2 rounded-lg font-medium w-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Sayfayı Yenile</button></div></div>;
 }
}
export default ErrorBoundary;
