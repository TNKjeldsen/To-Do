import { SCHEMA_VERSION, type AppData, type Subtask, type Task } from '../types';
import { emptyState } from './reducer';

export const STORAGE_KEY = 'todo.app.v1';

/**
 * Validate and migrate data loaded from localStorage. Returns null if data
 * is unusable so the app can fall back to an empty state.
 */
export function validateAppData(input: unknown): AppData | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;
  if (!Array.isArray(obj.tasks)) return null;

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
      done: Boolean(t.done),
      order: typeof t.order === 'number' ? t.order : tasks.length * 1000 + 1000,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
      subtasks: subs,
    });
  }

  // Future migrations would happen here based on `version`.
  void version;

  return { schemaVersion: SCHEMA_VERSION, tasks };
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
