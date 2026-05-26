import {
  SCHEMA_VERSION,
  type AppData,
  type DrivingData,
  type DrivingExclusion,
  type ExclusionReason,
  type Subtask,
  type Task,
  type WorkAddress,
  type WorkspaceId,
} from '../types';
import { emptyState } from './reducer';

const VALID_EXCLUSION_REASONS: ReadonlySet<ExclusionReason> = new Set([
  'sick',
  'wfh',
  'vacation',
  'holiday',
  'other',
]);

function asExclusionReason(value: unknown): ExclusionReason {
  return typeof value === 'string' && VALID_EXCLUSION_REASONS.has(value as ExclusionReason)
    ? (value as ExclusionReason)
    : 'other';
}

function parseDrivingData(raw: unknown): DrivingData {
  if (!raw || typeof raw !== 'object') {
    return { workAddresses: [], exclusions: [], inclusions: [] };
  }
  const obj = raw as Record<string, unknown>;
  const workAddresses: WorkAddress[] = [];
  if (Array.isArray(obj.workAddresses)) {
    for (const r of obj.workAddresses) {
      if (!r || typeof r !== 'object') continue;
      const w = r as Record<string, unknown>;
      if (typeof w.id !== 'string') continue;
      if (typeof w.from !== 'string') continue;
      const oneWayKm =
        typeof w.oneWayKm === 'number' && Number.isFinite(w.oneWayKm)
          ? Math.max(0, w.oneWayKm)
          : 0;
      workAddresses.push({
        id: w.id,
        label: typeof w.label === 'string' ? w.label : '',
        oneWayKm,
        from: w.from,
      });
    }
  }
  const exclusions: DrivingExclusion[] = [];
  if (Array.isArray(obj.exclusions)) {
    for (const r of obj.exclusions) {
      if (!r || typeof r !== 'object') continue;
      const e = r as Record<string, unknown>;
      if (typeof e.date !== 'string') continue;
      exclusions.push({
        date: e.date,
        reason: asExclusionReason(e.reason),
        ...(typeof e.note === 'string' && e.note.trim() ? { note: e.note } : {}),
      });
    }
  }
  const inclusions: string[] = [];
  if (Array.isArray(obj.inclusions)) {
    for (const d of obj.inclusions) {
      if (typeof d === 'string') inclusions.push(d);
    }
  }
  const out: DrivingData = { workAddresses, exclusions, inclusions };
  if (typeof obj.homeAddress === 'string' && obj.homeAddress.trim()) {
    out.homeAddress = obj.homeAddress;
  }
  return out;
}

export const STORAGE_KEY = 'todo.app.v1';

function asWorkspace(value: unknown, fallback: WorkspaceId = 'private'): WorkspaceId {
  return value === 'work' || value === 'private' ? value : fallback;
}

/**
 * Validate and migrate data loaded from localStorage. Returns null if data
 * is unusable so the app can fall back to an empty state.
 *
 * Schema migrations:
 *   v1 → v2: tasks gain `workspace`, AppData gains `activeWorkspace`.
 *            Existing tasks default to "private" so the user's data appears
 *            in their (default) Privat workspace.
 *   v3 → v4: AppData gains `trips` array (free-form mileage log).
 *   v4 → v5: trips replaced with a commute-focused `driving` object
 *            (work addresses with effective dates + exclusion days).
 *            Old trips data is discarded because the model is too different
 *            to migrate meaningfully.
 */
export function validateAppData(input: unknown): AppData | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (!Array.isArray(obj.tasks)) return null;

  const activeWorkspace = asWorkspace(obj.activeWorkspace);
  const lastModified =
    typeof obj.lastModified === 'number' && Number.isFinite(obj.lastModified)
      ? obj.lastModified
      : Date.now();

  const tasks: Task[] = [];
  for (const raw of obj.tasks) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Record<string, unknown>;
    if (typeof t.id !== 'string') continue;
    if (typeof t.title !== 'string') continue;
    if (typeof t.date !== 'string') continue;
    const subs: Subtask[] = [];
    if (Array.isArray(t.subtasks)) {
      for (const sraw of t.subtasks) {
        if (!sraw || typeof sraw !== 'object') continue;
        const s = sraw as Record<string, unknown>;
        if (typeof s.id !== 'string' || typeof s.text !== 'string') continue;
        subs.push({
          id: s.id,
          text: s.text,
          done: Boolean(s.done),
          order: typeof s.order === 'number' ? s.order : subs.length * 1000 + 1000,
        });
      }
    }
    tasks.push({
      id: t.id,
      title: t.title,
      date: t.date,
      unscheduled: Boolean(t.unscheduled) || t.date === 'unscheduled',
      done: Boolean(t.done),
      order: typeof t.order === 'number' ? t.order : tasks.length * 1000 + 1000,
      repeatWeekly: Boolean(t.repeatWeekly),
      ...(typeof t.time === 'string' && /^\d{2}:\d{2}$/.test(t.time) ? { time: t.time } : {}),
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
      workspace: asWorkspace(t.workspace),
      subtasks: subs,
    });
  }

  const driving = parseDrivingData(obj.driving);

  return {
    schemaVersion: SCHEMA_VERSION,
    activeWorkspace,
    lastModified,
    tasks,
    driving,
  };
}

export function loadFromStorage(): AppData {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return validateAppData(parsed) ?? emptyState();
  } catch (err) {
    console.warn('Failed to load app data, starting fresh', err);
    return emptyState();
  }
}

export function saveToStorage(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to persist app data', err);
  }
}
