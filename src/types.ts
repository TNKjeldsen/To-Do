export type WorkspaceId = 'work' | 'private';

export const WORKSPACES: { id: WorkspaceId; label: string }[] = [
  { id: 'private', label: 'Privat' },
  { id: 'work', label: 'Arbejde' },
];

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  /** Local ISO date string YYYY-MM-DD (no time, no timezone). */
  date: string;
  /** If true, this task lives in the "no fixed day" list. */
  unscheduled?: boolean;
  done: boolean;
  /** Sort order within the same day. */
  order: number;
  /** Recreate on same weekday by rolling date +7 days when completed. */
  repeatWeekly?: boolean;
  /** Optional time of day in HH:MM format. */
  time?: string;
  /** ISO timestamp when the task was created. */
  createdAt: string;
  /** ISO timestamp of last modification. */
  updatedAt: string;
  /** Workspace this task belongs to ("Privat" or "Arbejde"). */
  workspace: WorkspaceId;
  subtasks: Subtask[];
}

export interface Trip {
  id: string;
  /** Local ISO date YYYY-MM-DD. */
  date: string;
  /** Free-form start location, e.g. "Hjem". */
  from: string;
  /** Free-form destination, e.g. "Kunde Aalborg". */
  to: string;
  /** Distance in km (one-way, as registered). */
  km: number;
  /** Purpose / description, e.g. "Kundemøde". */
  purpose: string;
  /** Optional free-text note. */
  note?: string;
  /** Workspace this trip belongs to. */
  workspace: WorkspaceId;
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 4 as const;

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Currently active workspace — only tasks matching this are shown. */
  activeWorkspace: WorkspaceId;
  /** Epoch milliseconds of the last data-modifying action. Used by sync to
   *  decide whether the local or remote version wins (last-write-wins). */
  lastModified: number;
  tasks: Task[];
  trips: Trip[];
  exportedAt?: string;
}

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
