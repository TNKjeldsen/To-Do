import { newId } from '../lib/id';
import {
  SCHEMA_VERSION,
  type AppData,
  type Subtask,
  type Task,
  type WorkspaceId,
} from '../types';

export type Action =
  | { type: 'HYDRATE'; data: AppData }
  | { type: 'SET_WORKSPACE'; workspace: WorkspaceId }
  | { type: 'ADD_TASK'; date: string; title: string }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Pick<Task, 'title'>> }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'MOVE_TASK'; id: string; toDate: string; toIndex?: number }
  | { type: 'REORDER_TASK'; id: string; toIndex: number }
  | { type: 'ADD_SUBTASK'; taskId: string; text: string }
  | { type: 'UPDATE_SUBTASK'; taskId: string; subId: string; patch: Partial<Pick<Subtask, 'text'>> }
  | { type: 'TOGGLE_SUBTASK'; taskId: string; subId: string }
  | { type: 'DELETE_SUBTASK'; taskId: string; subId: string }
  | { type: 'IMPORT_REPLACE'; data: AppData }
  | { type: 'CLEAR_ALL' };

export function emptyState(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeWorkspace: 'private',
    lastModified: Date.now(),
    tasks: [],
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
  'TOGGLE_TASK',
  'DELETE_TASK',
  'MOVE_TASK',
  'REORDER_TASK',
  'ADD_SUBTASK',
  'UPDATE_SUBTASK',
  'TOGGLE_SUBTASK',
  'DELETE_SUBTASK',
]);

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
      const title = action.title.trim();
      if (!title) return state;
      const task: Task = {
        id: newId(),
        title,
        date: action.date,
        done: false,
        order: nextOrder(state, action.date),
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

    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, done: !t.done, updatedAt: now() }
            : t
        ),
      };

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
          ? { ...t, date: action.toDate, order, updatedAt: now() }
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

    default:
      return state;
  }
}
