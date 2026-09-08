import { newId } from '../lib/id';
import { parseTitleTime } from '../lib/parseTitle';
import {
  SCHEMA_VERSION,
  type AppData,
  type DrivingExclusion,
  type ExclusionReason,
  type Subtask,
  type Task,
  type TaskSnapshot,
  type WorkAddress,
  type WorkspaceId,
} from '../types';

export type Action =
  | { type: 'HYDRATE'; data: AppData }
  | { type: 'SET_WORKSPACE'; workspace: WorkspaceId }
  | { type: 'ADD_TASK'; date: string; title: string }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Pick<Task, 'title' | 'repeatWeekly' | 'time'>> }
  | { type: 'ENABLE_REPEAT_WEEKLY'; id: string }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'MOVE_TASK'; id: string; toDate: string; toIndex?: number }
  | { type: 'REORDER_TASK'; id: string; toIndex: number }
  | { type: 'PASTE_TASKS'; snapshots: TaskSnapshot[]; toDate: string }
  | { type: 'ADD_SUBTASK'; taskId: string; text: string }
  | { type: 'UPDATE_SUBTASK'; taskId: string; subId: string; patch: Partial<Pick<Subtask, 'text'>> }
  | { type: 'TOGGLE_SUBTASK'; taskId: string; subId: string }
  | { type: 'DELETE_SUBTASK'; taskId: string; subId: string }
  | { type: 'REORDER_SUBTASK'; taskId: string; subId: string; toIndex: number }
  | { type: 'SET_HOME_ADDRESS'; address: string }
  | { type: 'ADD_WORK_ADDRESS'; address: Omit<WorkAddress, 'id'> }
  | { type: 'UPDATE_WORK_ADDRESS'; id: string; patch: Partial<Omit<WorkAddress, 'id'>> }
  | { type: 'DELETE_WORK_ADDRESS'; id: string }
  | { type: 'SET_EXCLUSION'; date: string; reason: ExclusionReason; note?: string }
  | { type: 'REMOVE_EXCLUSION'; date: string }
  | { type: 'ADD_INCLUSION'; date: string }
  | { type: 'REMOVE_INCLUSION'; date: string }
  | { type: 'IMPORT_REPLACE'; data: AppData }
  | { type: 'CLEAR_ALL' };

export function emptyState(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeWorkspace: 'private',
    lastModified: Date.now(),
    tasks: [],
    driving: { workAddresses: [], exclusions: [], inclusions: [] },
  };
}

/**
 * Make absolutely sure state.driving is well-formed. Cheap insurance against
 * stale localStorage payloads or remote sync data from an older schema where
 * fields might be missing.
 */
function ensureDriving(state: AppData): AppData {
  const d = state.driving;
  if (
    d &&
    Array.isArray(d.workAddresses) &&
    Array.isArray(d.exclusions) &&
    Array.isArray(d.inclusions)
  ) {
    return state;
  }
  return {
    ...state,
    driving: {
      workAddresses: Array.isArray(d?.workAddresses) ? d!.workAddresses : [],
      exclusions: Array.isArray(d?.exclusions) ? d!.exclusions : [],
      inclusions: Array.isArray(d?.inclusions) ? d!.inclusions : [],
      ...(d?.homeAddress ? { homeAddress: d.homeAddress } : {}),
    },
  };
}

const now = () => new Date().toISOString();
const stamp = () => Date.now();

/** Wrap a state update so lastModified is bumped automatically. */
function touched<T extends AppData>(state: T): T {
  return { ...state, lastModified: stamp() };
}

/** Tasks on a date — limited to the active workspace so ordering and inserts
 *  don't collide across workspaces. */
function tasksOnDay(state: AppData, date: string): Task[] {
  return state.tasks
    .filter((t) => t.date === date && t.workspace === state.activeWorkspace)
    .sort((a, b) => a.order - b.order);
}

