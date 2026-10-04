// The floating safety button (report/block, required for user content) must
// never cover inputs or bottom actions: it floats only on browsing screens,
// which reserve bottom room for it, and screens with forms open the safety
// centre from an inline entry (Ayarlar row, Mesajlar thread header).
import fs from 'node:fs';
const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };
const center = read('src/features/store/safetyCenter.ts');
const controls = read('src/features/store/StoreComplianceControls.tsx');
const css = read('src/features/customer-experience/productDetailCommerceDock.css');
const settings = read('src/features/account/SettingsPanel.tsx');
const messages = read('src/features/account/MessagesPanel.tsx');
const tabs = center.match(/SAFETY_FAB_TABS = new Set\(\[([^\]]+)\]\)/)?.[1] || '';
need(tabs && !/'account'|'cart'|'admin'|'help'|'contact'|'feedback'/.test(tabs), 'The safety button must not float on account, cart, admin or help/form screens.');
need(/showFab\?<button type="button" onClick=\{\(\)=>void loadPanel\(\)\} className="go-safety-fab/.test(controls) && /SAFETY_FAB_TABS\.has\(appTab\)/.test(controls), 'StoreComplianceControls must render the button only on browsing tabs.');
need(/addEventListener\(OPEN_SAFETY_CENTER_EVENT,open\)/.test(controls), 'The safety centre must open from inline entries.');
need(/:root\[data-safety-fab="on"\] #root > \.min-h-screen \{\s*padding-bottom: calc\(9\.5rem/.test(css), 'Browsing screens must reserve bottom room for the button.');
need(/:root\[data-safety-fab="on"\] \.go-scroll-top/.test(css), '"Başa dön" must stack above the safety button.');
need(/\['safety','Güvenlik ve İçerik Bildirme'/.test(settings) && /if\(key==='safety'\)openSafetyCenter\(\)/.test(settings), 'Ayarlar must offer the safety centre.');
need(/onClick=\{openSafetyCenter\}[^>]*aria-label="Güvenlik: konuşmayı bildir veya kullanıcıyı engelle"/.test(messages), 'The Mesajlar thread must offer report/block.');
if (failures.length) { console.error(`Safety button placement audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Safety button placement contract audit passed.');
