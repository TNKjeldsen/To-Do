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

/**
 * A copied card, stripped down to the bits worth pasting somewhere else.
 * Deliberately not a `Task`: no id, no done-state, no order — a paste always
 * produces brand new, unticked cards.
 */
export interface TaskSnapshot {
  title: string;
  time?: string;
  subtasks: string[];
}

/**
 * Driving / commute tracking. The model is built around the typical Danish
 * kørselsfradrag use-case: report how many days you drove home → work → home,
 * per month and per year. We default to "drove on every weekday" and let
 * the user explicitly mark exception days.
 */

/** A work address with the one-way distance from home and when it took effect. */
export interface WorkAddress {
  id: string;
  /** Friendly label, e.g. "Hovedkontor" or street address. */
  label: string;
  /** One-way distance from home in km. Round trip is 2 × this value. */
  oneWayKm: number;
  /** Effective from this YYYY-MM-DD (inclusive). Use the earliest date for the
   *  first address. When the job moves, add a new entry with the move date. */
  from: string;
}

export type ExclusionReason = 'sick' | 'wfh' | 'vacation' | 'holiday' | 'other';

/** A weekday on which the user did NOT drive home → work → home. */
export interface DrivingExclusion {
  /** YYYY-MM-DD */
  date: string;
  reason: ExclusionReason;
  note?: string;
}

export interface DrivingData {
  /** Optional free-text home address (informational, not used in math). */
  homeAddress?: string;
  /** Ordered list of work addresses by their `from` date. */
  workAddresses: WorkAddress[];
  /** Days the user did not drive (sick / WFH / holiday / etc.). */
  exclusions: DrivingExclusion[];
  /**
   * Dates (YYYY-MM-DD) where the user explicitly drove on a non-standard
   * day — e.g. called in on a weekend or worked on a public holiday.
   * Counted as a driving day even though it would normally be skipped.
   */
  inclusions: string[];
}

export const SCHEMA_VERSION = 6 as const;

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Currently active workspace — only tasks matching this are shown. */
  activeWorkspace: WorkspaceId;
  /** Epoch milliseconds of the last data-modifying action. Used by sync to
   *  decide whether the local or remote version wins (last-write-wins). */
  lastModified: number;
  tasks: Task[];
  driving: DrivingData;
  exportedAt?: string;
}

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
