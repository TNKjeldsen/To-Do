import type { Task } from '../types';
import { useAppState } from '../state/AppStateContext';
import { Sheet } from './Sheet';
import { AddTaskInput } from './AddTaskInput';
import { Icon } from './Icon';

interface UnscheduledSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
}

export function UnscheduledSheet({ open, onClose, onOpenTask }: UnscheduledSheetProps) {
  const { state } = useAppState();
  const ws = state.activeWorkspace;

  const tasks = state.tasks
    .filter((t) => t.workspace === ws && (t.unscheduled || t.date === 'unscheduled'))
    .sort((a, b) => a.order - b.order);

  const doneTasks = tasks.filter((t) => t.done);
  const pendingTasks = tasks.filter((t) => !t.done);

  return (
    <Sheet open={open} onClose={onClose} title="Løbende opgaver">
      <div className="px-4 py-4 flex flex-col gap-4">
        <p className="text-xs text-slate-400">
          Opgaver uden en fast dato — tilføj dem til en dag via "Flyt til…".
        </p>

        {pendingTasks.length === 0 && doneTasks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Ingen løbende opgaver endnu</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {[...pendingTasks, ...doneTasks].map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenTask(task);
                    onClose();
                  }}
                  className={[
                    'w-full text-left px-3 py-2.5 rounded-lg border bg-slate-800/60 border-slate-700 hover:bg-slate-700/70 active:bg-slate-700 transition flex items-center gap-2',
                    task.done ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                      task.done ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-500',
                    ].join(' ')}
                  >
                    {task.done ? <Icon name="check" size={10} /> : null}
                  </span>
                  <span className={['text-sm', task.done ? 'line-through text-slate-400' : 'text-slate-100'].join(' ')}>
                    {task.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-800 pt-3">
          <AddTaskInput date="unscheduled" placeholder="Tilføj løbende opgave…" />
        </div>
      </div>
    </Sheet>
  );
}
