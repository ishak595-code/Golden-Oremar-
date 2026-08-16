import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
}

// SettingsPanel: preserve all existing security/account sections, replace only appearance block.
{
  const path = 'src/features/account/SettingsPanel.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';",
    "import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';\nimport PremiumPreferencesPanel from'./PremiumPreferencesPanel';\nimport type{AppTheme}from'../appearance/theme';",
    'SettingsPanel imports',
  );
  source = replaceOnce(
    source,
    "export default function SettingsPanel({closure,onChanged,profile,theme='light',onThemeChange}:{closure:any;onChanged:()=>Promise<void>|void;profile?:any;theme?:string;onThemeChange?:(theme:'light'|'dark')=>void}){",
    "export default function SettingsPanel({closure,onChanged,profile,theme='light',onThemeChange}:{closure:any;onChanged:()=>Promise<void>|void;profile?:any;theme?:AppTheme;onThemeChange?:(theme:AppTheme)=>void}){",
    'SettingsPanel props',
  );
  const appearanceStart = source.indexOf('  <Panel title="Görünüm"');
  const passwordStart = source.indexOf('  <Panel title="Şifre Değiştir"', appearanceStart);
  if (appearanceStart < 0 || passwordStart < 0) throw new Error('SettingsPanel appearance boundaries not found');
  source = source.slice(0, appearanceStart) + '  <PremiumPreferencesPanel theme={theme} onThemeChange={onThemeChange}/>\n\n' + source.slice(passwordStart);
  fs.writeFileSync(path, source);
}

// AccountCenter: widen the already-existing device theme callback, nothing else.
{
  const path = 'src/features/account/AccountCenter.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import ReviewsPanel from'./ReviewsPanel';",
    "import ReviewsPanel from'./ReviewsPanel';\nimport type{AppTheme}from'../appearance/theme';",
    'AccountCenter theme import',
  );
  source = replaceOnce(
    source,
    "requestedView?:string; theme?:string; onThemeChange?:(theme:'light'|'dark')=>void;",
    "requestedView?:string; theme?:AppTheme; onThemeChange?:(theme:AppTheme)=>void;",
    'AccountCenter theme props',
  );
  fs.writeFileSync(path, source);
}

// Legacy Firebase notification listener may remain for old admin compatibility, but it must not play a second beep.
{
  const path = 'src/context/DataContext.tsx';
  let source = fs.readFileSync(path, 'utf8');
  const flag = '    let isFirstLoadNotifications = true;\n';
  if (!source.includes(flag)) throw new Error('Legacy notification first-load flag not found');
  source = source.replace(flag, '');
  const blockStart = source.indexOf('        if (!isFirstLoadNotifications) {');
  const blockEndMarker = '        isFirstLoadNotifications = false;\n';
  const blockEnd = source.indexOf(blockEndMarker, blockStart);
  if (blockStart < 0 || blockEnd < 0) throw new Error('Legacy notification sound block not found');
  source = source.slice(0, blockStart) + source.slice(blockEnd + blockEndMarker.length);
  fs.writeFileSync(path, source);
}

console.log('Premium settings integration applied safely.');
