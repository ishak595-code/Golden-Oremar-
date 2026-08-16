import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';

export function useDialogA11y(onClose: () => void, active = true) {
  return useAccessibleDialog<HTMLDivElement>(active, onClose);
}
