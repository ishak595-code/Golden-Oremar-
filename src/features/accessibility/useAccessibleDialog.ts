import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type InertSnapshot = {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
};

function isolateDialogFromBackground(dialog: HTMLElement) {
  const snapshots: InertSnapshot[] = [];
  let current: HTMLElement = dialog;
  let parent = current.parentElement;

  while (parent && parent !== document.body) {
    for (const sibling of Array.from(parent.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === current) continue;
      snapshots.push({
        element: sibling,
        inert: sibling.inert,
        ariaHidden: sibling.getAttribute('aria-hidden'),
      });
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
    }
    current = parent;
    parent = parent.parentElement;
  }

  return () => {
    for (const snapshot of snapshots.reverse()) {
      snapshot.element.inert = snapshot.inert;
      if (snapshot.ariaHidden === null) snapshot.element.removeAttribute('aria-hidden');
      else snapshot.element.setAttribute('aria-hidden', snapshot.ariaHidden);
    }
  };
}

export function useAccessibleDialog<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const restoreBackground = isolateDialogFromBackground(dialog);
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      dialog.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true' &&
          element.closest('[inert], [aria-hidden="true"]') === null &&
          element.getClientRects().length > 0,
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      window.requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
      });
    };
  }, [open]);

  return dialogRef;
}
