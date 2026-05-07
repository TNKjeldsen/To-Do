import type { AppData } from '../types';
import { validateAppData } from './storage';

/**
 * Sync configuration is stored separately from the app data so it never
 * accidentally syncs to other devices, and so that "Slet alle data" doesn't
 * also wipe your sync setup.
 */
const CONFIG_KEY = 'todo.app.sync';

export interface SyncConfig {
  /** Worker base URL, e.g. "https://ugeplan-sync.user.workers.dev" (no trailing slash). */
  workerUrl: string;
  /** Long random key, also used as the URL identifier. 16-128 chars [A-Za-z0-9_-]. */
  syncKey: string;
}

export type SyncState =
  | { kind: 'idle' }
  | { kind: 'pulling' }
  | { kind: 'pushing' }
  | { kind: 'success'; at: number; direction: 'pull' | 'push' | 'noop' }
  | { kind: 'error'; message: string; at: number };

export const SYNC_KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    if (
      typeof parsed.workerUrl !== 'string' ||
      typeof parsed.syncKey !== 'string'
    ) {
      return null;
    }
    if (!SYNC_KEY_RE.test(parsed.syncKey)) return null;
    return {
      workerUrl: parsed.workerUrl.replace(/\/+$/, ''),
      syncKey: parsed.syncKey,
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      workerUrl: config.workerUrl.replace(/\/+$/, ''),
      syncKey: config.syncKey,
    })
  );
}

export function clearSyncConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

/** Generate a 32-char URL-safe random sync key (≈190 bits of entropy). */
export function generateSyncKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface PullResult {
  /** True when the remote was newer and replaced local. */
  applied: boolean;
  /** Remote payload if any (null = empty cloud). */
  remote: AppData | null;
}

/**
 * Fetch remote payload. Returns the parsed AppData (or null) plus whether the
 * caller should apply it (remote.lastModified > local.lastModified).
 */
export async function pullFromCloud(
  config: SyncConfig,
  local: AppData,
  signal?: AbortSignal
): Promise<PullResult> {
  const url = `${config.workerUrl}/sync/${encodeURIComponent(config.syncKey)}`;
  const res = await fetch(url, { method: 'GET', signal });
  if (!res.ok) {
    throw new Error(`Pull mislykkedes (${res.status})`);
  }
  const body = (await res.json()) as { data: unknown };
  if (body.data === null || body.data === undefined) {
    return { applied: false, remote: null };
  }
  const remote = validateAppData(body.data);
  if (!remote) {
    throw new Error('Skydata har ugyldigt format');
  }
  const applied = remote.lastModified > local.lastModified;
  return { applied, remote };
}

/** Push local payload to the cloud. */
export async function pushToCloud(
  config: SyncConfig,
  data: AppData,
  signal?: AbortSignal
): Promise<void> {
  const url = `${config.workerUrl}/sync/${encodeURIComponent(config.syncKey)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Push mislykkedes (${res.status})`);
  }
}

/**
 * Probe a worker URL to verify it is reachable and looks like an Ugeplan
 * sync worker. Throws on failure.
 */
export async function probeWorker(workerUrl: string, signal?: AbortSignal): Promise<void> {
  const url = `${workerUrl.replace(/\/+$/, '')}/health`;
  const res = await fetch(url, { method: 'GET', signal });
  if (!res.ok) throw new Error(`Worker svarede ${res.status}`);
  const body = (await res.json().catch(() => null)) as { ok?: boolean; service?: string } | null;
  if (!body || body.ok !== true) {
    throw new Error('Worker svarede uventet — er URL korrekt?');
  }
}

export function normaliseWorkerUrl(input: string): string {
  let v = input.trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/\/+$/, '');
}
