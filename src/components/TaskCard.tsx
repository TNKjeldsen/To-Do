import { useState } from 'react';
import type { Task } from '../types';
import { useDispatch } from '../state/AppStateContext';
import { Icon } from './Icon';

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onMove: (task: Task) => void;
  /** Optional drag listeners injected by @dnd-kit. */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  onOpen,
  onMove,
  dragHandleProps,
  isDragging = false,
}: TaskCardProps) {
  const dispatch = useDispatch();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.done).length;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_TASK', id: task.id });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 2500);
      return;
    }
    dispatch({ type: 'DELETE_TASK', id: task.id });
  };

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMove(task);
  };

  return (
    <div
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={[
        'group relative rounded-lg border bg-slate-800/70 hover:bg-slate-800 active:bg-slate-700/80 transition cursor-pointer select-none',
        isDragging ? 'border-sky-500/60 shadow-xl' : 'border-slate-700/70',
        task.done ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Top row: checkbox + title (title gets full remaining width) */}
      <div className="flex items-start gap-2 px-2.5 pt-2 pb-1.5">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={task.done ? 'Marker som ikke færdig' : 'Marker som færdig'}
          className={[
            'shrink-0 mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition',
            task.done
              ? 'bg-sky-500 border-sky-500 text-white'
              : 'border-slate-500 hover:border-slate-300',
          ].join(' ')}
        >
          {task.done ? <Icon name="check" size={14} /> : null}
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={[
              'text-sm leading-snug break-words hyphens-auto',
              task.done ? 'line-through text-slate-400' : 'text-slate-100',
            ].join(' ')}
            lang="da"
          >
            {task.title}
          </div>
        </div>
      </div>

      {/* Bottom row: progress (left) + actions (right). On desktop the action
          buttons fade in on hover; on mobile they remain visible because there
          is no hover. The drag handle only appears on md+ on hover. */}
      <div className="flex items-center justify-between gap-2 px-2 pb-1.5 min-h-[1.5rem]">
        <div className="text-[11px] text-slate-400 pl-1 truncate">
          {total > 0 ? `${done}/${total} punkter` : ''}
        </div>

        <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          {dragHandleProps ? (
            <button
              type="button"
              aria-label="Træk for at flytte"
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              className="hidden md:flex p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700 cursor-grab active:cursor-grabbing"
            >
              <Icon name="grip" size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleMove}
            aria-label="Flyt opgave"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
          >
            <Icon name="move" size={14} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={confirmDelete ? 'Bekræft sletning' : 'Slet opgave'}
            title={confirmDelete ? 'Klik igen for at slette' : 'Slet'}
            className={[
              'p-1.5 rounded-md transition',
              confirmDelete
                ? 'text-red-400 bg-red-500/10'
                : 'text-slate-400 hover:text-red-300 hover:bg-slate-700',
            ].join(' ')}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
