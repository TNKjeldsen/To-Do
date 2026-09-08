import { useEffect, useState } from 'react';
import { useSelection } from '../state/SelectionContext';
import { Icon } from './Icon';

/** "⌘C" on a Mac, "Ctrl+C" everywhere else. */
function shortcut(letter: string): string {
  const mac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  return mac ? `⌘${letter}` : `Ctrl+${letter}`;
}

interface SelectionBarProps {
  onPaste: () => void;
}

/**
 * Bottom action bar shown while cards are being picked. Sits above the mobile
 * workspace footer so it never covers it.
 */
export function SelectionBar({ onPaste }: SelectionBarProps) {
  const { selectionMode, selectedIds, clipboard, copySelection, exitSelection } =
    useSelection();
  const [copiedCount, setCopiedCount] = useState<number | null>(null);

  const count = selectedIds.size;

  useEffect(() => {
    if (copiedCount === null) return;
    const timer = window.setTimeout(() => setCopiedCount(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedCount]);

  // Desktop has no selection mode — the bar simply follows the selection.
  if (!selectionMode && count === 0) return null;

  return (
    <div className="fixed left-0 right-0 bottom-[3.25rem] sm:bottom-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-3 py-2 sm:safe-bottom">
      <div className="max-w-[1700px] mx-auto flex items-center gap-2">
        {/* The copy confirmation takes over the counter's slot rather than
            adding a second label — the bar has to survive a 375 px phone. */}
        <span
          className={[
            'text-sm min-w-0 truncate',
            copiedCount !== null ? 'text-sky-300' : 'text-slate-300',
          ].join(' ')}
        >
          {copiedCount !== null
            ? `${copiedCount} kopieret`
            : count === 0
              ? 'Vælg opgaver'
              : `${count} valgt`}
        </span>

        <span className="hidden md:inline text-xs text-slate-500 truncate">
          {count > 0
            ? `${shortcut('C')} for at kopiere`
            : `Klik en dag og ${shortcut('V')} for at sætte ind`}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          disabled={count === 0}
          onClick={() => setCopiedCount(copySelection())}
          className={[
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition',
            count === 0
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100',
          ].join(' ')}
        >
          <Icon name="copy" size={16} />
          Kopiér
        </button>

        <button
          type="button"
          disabled={clipboard.length === 0}
          onClick={onPaste}
          className={[
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition',
            clipboard.length === 0
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : 'bg-sky-500/20 border border-sky-500/50 text-sky-100 hover:bg-sky-500/30 active:bg-sky-500/40',
          ].join(' ')}
        >
          <Icon name="paste" size={16} />
          Sæt ind
          {clipboard.length > 0 ? (
            <span className="text-[11px] text-sky-300">({clipboard.length})</span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={exitSelection}
          aria-label="Afslut valg"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
