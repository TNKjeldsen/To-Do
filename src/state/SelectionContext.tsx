import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TaskSnapshot } from '../types';
import { useAppState } from './AppStateContext';

const CLIPBOARD_KEY = 'todo.clipboard.v1';

/**
 * The clipboard outlives a reload on purpose — copying a whole day's schedule
 * and then pasting it after the app was backgrounded on a phone is exactly the
 * flow this exists for.
 */
function loadClipboard(): TaskSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CLIPBOARD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: TaskSnapshot[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.title !== 'string') continue;
      out.push({
        title: o.title,
        ...(typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time)
          ? { time: o.time }
          : {}),
        subtasks: Array.isArray(o.subtasks)
          ? o.subtasks.filter((t): t is string => typeof t === 'string')
          : [],
      });
    }
    return out;
  } catch {
    return [];
  }
}

function saveClipboard(snapshots: TaskSnapshot[]): void {
  try {
    if (snapshots.length === 0) localStorage.removeItem(CLIPBOARD_KEY);
    else localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(snapshots));
  } catch {
    // A full or unavailable localStorage shouldn't break copy/paste in-session.
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
  const [clipboard, setClipboard] = useState<TaskSnapshot[]>(loadClipboard);
  const [activeDate, setActiveDate] = useState<string | null>(null);

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
    saveClipboard(snapshots);
    return snapshots.length;
  }, [state.tasks, selectedIds]);

  const clearClipboard = useCallback(() => {
    setClipboard([]);
    saveClipboard([]);
  }, []);

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
