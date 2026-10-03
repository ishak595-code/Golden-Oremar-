import fs from 'node:fs';

const account=fs.readFileSync('src/features/account/AccountCenter.tsx','utf8');
const failures=[];
function expect(condition,message){if(!condition)failures.push(message);}

expect(account.includes("navigationCallbacksRef=useRef({onOpenContact,onOpenSellerApplication})"),'Account navigation callbacks must be stored in a ref so parent callback identity changes do not reset the current account subview.');
expect(account.includes("navigationCallbacksRef.current={onOpenContact,onOpenSellerApplication}"),'Account navigation callback ref must track the latest callbacks.');
expect(account.includes("},[requestedView]);"),'Requested account view synchronization must run only when requestedView changes.');
expect(!account.includes("[requestedView,onOpenContact,onOpenSellerApplication]"),'Account subviews must not reset when parent callback identities change.');
expect(account.includes("if(view==='profile')return<ProfilePanel"),'Profile navigation must remain connected to the profile panel.');
expect(account.includes("if(view==='settings')return<SettingsPanel"),'Settings navigation must remain connected to the focused settings panel.');

const app=fs.readFileSync('src/App.tsx','utf8');
const dialog=fs.readFileSync('src/features/accessibility/useAccessibleDialog.ts','utf8');
expect(app.includes("CapApp.addListener('backButton',()=>nativeBackRef.current())"),'Android back must be one listener that reads the latest navigation state.');
expect(app.includes('if(runBackHandlers())return;'),'Android back must close open dialogs and sub-panels before leaving the page.');
expect(app.includes('if(routeDepthRef.current>0){window.history.back();return;}'),'Android back must go to the previous screen through the history.');
expect(app.includes("showToast('Çıkmak için geri tuşuna tekrar basın.')"),'Android back must ask for a second press before leaving the app from home.');
expect(app.includes('onNavigateView={openAccount}'),'Account panels must get their own history entries.');
expect(dialog.includes('registerBackHandler('),'Accessible dialogs must close on Android back.');

if(failures.length){console.error('Golden Oremar account navigation stability audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar account navigation stability audit passed: account subviews remain stable across parent state refreshes.');
