import{useEffect,useRef}from'react';

/**
 * Screen-level "back" steps that live inside a page rather than in the
 * browser history: an open dialog or sheet, a sub-panel of the account
 * screen. The Android hardware back button asks this stack first, so back
 * closes what the user opened last before it leaves the page.
 *
 * Handlers run newest first. A handler returns false when it has nothing to
 * close at the moment, and the next one is asked.
 */
type BackHandler=()=>boolean|void;
const handlers:{id:number;run:BackHandler}[]=[];
let nextId=1;

export function registerBackHandler(run:BackHandler):()=>void{
 const id=nextId++;
 handlers.push({id,run});
 return()=>{const index=handlers.findIndex(entry=>entry.id===id);if(index>=0)handlers.splice(index,1);};
}

/** Runs the newest handler that takes the step. True when something closed. */
export function runBackHandlers():boolean{
 for(let index=handlers.length-1;index>=0;index-=1){
  const entry=handlers[index];
  try{if(entry.run()!==false)return true;}catch{/* a broken handler must not trap the user */}
 }
 return false;
}

/** Registers `onBack` while `active` is true. The latest callback is always used. */
export function useBackHandler(active:boolean,onBack:()=>boolean|void){
 const callbackRef=useRef(onBack);
 callbackRef.current=onBack;
 useEffect(()=>{if(!active)return;return registerBackHandler(()=>callbackRef.current());},[active]);
}