function nextOrder(state: AppData, date: string): number {
  const list = tasksOnDay(state, date);
  if (list.length === 0) return 1000;
  return list[list.length - 1]!.order + 1000;
}

/**
 * A day's tasks in the exact order they are rendered: unfinished first (by
 * `order`), finished at the bottom. `order` is the single source of truth for
 * the manual ordering — `useTasksByDate` sorts identically, so an index taken
 * from the UI can be used here directly.
 */
function dayList(tasks: Task[], date: string, workspace: WorkspaceId): Task[] {
  return tasks
    .filter((t) => t.date === date && t.workspace === workspace)
    .sort((a, b) => (a.done === b.done ? a.order - b.order : a.done ? 1 : -1));
}

/** Renumber a day so its tasks' `order` values match `sequence` exactly. */
function applySequence(tasks: Task[], sequence: Task[]): Task[] {
  const orderById = new Map<string, number>();
  sequence.forEach((t, i) => orderById.set(t.id, (i + 1) * 1000));
  return tasks.map((t) => {
    const order = orderById.get(t.id);
    return order === undefined || order === t.order ? t : { ...t, order };
  });
}

/**
 * Put `id` at `toIndex` within its (already up-to-date) day and renumber that
 * day. We renumber on every move instead of splitting order gaps because the
 * rendered order also pushes done tasks to the bottom — renumbering keeps the
 * stored `order` and what the user sees from drifting apart.
 */
function placeInDay(
  tasks: Task[],
  id: string,
  date: string,
  workspace: WorkspaceId,
  toIndex: number
): Task[] {
  const moving = tasks.find((t) => t.id === id);
  if (!moving) return tasks;
  const list = dayList(tasks, date, workspace).filter((t) => t.id !== id);
  const idx = Math.max(0, Math.min(toIndex, list.length));
  list.splice(idx, 0, moving);
  return applySequence(tasks, list);
}

/**
 * Where a task with the given time belongs in `list` (which must not contain
 * the task itself). Timed tasks stay in chronological order relative to each
 * other and sit above untimed ones — but only until the user drags them
 * somewhere else, since nothing re-applies this afterwards.
 */
function indexForTime(list: Task[], time: string): number {
  const idx = list.findIndex((t) => !t.done && (!t.time || t.time > time));
  return idx < 0 ? list.length : idx;
}

function orderForSubtaskInsert(
  list: Subtask[],
  toIndex: number,
): { order: number; renumber: boolean } {
  const len = list.length;
  const idx = Math.max(0, Math.min(toIndex, len));
  if (len === 0) return { order: 1000, renumber: false };
  if (idx === 0) return { order: list[0]!.order - 1000, renumber: false };
  if (idx === len) return { order: list[len - 1]!.order + 1000, renumber: false };
  const prev = list[idx - 1]!.order;
  const next = list[idx]!.order;
  const between = (prev + next) / 2;
  if (next - prev < 0.0001) return { order: between, renumber: true };
  return { order: between, renumber: false };
}

/** Actions that change persisted task data and should bump lastModified. */
const MUTATING_ACTIONS = new Set<Action['type']>([
  'ADD_TASK',
  'UPDATE_TASK',
  'ENABLE_REPEAT_WEEKLY',
  'TOGGLE_TASK',
  'DELETE_TASK',
  'MOVE_TASK',
  'REORDER_TASK',
  'PASTE_TASKS',
  'ADD_SUBTASK',
  'UPDATE_SUBTASK',
  'TOGGLE_SUBTASK',
  'DELETE_SUBTASK',
  'REORDER_SUBTASK',
  'SET_HOME_ADDRESS',
  'ADD_WORK_ADDRESS',
  'UPDATE_WORK_ADDRESS',
  'DELETE_WORK_ADDRESS',
  'SET_EXCLUSION',
  'REMOVE_EXCLUSION',
  'ADD_INCLUSION',
  'REMOVE_INCLUSION',
]);

