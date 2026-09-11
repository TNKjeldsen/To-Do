import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TaskSnapshot } from '../types';
import { useAppState } from './AppStateContext';

const LEGACY_CLIPBOARD_KEY = 'todo.clipboard.v1';

/**
 * Earlier builds kept the clipboard in localStorage. It turned out to be more
 * annoying than useful — the app would still offer to paste last week's nine
 * cards days later — so the clipboard now lives and dies with the session.
 * This just sweeps up the leftover key.
 */
function dropLegacyClipboard(): void {
  try {
    localStorage.removeItem(LEGACY_CLIPBOARD_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

interface SelectionValue {
  /**
   * Touch-only tap-to-pick mode. On desktop you rubber-band select instead, so
   * this stays off there and the cards keep their normal click behaviour.
   */
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  clipboard: TaskSnapshot[];
  /**
   * The day Ctrl+V pastes into — set by clicking anywhere in a day column.
   * Null until the user has pointed at a day.
   */
  activeDate: string | null;
  setActiveDate: (date: string | null) => void;
  enterSelection: () => void;
  exitSelection: () => void;
  toggle: (id: string) => void;
  /** Replace the whole selection — used while dragging a marquee. */
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  /** Select or deselect a whole day at once. */
  setMany: (ids: string[], selected: boolean) => void;
  /** Snapshot the current selection into the clipboard. */
  copySelection: () => number;
  clearClipboard: () => void;
}

const SelectionContext = createContext<SelectionValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const { state } = useAppState();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [clipboard, setClipboard] = useState<TaskSnapshot[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(dropLegacyClipboard, []);

  const enterSelection = useCallback(() => setSelectionMode(true), []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const setMany = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const copySelection = useCallback(() => {
    // Copy in reading order — day by day, top to bottom within each day — so
    // pasting a whole week's routine keeps the schedule's shape.
    const snapshots: TaskSnapshot[] = state.tasks
      .filter((t) => selectedIds.has(t.id))
      .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
      .map((t) => ({
        title: t.title,
        ...(t.time ? { time: t.time } : {}),
        subtasks: t.subtasks
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => s.text),
      }));
    setClipboard(snapshots);
    return snapshots.length;
  }, [state.tasks, selectedIds]);

  const clearClipboard = useCallback(() => setClipboard([]), []);

  const value = useMemo<SelectionValue>(
    () => ({
      selectionMode,
      selectedIds,
      clipboard,
      activeDate,
      setActiveDate,
      enterSelection,
      exitSelection,
      toggle,
      setSelection,
      clearSelection,
      setMany,
      copySelection,
      clearClipboard,
    }),
    [
      selectionMode,
      selectedIds,
      clipboard,
      activeDate,
      enterSelection,
      exitSelection,
      toggle,
      setSelection,
      clearSelection,
      setMany,
      copySelection,
      clearClipboard,
    ]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider');
  return ctx;
}
