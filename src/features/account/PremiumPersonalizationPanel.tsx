import React, { useState } from 'react';
import { Check, Headphones, Sparkles } from 'lucide-react';
import { PREMIUM_PALETTES, type AppTheme, type PremiumPalette } from '../appearance/theme';
import { NOTIFICATION_SOUND_PROFILES, type NotificationSoundId } from '../notifications/notificationSound';
import { Panel } from './ui';

export default function PremiumPersonalizationPanel({
  theme,
  palette,
  sound,
  onThemeChange,
  onPaletteChange,
  onSoundChange,
  onPreviewSound,
}: {
  theme: AppTheme;
  palette: PremiumPalette;
  sound: NotificationSoundId;
  onThemeChange?: (theme: AppTheme) => void;
  onPaletteChange?: (palette: PremiumPalette) => void;
  onSoundChange?: (sound: NotificationSoundId) => void;
  onPreviewSound?: (sound: NotificationSoundId) => Promise<boolean> | boolean;
}) {
  const [soundStatus, setSoundStatus] = useState('');
  const [previewing, setPreviewing] = useState<NotificationSoundId | null>(null);

  async function preview(candidate: NotificationSoundId) {
    if (previewing) return;
    setPreviewing(candidate);
    setSoundStatus('');
    try {
      const played = await onPreviewSound?.(candidate);
      setSoundStatus(played === false ? 'Bu cihaz ses önizlemesini şu anda başlatamadı.' : `${NOTIFICATION_SOUND_PROFILES.find(item => item.id === candidate)?.name || 'Bildirim'} sesi oynatıldı.`);
    } catch {
      setSoundStatus('Ses önizlemesi başlatılamadı.');
    } finally {
      window.setTimeout(() => setPreviewing(null), 300);
    }
  }

  return <>
    <Panel title="Premium Görünüm" description="Aydınlık/koyu yüzeyi ve Golden Oremar’ın kişisel renk imzasını birbirinden bağımsız seçin.">
      <fieldset>
        <legend className="text-sm font-bold">Yüzey parlaklığı</legend>
        <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Yüzey parlaklığı">
          {(['light','dark'] as const).map(value => <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => onThemeChange?.(value)}
            className={`min-h-12 rounded-xl border px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${theme === value ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 dark:border-gray-700'}`}
          >{value === 'light' ? 'Aydınlık' : 'Karanlık'}</button>)}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="flex items-center gap-2 text-sm font-bold"><Sparkles aria-hidden="true" className="h-4 w-4 text-brand-gold"/>Premium renk imzası</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Premium renk teması">
          {PREMIUM_PALETTES.map(option => {
            const selected = palette === option.id;
            return <label key={option.id} className={`relative cursor-pointer rounded-2xl border p-4 transition-shadow focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-gold ${selected ? 'border-brand-gold bg-brand-gold/5 shadow-sm' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="radio" name="premium-palette" value={option.id} checked={selected} onChange={() => onPaletteChange?.(option.id)} className="sr-only"/>
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-bold">{option.name}</div><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{option.description}</p></div>
                {selected ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-green text-white" aria-label="Seçili"><Check aria-hidden="true" className="h-4 w-4"/></span> : null}
              </div>
              <div className="mt-4 flex gap-2" aria-hidden="true">{option.swatches.map(color => <span key={color} className="h-7 flex-1 rounded-lg border border-black/10 shadow-inner" style={{backgroundColor: color}}/> )}</div>
            </label>;
          })}
        </div>
      </fieldset>
      <p className="mt-4 text-xs text-gray-500">Renk imzası yalnız dekor değildir; ana vurgu, başlık/metin tonları, kart yüzeyleri ve odak rengi birlikte uyarlanır. Seçim yalnız bu cihazda saklanır.</p>
    </Panel>

    <Panel title="Premium Bildirim Sesi" description="Yeni uygulama içi bildirimler için kısa ve kendine özgü Golden Oremar ses imzasını seçin.">
      <div role="radiogroup" aria-label="Bildirim sesi" className="space-y-3">
        {NOTIFICATION_SOUND_PROFILES.map(option => {
          const selected = sound === option.id;
          const busy = previewing === option.id;
          return <div key={option.id} className={`rounded-2xl border p-4 ${selected ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-start gap-3">
              <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-gold rounded-lg">
                <input type="radio" name="notification-sound" value={option.id} checked={selected} onChange={() => { onSoundChange?.(option.id); void preview(option.id); }} className="mt-1 h-5 w-5 shrink-0"/>
                <span><span className="font-bold">{option.name}{option.recommended ? <span className="ml-2 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs text-brand-green">Önerilen</span> : null}</span><span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">{option.description}</span></span>
              </label>
              <button type="button" disabled={Boolean(previewing)} onClick={() => void preview(option.id)} className="min-h-11 shrink-0 rounded-xl border px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label={`${option.name} sesini dinle`}><Headphones aria-hidden="true" className="mr-2 inline h-4 w-4"/>{busy ? 'Çalıyor…' : 'Dinle'}</button>
            </div>
          </div>;
        })}
      </div>
      <div role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-brand-green">{soundStatus}</div>
      <p className="mt-2 text-xs text-gray-500">İlk kurulumda önerilen “Yağmur Damlası” seçilir. Cihazın işletim sistemi bildirim/sessiz mod ayarları her zaman önceliklidir.</p>
    </Panel>
  </>;
}
