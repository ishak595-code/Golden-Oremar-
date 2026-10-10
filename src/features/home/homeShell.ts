/** The build-time first screen (scripts/prerender-home.mjs) gives way to the app. */
export function removeHomeShell(){try{document.getElementById('go-home-shell')?.remove();}catch{/* not in a browser */}}
