import { newId } from '../lib/id';
import { parseTitleTime } from '../lib/parseTitle';
import {
  SCHEMA_VERSION,
  type AppData,
  type Subtask,
  type Task,
  type Trip,
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
  | { type: 'ADD_SUBTASK'; taskId: string; text: string }
  | { type: 'UPDATE_SUBTASK'; taskId: string; subId: string; patch: Partial<Pick<Subtask, 'text'>> }
  | { type: 'TOGGLE_SUBTASK'; taskId: string; subId: string }
  | { type: 'DELETE_SUBTASK'; taskId: string; subId: string }
  | { type: 'REORDER_SUBTASK'; taskId: string; subId: string; toIndex: number }
  | { type: 'ADD_TRIP'; trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'workspace'> }
  | { type: 'UPDATE_TRIP'; id: string; patch: Partial<Omit<Trip, 'id' | 'workspace' | 'createdAt' | 'updatedAt'>> }
  | { type: 'DELETE_TRIP'; id: string }
  | { type: 'IMPORT_REPLACE'; data: AppData }
  | { type: 'CLEAR_ALL' };

export function emptyState(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeWorkspace: 'private',
    lastModified: Date.now(),
    tasks: [],
    trips: [],
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
 * Compute a new order value to insert at `toIndex` within the given day's
 * task list (excluding the moved task itself). Uses gaps so we rarely have
 * to renumber. If gaps collapse, we renumber the day.
 */
function orderForInsert(
  list: Task[],
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

function renumberDay(
  tasks: Task[],
  date: string,
  workspace: WorkspaceId
): Task[] {
  let counter = 1000;
  const sorted = tasks
    .filter((t) => t.date === date && t.workspace === workspace)
    .sort((a, b) => a.order - b.order);
  const orderById = new Map<string, number>();
  for (const t of sorted) {
    orderById.set(t.id, counter);
    counter += 1000;
  }
  return tasks.map((t) =>
    orderById.has(t.id) ? { ...t, order: orderById.get(t.id)! } : t
  );
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
  'ADD_SUBTASK',
  'UPDATE_SUBTASK',
  'TOGGLE_SUBTASK',
  'DELETE_SUBTASK',
  'REORDER_SUBTASK',
  'ADD_TRIP',
  'UPDATE_TRIP',
  'DELETE_TRIP',
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
  const next = dataReducer(state, action);
  if (next === state) return state;
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
      return { ...state, tasks: [...state.tasks, task] };
    }

    case 'UPDATE_TASK': {
      const trimmed =
        action.patch.title !== undefined ? action.patch.title.trim() : undefined;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                ...action.patch,
                ...(trimmed !== undefined ? { title: trimmed || t.title } : null),
                updatedAt: now(),
              }
            : t
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
      const targetList = state.tasks
        .filter(
          (t) =>
            t.date === action.toDate &&
            t.workspace === task.workspace &&
            t.id !== task.id
        )
        .sort((a, b) => a.order - b.order);
      const { order, renumber } = orderForInsert(
        targetList,
        action.toIndex ?? targetList.length
      );
      let next = state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              date: action.toDate,
              unscheduled: action.toDate === 'unscheduled',
              order,
              updatedAt: now(),
            }
          : t
      );
      if (renumber) next = renumberDay(next, action.toDate, task.workspace);
      return { ...state, tasks: next };
    }

    case 'REORDER_TASK': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      const list = state.tasks
        .filter(
          (t) =>
            t.date === task.date &&
            t.workspace === task.workspace &&
            t.id !== task.id
        )
        .sort((a, b) => a.order - b.order);
      const { order, renumber } = orderForInsert(list, action.toIndex);
      let next = state.tasks.map((t) =>
        t.id === task.id ? { ...t, order, updatedAt: now() } : t
      );
      if (renumber) next = renumberDay(next, task.date, task.workspace);
      return { ...state, tasks: next };
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

    case 'ADD_TRIP': {
      const km = Number.isFinite(action.trip.km) ? Math.max(0, action.trip.km) : 0;
      const trip: Trip = {
        id: newId(),
        date: action.trip.date,
        from: action.trip.from.trim(),
        to: action.trip.to.trim(),
        km,
        purpose: action.trip.purpose.trim(),
        ...(action.trip.note && action.trip.note.trim()
          ? { note: action.trip.note.trim() }
          : {}),
        workspace: state.activeWorkspace,
        createdAt: now(),
        updatedAt: now(),
      };
      return { ...state, trips: [...state.trips, trip] };
    }

    case 'UPDATE_TRIP': {
      return {
        ...state,
        trips: state.trips.map((t) => {
          if (t.id !== action.id) return t;
          const patch = action.patch;
          const next: Trip = { ...t, updatedAt: now() };
          if (typeof patch.date === 'string') next.date = patch.date;
          if (typeof patch.from === 'string') next.from = patch.from.trim();
          if (typeof patch.to === 'string') next.to = patch.to.trim();
          if (typeof patch.km === 'number' && Number.isFinite(patch.km)) {
            next.km = Math.max(0, patch.km);
          }
          if (typeof patch.purpose === 'string') next.purpose = patch.purpose.trim();
          if (patch.note !== undefined) {
            const trimmed = patch.note?.trim();
            if (trimmed) next.note = trimmed;
            else delete next.note;
          }
          return next;
        }),
      };
    }

    case 'DELETE_TRIP':
      return { ...state, trips: state.trips.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}
