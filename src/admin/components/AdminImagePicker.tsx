import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/avif';

type Props = {
  /** Current stored object key inside the catalog-public bucket, or '' when unset. */
  value: string;
  /** Resolves a stored object key to a displayable URL. */
  toUrl: (storagePath: string) => string;
  /** Uploads the chosen file and resolves to the stored object key. */
  onUpload: (file: File) => Promise<string>;
  /** Called with the new object key, or '' when the image is removed. */
  onChange: (storagePath: string) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
};

/**
 * Image picker for admin editors.
 *
 * Offers two routes deliberately rather than one generic file input:
 *   - "Galeriden seç" opens the normal picker, which on a phone means the
 *     photo library and on a desktop means the file browser
 *   - "Kamera ile çek" sets capture="environment", which on a phone opens the
 *     rear camera directly. Desktop browsers ignore the attribute and fall
 *     back to the file browser, so the button is never a dead end
 *
 * Both inputs are visually hidden but reachable, and the wrapping labels carry
 * the accessible name, so keyboard and screen reader users get the same two
 * choices as touch users.
 *
 * The component only ever hands upward a storage object key. It never accepts
 * a pasted URL, which is the specific mistake that put external stock photo
 * links into category rows and made them render as broken images.
 */
export default function AdminImagePicker({ value, toUrl, onUpload, onChange, label, hint, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const previewRef = useRef('');

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  async function handleFile(file: File | null) {
    if (!file || disabled || busy) return;
    setError('');

    // Show the local file immediately so the editor feels responsive on a slow
    // connection, then swap to the stored copy once the upload lands.
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const localUrl = URL.createObjectURL(file);
    previewRef.current = localUrl;
    setPreview(localUrl);

    try {
      setBusy(true);
      const storagePath = await onUpload(file);
      onChange(storagePath);
    } catch (next) {
      const message = String((next as { message?: string })?.message || '').trim();
      setError(message || 'Görsel yüklenemedi. Lütfen tekrar deneyin.');
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = '';
      }
      setPreview('');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (disabled || busy) return;
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = '';
    }
    setPreview('');
    setError('');
    onChange('');
  }

  const shown = preview || (value ? toUrl(value) : '');

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {hint && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}

      <div className="flex flex-wrap items-start gap-3">
        <div
          className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
          aria-live="polite"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-gray-400" />
          ) : shown ? (
            <img src={shown} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon aria-hidden="true" className="h-6 w-6 text-gray-300 dark:text-gray-600" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-gold dark:border-gray-700 ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
              Galeriden seç
              <input
                type="file"
                accept={ACCEPTED}
                className="sr-only"
                disabled={disabled || busy}
                onChange={event => {
                  void handleFile(event.target.files?.[0] || null);
                  event.target.value = '';
                }}
              />
            </label>

            <label
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-gold dark:border-gray-700 ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Camera aria-hidden="true" className="mr-2 h-4 w-4" />
              Kamera ile çek
              <input
                type="file"
                accept={ACCEPTED}
                capture="environment"
                className="sr-only"
                disabled={disabled || busy}
                onChange={event => {
                  void handleFile(event.target.files?.[0] || null);
                  event.target.value = '';
                }}
              />
            </label>

            {(value || preview) && !busy && (
              <button
                type="button"
                onClick={clear}
                disabled={disabled}
                className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 dark:text-red-300"
              >
                <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                Kaldır
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            JPEG, PNG, WebP veya AVIF. En fazla 10 MB. Telefonda kamera seçeneği arka kamerayı açar.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
