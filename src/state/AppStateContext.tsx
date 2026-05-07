import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { AppData } from '../types';
import { reducer, type Action } from './reducer';
import { STORAGE_KEY, loadFromStorage, saveToStorage, validateAppData } from './storage';

interface AppStateValue {
  state: AppData;
  dispatch: (action: Action) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const SAVE_DEBOUNCE_MS = 250;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppData, () =>
    loadFromStorage()
  );

  const saveTimer = useRef<number | null>(null);
  const ignoreNextStorageEvent = useRef<boolean>(false);

  useEffect(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      ignoreNextStorageEvent.current = true;
      saveToStorage(state);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [state]);

  // Flush on unload to avoid losing the last edit.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        saveToStorage(state);
      }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [state]);

  // Cross-tab sync via the storage event.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (ignoreNextStorageEvent.current) {
        ignoreNextStorageEvent.current = false;
        return;
      }
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        const valid = validateAppData(parsed);
        if (valid) dispatch({ type: 'HYDRATE', data: valid });
      } catch {
        // ignore corrupt cross-tab payloads
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

export function useDispatch(): (action: Action) => void {
  return useAppState().dispatch;
}

export function useTasksByDate(date: string) {
  const { state } = useAppState();
  const ws = state.activeWorkspace;
  return useMemo(
    () =>
      state.tasks
        .filter((t) => t.date === date && t.workspace === ws)
        .sort((a, b) => a.order - b.order),
    [state.tasks, date, ws]
  );
}

export function useActiveWorkspace() {
  return useAppState().state.activeWorkspace;
}
