import { SCHEMA_VERSION, type AppData } from '../types';
import { validateAppData } from '../state/storage';
import { toDateKey } from './date';

export function exportToJSON(data: AppData): string {
  const payload: AppData = {
    schemaVersion: SCHEMA_VERSION,
    tasks: data.tasks,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadBackup(data: AppData): void {
  const json = exportToJSON(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `ugeplan-backup-${toDateKey(new Date())}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedBackup {
  ok: true;
  data: AppData;
  taskCount: number;
  exportedAt?: string;
}

export interface ParseError {
  ok: false;
  error: string;
}

export function parseBackupString(text: string): ParsedBackup | ParseError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON.' };
  }
  const valid = validateAppData(parsed);
  if (!valid) {
    return {
      ok: false,
      error: 'Filen ser ikke ud til at være en gyldig backup (forkert format).',
    };
  }
  const exportedAt =
    parsed && typeof parsed === 'object' && 'exportedAt' in parsed && typeof (parsed as { exportedAt: unknown }).exportedAt === 'string'
      ? (parsed as { exportedAt: string }).exportedAt
      : undefined;
  return {
    ok: true,
    data: valid,
    taskCount: valid.tasks.length,
    exportedAt,
  };
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Kunne ikke læse fil'));
    };
    reader.onerror = () => reject(new Error('Fejl under læsning af fil'));
    reader.readAsText(file);
  });
}
