import React,{createContext,useCallback,useContext,useEffect,useMemo,useState}from'react';
import{useCustomerSession}from'./useCustomerSession';
import{getAuthorizationContext,type AuthorizationContextSnapshot}from'./authorizationApi';
import type{PermissionKey}from'./permissions';

type AuthorizationContextValue={
  loading:boolean;
  snapshot:AuthorizationContextSnapshot|null;
  can:(permission:PermissionKey)=>boolean;
  refresh:()=>Promise<void>;
};

const AuthorizationContext=createContext<AuthorizationContextValue|null>(null);

export function AuthorizationProvider({children}:{children:React.ReactNode}){
  const{currentUser,authReady}=useCustomerSession();
  const[snapshot,setSnapshot]=useState<AuthorizationContextSnapshot|null>(null);
  const[loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    if(!authReady||!currentUser?.id){setSnapshot(null);setLoading(!authReady);return;}
    setLoading(true);
    try{setSnapshot(await getAuthorizationContext());}
    catch(error){console.error('Authorization context refresh failed',error);setSnapshot(null);}
    finally{setLoading(false);}
  },[authReady,currentUser?.id]);

  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const onFocus=()=>{if(authReady&&currentUser?.id)void refresh();};
    window.addEventListener('focus',onFocus);
    return()=>window.removeEventListener('focus',onFocus);
  },[authReady,currentUser?.id,refresh]);

  const permissionSet=useMemo(()=>new Set(snapshot?.permissions||[]),[snapshot?.permissions]);
  const can=useCallback((permission:PermissionKey)=>permissionSet.has(permission),[permissionSet]);
  const value=useMemo<AuthorizationContextValue>(()=>({loading,snapshot,can,refresh}),[loading,snapshot,can,refresh]);
  return<AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
}

export function useAuthorization(){
  const value=useContext(AuthorizationContext);
  if(!value)throw new Error('useAuthorization must be used inside AuthorizationProvider.');
  return value;
}
