import{parsePublicRoute}from'./appUrl';

const PATCH_FLAG='__goldenOremarCustomerRoutePatched__';
const ROUTE_EVENT='golden-oremar:route-change';

// The tab comes from the same parser the app routes with. Reading only
// ?tab= missed clean paths such as /urun/<slug>, so the product page was
// tagged "home": its purchase dock lost its styling and the tab bar covered
// the page.
function currentTab(){
  try{return parsePublicRoute(window.location.href).tab||'home';}
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
