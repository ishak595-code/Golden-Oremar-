const PATCH_FLAG='__goldenOremarCustomerRoutePatched__';
const ROUTE_EVENT='golden-oremar:route-change';

function currentTab(){
  try{return new URL(window.location.href).searchParams.get('tab')||'home';}
  catch{return'home';}
}

function syncRouteState(){
  const tab=currentTab();
  document.documentElement.dataset.appTab=tab;
  window.dispatchEvent(new CustomEvent(ROUTE_EVENT,{detail:{tab}}));
}

export function installCustomerShellRouteState(){
  syncRouteState();
  const historyObject=window.history as History&Record<string,any>;
  if(historyObject[PATCH_FLAG])return;
  historyObject[PATCH_FLAG]=true;

  const patch=(method:'pushState'|'replaceState')=>{
    const original=historyObject[method].bind(historyObject);
    historyObject[method]=((...args:any[])=>{
      const result=original(...args as Parameters<History[typeof method]>);
      queueMicrotask(syncRouteState);
      return result;
    }) as History[typeof method];
  };

  patch('pushState');
  patch('replaceState');
  window.addEventListener('popstate',syncRouteState);
  window.addEventListener('hashchange',syncRouteState);
}
