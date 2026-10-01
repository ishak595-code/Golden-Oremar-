import React, { useEffect, useState } from 'react';
import { isSnapshotMode, SNAPSHOT_MODE_EVENT } from '../../lib/offlineCatalog';

/**
 * Shown while the storefront is answered from the shipped catalogue copy
 * (src/lib/offlineCatalog.ts): browsing works, ordering and accounts do not.
 * Says so plainly, once, without alarming the customer.
 */
export function SnapshotModeNotice() {
  const [active, setActive] = useState(isSnapshotMode);
  useEffect(() => {
    const on = () => setActive(true);
    window.addEventListener(SNAPSHOT_MODE_EVENT, on);
    if (isSnapshotMode()) setActive(true);
    return () => window.removeEventListener(SNAPSHOT_MODE_EVENT, on);
  }, []);
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="snapshot-mode-notice"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold leading-snug text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100"
    >
      Mağazamız kısa bir bakımda. Ürünleri inceleyebilirsiniz; sipariş ve hesap işlemleri çok yakında yeniden açılacak.
    </div>
  );
}
