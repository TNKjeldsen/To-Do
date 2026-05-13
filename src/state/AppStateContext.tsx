import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData } from '../types';
import { reducer, type Action } from './reducer';
import { STORAGE_KEY, loadFromStorage, saveToStorage, validateAppData } from './storage';
import {
  loadSyncConfig,
  pullFromCloud,
  pushToCloud,
  type SyncConfig,
  type SyncState,
} from './sync';

interface AppStateValue {
  state: AppData;
  dispatch: (action: Action) => void;
  syncConfig: SyncConfig | null;
  syncState: SyncState;
  /** Refresh the in-memory sync config after persisting changes elsewhere. */
  refreshSyncConfig: () => void;
  /** Manually trigger a pull (e.g. from a "Sync nu"-button). */
  triggerPull: () => Promise<void>;
  /** Manually trigger a push. */
  triggerPush: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const SAVE_DEBOUNCE_MS = 250;
const PUSH_DEBOUNCE_MS = 2500;
/** Don't auto-pull on focus more often than this to avoid hammering the worker. */
const PULL_COOLDOWN_MS = 5000;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppData, () =>
    loadFromStorage()
  );

  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'idle' });

  const saveTimer = useRef<number | null>(null);
  const pushTimer = useRef<number | null>(null);
  const pushAbort = useRef<AbortController | null>(null);
  const pullAbort = useRef<AbortController | null>(null);
  const lastPushedVersion = useRef<number>(state.lastModified);
  const lastPullAt = useRef<number>(0);
  const ignoreNextStorageEvent = useRef<boolean>(false);

  // ---------- localStorage persistence (debounced) ----------
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

  // ---------- Cloud sync ----------
  const refreshSyncConfig = useCallback(() => {
    setSyncConfig(loadSyncConfig());
  }, []);

  const doPull = useCallback(
    async (config: SyncConfig, currentLocal: AppData): Promise<void> => {
      pullAbort.current?.abort();
      const ac = new AbortController();
      pullAbort.current = ac;
      setSyncState({ kind: 'pulling' });
      try {
        const result = await pullFromCloud(config, currentLocal, ac.signal);
        if (result.applied && result.remote) {
          // Preserve the device-local workspace selection — that's a UI
          // preference, not data the user wants synced. Without this, picking
          // "Arbejde" on one device would yank other devices into work mode.
          const merged: AppData = {
            ...result.remote,
            activeWorkspace: currentLocal.activeWorkspace,
          };
          // When the remote replaces local, treat that version as already
          // pushed so we don't immediately push it back as a "local edit".
          lastPushedVersion.current = result.remote.lastModified;
          dispatch({ type: 'HYDRATE', data: merged });
          setSyncState({ kind: 'success', at: Date.now(), direction: 'pull' });
        } else {
          setSyncState({ kind: 'success', at: Date.now(), direction: 'noop' });
        }
        lastPullAt.current = Date.now();
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSyncState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Ukendt fejl ved pull',
          at: Date.now(),
        });
      }
    },
    []
  );

  const doPush = useCallback(
    async (config: SyncConfig, data: AppData): Promise<void> => {
      pushAbort.current?.abort();
      const ac = new AbortController();
      pushAbort.current = ac;
      setSyncState({ kind: 'pushing' });
      try {
        await pushToCloud(config, data, ac.signal);
        lastPushedVersion.current = data.lastModified;
        setSyncState({ kind: 'success', at: Date.now(), direction: 'push' });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSyncState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Ukendt fejl ved push',
          at: Date.now(),
        });
      }
    },
    []
  );

  // Initial pull when sync becomes configured.
  useEffect(() => {
    if (!syncConfig) return;
    void doPull(syncConfig, state);
    // We deliberately depend only on the config — we don't want to re-pull
    // every time state changes (push handles that direction).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncConfig?.workerUrl, syncConfig?.syncKey]);

  // Auto-pull on window focus (with cooldown).
  useEffect(() => {
    if (!syncConfig) return;
    const onFocus = () => {
      if (Date.now() - lastPullAt.current < PULL_COOLDOWN_MS) return;
      void doPull(syncConfig, state);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncConfig, doPull, state]);

  // Debounced push after local edits.
  useEffect(() => {
    if (!syncConfig) return;
    if (state.lastModified <= lastPushedVersion.current) return;
    if (pushTimer.current !== null) {
      window.clearTimeout(pushTimer.current);
    }
    pushTimer.current = window.setTimeout(() => {
      void doPush(syncConfig, state);
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current !== null) {
        window.clearTimeout(pushTimer.current);
      }
    };
  }, [state, syncConfig, doPush]);

  // Manual triggers exposed via context.
  const triggerPull = useCallback(async () => {
    if (!syncConfig) return;
    await doPull(syncConfig, state);
  }, [syncConfig, state, doPull]);

  const triggerPush = useCallback(async () => {
    if (!syncConfig) return;
    await doPush(syncConfig, state);
  }, [syncConfig, state, doPush]);

  const value = useMemo<AppStateValue>(
    () => ({
      state,
      dispatch,
      syncConfig,
      syncState,
      refreshSyncConfig,
      triggerPull,
      triggerPush,
    }),
    [state, syncConfig, syncState, refreshSyncConfig, triggerPull, triggerPush]
  );

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
        .sort((a, b) => {
          // Done tasks always go to the bottom
          if (a.done !== b.done) return a.done ? 1 : -1;
          // Tasks with a time come first, sorted by time
          if (a.time && b.time) return a.time.localeCompare(b.time);
          if (a.time) return -1;
          if (b.time) return 1;
          return a.order - b.order;
        }),
    [state.tasks, date, ws]
  );
}

export function useActiveWorkspace() {
  return useAppState().state.activeWorkspace;
}

export function useSync() {
  const { syncConfig, syncState, refreshSyncConfig, triggerPull, triggerPush } =
    useAppState();
  return { syncConfig, syncState, refreshSyncConfig, triggerPull, triggerPush };
}