/** Add 7 days to a YYYY-MM-DD string. Uses local time. */
function addWeek(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function reducer(state: AppData, action: Action): AppData {
  const safe = ensureDriving(state);
  const next = dataReducer(safe, action);
  if (next === safe) return safe === state ? state : safe;
  if (MUTATING_ACTIONS.has(action.type)) {
    return touched(next);
  }
  return next;
}

function dataReducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'HYDRATE':
      return action.data;

    case 'IMPORT_REPLACE':
      return action.data;

    case 'CLEAR_ALL':
      return emptyState();

    case 'SET_WORKSPACE':
      if (state.activeWorkspace === action.workspace) return state;
      return { ...state, activeWorkspace: action.workspace };

    case 'ADD_TASK': {
      const raw = action.title.trim();
      if (!raw) return state;
      // Auto-extract trailing time from titles like "Vaske tøj 11:00" or
      // "Møde kl 9". Only meaningful for scheduled tasks.
      const isUnscheduled = action.date === 'unscheduled';
      const { title, time } = isUnscheduled
        ? { title: raw, time: undefined as string | undefined }
        : parseTitleTime(raw);
      const task: Task = {
        id: newId(),
        title,
        date: action.date,
        unscheduled: isUnscheduled,
        done: false,
        order: nextOrder(state, action.date),
        repeatWeekly: false,
        ...(time ? { time } : {}),
        createdAt: now(),
        updatedAt: now(),
        workspace: state.activeWorkspace,
        subtasks: [],
      };
      const tasks = [...state.tasks, task];
      if (!time) return { ...state, tasks };
      // A task created with a time slots into the day chronologically.
      const others = dayList(tasks, action.date, state.activeWorkspace).filter(
        (t) => t.id !== task.id
      );
      return {
        ...state,
        tasks: placeInDay(
          tasks,
          task.id,
          action.date,
          state.activeWorkspace,
          indexForTime(others, time)
        ),
      };
    }

    case 'UPDATE_TASK': {
      const trimmed =
        action.patch.title !== undefined ? action.patch.title.trim() : undefined;
      const target = state.tasks.find((t) => t.id === action.id);
      if (!target) return state;
      const tasks = state.tasks.map((t) =>
        t.id === action.id
          ? {
              ...t,
              ...action.patch,
              ...(trimmed !== undefined ? { title: trimmed || t.title } : null),
              updatedAt: now(),
            }
          : t
      );
      // Setting (or changing) a time re-slots the task chronologically, the
      // same way a newly created "Møde 9:00" does. Clearing it leaves the task
      // where it is, and any manual drag afterwards wins.
      const nextTime = action.patch.time;
      if (!nextTime || nextTime === target.time || target.unscheduled) {
        return { ...state, tasks };
      }
      const others = dayList(tasks, target.date, target.workspace).filter(
        (t) => t.id !== target.id
      );
      return {
        ...state,
        tasks: placeInDay(
          tasks,
          target.id,
          target.date,
          target.workspace,
          indexForTime(others, nextTime)
        ),
      };
    }

    case 'ENABLE_REPEAT_WEEKLY': {
      const source = state.tasks.find((t) => t.id === action.id);
      if (!source || source.unscheduled || source.date === 'unscheduled') return state;
      const updated = state.tasks.map((t) =>
        t.id === action.id ? { ...t, repeatWeekly: true, updatedAt: now() } : t
      );
      const copies: Task[] = [];
      for (let week = 1; week <= 4; week++) {
        const nextDate = new Date(`${source.date}T00:00:00`);
        nextDate.setDate(nextDate.getDate() + week * 7);
        const y = nextDate.getFullYear();
        const m = String(nextDate.getMonth() + 1).padStart(2, '0');
        const d = String(nextDate.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;
        const alreadyExists = updated.some(
          (t) => t.repeatWeekly && t.date === dateKey && t.title === source.title && t.workspace === source.workspace
        );
        if (!alreadyExists) {
          copies.push({
            ...source,
            id: newId(),
            date: dateKey,
            repeatWeekly: true,
            done: false,
            order: nextOrder({ ...state, tasks: [...updated, ...copies] }, dateKey),
            createdAt: now(),
            updatedAt: now(),
          });
        }
      }
      return { ...state, tasks: [...updated, ...copies] };
    }

    case 'TOGGLE_TASK': {
      const target = state.tasks.find((t) => t.id === action.id);
      if (!target) return state;
      const nextDone = !target.done;
      const tasksWithToggle = state.tasks.map((t) =>
        t.id === target.id ? { ...t, done: nextDone, updatedAt: now() } : t
      );
      // Weekly task being marked done: keep it in place (the user wants the
      // completed task to remain visible in this week's card), but ensure
      // the chain continues by auto-creating next week's copy if it doesn't
      // already exist.
      if (nextDone && target.repeatWeekly && !target.unscheduled) {
        const nextKey = addWeek(target.date);
        const exists = tasksWithToggle.some(
          (t) =>
            t.repeatWeekly &&
            t.date === nextKey &&
            t.title === target.title &&
            t.workspace === target.workspace
        );
        if (!exists) {
          const intermediate = { ...state, tasks: tasksWithToggle };
          const copy: Task = {
            ...target,
            id: newId(),
            date: nextKey,
            unscheduled: false,
            done: false,
            order: nextOrder(intermediate, nextKey),
            createdAt: now(),
            updatedAt: now(),
            subtasks: target.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
          };
          return { ...state, tasks: [...tasksWithToggle, copy] };
        }
      }
      return { ...state, tasks: tasksWithToggle };
    }

    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case 'MOVE_TASK': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      const moved = state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              date: action.toDate,
              unscheduled: action.toDate === 'unscheduled',
              updatedAt: now(),
            }
          : t
      );
      const targetLength = dayList(moved, action.toDate, task.workspace).length;
      return {
        ...state,
        tasks: placeInDay(
          moved,
          task.id,
          action.toDate,
          task.workspace,
          action.toIndex ?? targetLength
        ),
      };
    }

    case 'REORDER_TASK': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      return {
        ...state,
        tasks: placeInDay(
          state.tasks,
          task.id,
          task.date,
          task.workspace,
          action.toIndex
        ),
      };
    }

    case 'PASTE_TASKS': {
      if (action.snapshots.length === 0) return state;
      const isUnscheduled = action.toDate === 'unscheduled';
      let order = nextOrder(state, action.toDate);
      // Pasted cards are a fresh to-do list: nothing is ticked off, and the
      // weekly chain stays with the original so copies don't start spawning
      // their own future duplicates.
      const copies: Task[] = action.snapshots.map((snap) => {
        const copy: Task = {
          id: newId(),
          title: snap.title,
          date: action.toDate,
          unscheduled: isUnscheduled,
          done: false,
          order,
          repeatWeekly: false,
          ...(snap.time && !isUnscheduled ? { time: snap.time } : {}),
          createdAt: now(),
          updatedAt: now(),
          workspace: state.activeWorkspace,
          subtasks: snap.subtasks.map((text, i) => ({
            id: newId(),
            text,
            done: false,
            order: (i + 1) * 1000,
          })),
        };
        order += 1000;
        return copy;
      });
      return { ...state, tasks: [...state.tasks, ...copies] };
    }

    case 'ADD_SUBTASK': {
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          const order =
            t.subtasks.length === 0
              ? 1000
              : t.subtasks[t.subtasks.length - 1]!.order + 1000;
          const sub: Subtask = { id: newId(), text, done: false, order };
          return { ...t, subtasks: [...t.subtasks, sub], updatedAt: now() };
        }),
      };
    }

    case 'UPDATE_SUBTASK': {
      const trimmed =
        action.patch.text !== undefined ? action.patch.text.trim() : undefined;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          return {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === action.subId
                ? {
                    ...s,
                    ...action.patch,
                    ...(trimmed !== undefined
                      ? { text: trimmed || s.text }
                      : null),
                  }
                : s
            ),
            updatedAt: now(),
          };
        }),
      };
    }

    case 'TOGGLE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          return {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === action.subId ? { ...s, done: !s.done } : s
            ),
            updatedAt: now(),
          };
        }),
      };

    case 'DELETE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          return {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== action.subId),
            updatedAt: now(),
          };
        }),
      };

    case 'REORDER_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          const moving = t.subtasks.find((s) => s.id === action.subId);
          if (!moving) return t;
          const list = t.subtasks
            .filter((s) => s.id !== action.subId)
            .sort((a, b) => a.order - b.order);
          const { order } = orderForSubtaskInsert(list, action.toIndex);
          return {
            ...t,
            subtasks: t.subtasks.map((s) => (s.id === action.subId ? { ...s, order } : s)),
            updatedAt: now(),
          };
        }),
      };

    case 'SET_HOME_ADDRESS': {
      const trimmed = action.address.trim();
      const next = { ...state.driving };
      if (trimmed) next.homeAddress = trimmed;
      else delete next.homeAddress;
      return { ...state, driving: next };
    }

    case 'ADD_WORK_ADDRESS': {
      const km = Number.isFinite(action.address.oneWayKm)
        ? Math.max(0, action.address.oneWayKm)
        : 0;
      const wa: WorkAddress = {
        id: newId(),
        label: action.address.label.trim(),
        oneWayKm: km,
        from: action.address.from,
      };
      return {
        ...state,
        driving: { ...state.driving, workAddresses: [...state.driving.workAddresses, wa] },
      };
    }

    case 'UPDATE_WORK_ADDRESS': {
      return {
        ...state,
        driving: {
          ...state.driving,
          workAddresses: state.driving.workAddresses.map((w) => {
            if (w.id !== action.id) return w;
            const next: WorkAddress = { ...w };
            if (typeof action.patch.label === 'string') next.label = action.patch.label.trim();
            if (
              typeof action.patch.oneWayKm === 'number' &&
              Number.isFinite(action.patch.oneWayKm)
            ) {
              next.oneWayKm = Math.max(0, action.patch.oneWayKm);
            }
            if (typeof action.patch.from === 'string') next.from = action.patch.from;
            return next;
          }),
        },
      };
    }

    case 'DELETE_WORK_ADDRESS':
      return {
        ...state,
        driving: {
          ...state.driving,
          workAddresses: state.driving.workAddresses.filter((w) => w.id !== action.id),
        },
      };

    case 'SET_EXCLUSION': {
      const existing = state.driving.exclusions.find((e) => e.date === action.date);
      const trimmedNote = action.note?.trim();
      const entry: DrivingExclusion = {
        date: action.date,
        reason: action.reason,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      };
      const next = existing
        ? state.driving.exclusions.map((e) => (e.date === action.date ? entry : e))
        : [...state.driving.exclusions, entry];
      return { ...state, driving: { ...state.driving, exclusions: next } };
    }

    case 'REMOVE_EXCLUSION':
      return {
        ...state,
        driving: {
          ...state.driving,
          exclusions: state.driving.exclusions.filter((e) => e.date !== action.date),
        },
      };

    case 'ADD_INCLUSION': {
      if (state.driving.inclusions.includes(action.date)) return state;
      return {
        ...state,
        driving: {
          ...state.driving,
          inclusions: [...state.driving.inclusions, action.date],
        },
      };
    }

    case 'REMOVE_INCLUSION':
      return {
        ...state,
        driving: {
          ...state.driving,
          inclusions: state.driving.inclusions.filter((d) => d !== action.date),
        },
      };

    default:
      return state;
  }
}
