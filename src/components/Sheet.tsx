import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** When true, content extends full height on desktop dialog. */
  large?: boolean;
}

/**
 * Bottom sheet on mobile, centered dialog on md+.
 * Manages backdrop click, ESC, body scroll lock.
 */
export function Sheet({ open, onClose, title, children, large = false }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex md:items-center items-end justify-center"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={[
          'relative w-full md:max-w-lg bg-slate-900 border border-slate-800 shadow-2xl',
          'rounded-t-2xl md:rounded-2xl',
          large ? 'md:max-h-[85vh] max-h-[90vh]' : 'md:max-h-[80vh] max-h-[85vh]',
          'flex flex-col safe-bottom',
        ].join(' ')}
      >
        {title !== undefined ? (
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
            <div className="font-semibold text-base truncate">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Luk"
              className="p-1.5 rounded-md hover:bg-slate-800"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
        ) : null}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
