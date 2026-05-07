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
  done: boolean;
  /** Sort order within the same day. */
  order: number;
  /** ISO timestamp when the task was created. */
  createdAt: string;
  /** ISO timestamp of last modification. */
  updatedAt: string;
  subtasks: Subtask[];
}

export const SCHEMA_VERSION = 1 as const;

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  tasks: Task[];
  exportedAt?: string;
}

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
