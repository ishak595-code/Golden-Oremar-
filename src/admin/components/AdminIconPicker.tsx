import React, { useId, useState } from 'react';

/**
 * Curated symbol set for category badges.
 *
 * Kept deliberately small and on-theme rather than exposing a full emoji
 * keyboard. A short, meaningful list is faster to scan, keeps the storefront
 * visually coherent, and avoids the category strip filling up with whatever
 * symbol happened to be nearest on someone's keyboard.
 *
 * Each entry carries a Turkish label so the option is announced meaningfully
 * to screen readers instead of being read as a bare pictograph.
 */
const ICONS: Array<{ value: string; label: string }> = [
  { value: '🍯', label: 'Bal' },
  { value: '🐝', label: 'Arı' },
  { value: '🌿', label: 'Bitki' },
  { value: '🌾', label: 'Tahıl' },
  { value: '🧀', label: 'Peynir' },
  { value: '🥛', label: 'Süt' },
  { value: '🥚', label: 'Yumurta' },
  { value: '🍖', label: 'Et' },
  { value: '🐟', label: 'Balık' },
  { value: '🍎', label: 'Meyve' },
  { value: '🥬', label: 'Sebze' },
  { value: '🌰', label: 'Kuruyemiş' },
  { value: '🫒', label: 'Zeytin' },
  { value: '🧴', label: 'Yağ' },
  { value: '🍵', label: 'Çay' },
  { value: '☕', label: 'Kahve' },
  { value: '🧂', label: 'Baharat' },
  { value: '🫙', label: 'Kavanoz' },
  { value: '🍞', label: 'Ekmek' },
  { value: '💧', label: 'Su' },
  { value: '🪨', label: 'Taş' },
  { value: '⛰️', label: 'Dağ' },
  { value: '🌸', label: 'Çiçek' },
  { value: '🧺', label: 'Sepet' },
];

type Props = {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
};

/**
 * Icon picker for categories.
 *
 * Replaces a free-text field whose only guidance was a placeholder. Free text
 * meant any string could land in the column, including ones that render as an
 * empty box on devices lacking the glyph.
 *
 * Selection is exposed as a radio group so arrow keys move between options and
 * assistive technology announces both the current choice and the total, which
 * a grid of buttons would not do.
 */
export default function AdminIconPicker({ value, onChange, disabled }: Props) {
  const groupId = useId();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ICONS : ICONS.slice(0, 12);

  return (
    <div role="radiogroup" aria-labelledby={`${groupId}-label`} className="block">
      <span id={`${groupId}-label`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Kategori simgesi
      </span>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Görsel yüklenmediğinde kategori kartında bu simge görünür.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={value === ''}
          aria-label="Simge yok"
          disabled={disabled}
          onClick={() => onChange('')}
          className={`grid h-11 min-w-11 place-items-center rounded-xl border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 ${value === '' ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'text-gray-500'} ${disabled ? 'opacity-50' : ''}`}
        >
          Yok
        </button>

        {visible.map(icon => (
          <button
            key={icon.value}
            type="button"
            role="radio"
            aria-checked={value === icon.value}
            aria-label={icon.label}
            disabled={disabled}
            onClick={() => onChange(icon.value)}
            className={`grid h-11 w-11 place-items-center rounded-xl border text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 ${value === icon.value ? 'border-brand-green bg-brand-green/10' : ''} ${disabled ? 'opacity-50' : ''}`}
          >
            <span aria-hidden="true">{icon.value}</span>
          </button>
        ))}
      </div>

      {ICONS.length > 12 && (
        <button
          type="button"
          onClick={() => setExpanded(current => !current)}
          disabled={disabled}
          className="mt-2 min-h-11 rounded-xl text-sm font-semibold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          {expanded ? 'Daha az simge göster' : `Tüm simgeleri göster (${ICONS.length})`}
        </button>
      )}
    </div>
  );
}
