import{useEffect,useRef}from'react';

const focusable='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogA11y(onClose:()=>void,active=true){
 const dialogRef=useRef<HTMLDivElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{if(!active)return;const previous=document.activeElement as HTMLElement|null;const node=dialogRef.current;if(!node)return;const first=node.querySelector<HTMLElement>(focusable);(first||node).focus();
  function onKeyDown(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}if(event.key!=='Tab')return;const nodes=Array.from(node.querySelectorAll<HTMLElement>(focusable)).filter(el=>!el.hasAttribute('disabled')&&el.offsetParent!==null);if(!nodes.length){event.preventDefault();node.focus();return;}const firstNode=nodes[0],lastNode=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===firstNode){event.preventDefault();lastNode.focus();}else if(!event.shiftKey&&document.activeElement===lastNode){event.preventDefault();firstNode.focus();}}
  document.addEventListener('keydown',onKeyDown);return()=>{document.removeEventListener('keydown',onKeyDown);previous?.focus?.();};
 },[active]);
 return dialogRef;
}
