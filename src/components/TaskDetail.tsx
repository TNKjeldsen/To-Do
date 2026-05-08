import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { useAppState, useDispatch } from '../state/AppStateContext';
import { dayLabel, parseDateKey } from '../lib/date';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { Sheet } from './Sheet';
import { SubtaskList } from './SubtaskList';
import { Icon } from './Icon';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onMove: (task: Task) => void;
}

export function TaskDetail({ taskId, onClose, onMove }: TaskDetailProps) {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const task = taskId ? state.tasks.find((t) => t.id === taskId) ?? null : null;
  const isUnscheduled = Boolean(task?.unscheduled || task?.date === 'unscheduled');

  const [titleDraft, setTitleDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) setTitleDraft(task.title);
  }, [task?.id, task?.title]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  // If task disappears (deleted) close.
  useEffect(() => {
    if (taskId && !task) onClose();
  }, [taskId, task, onClose]);

  const open = task !== null;

  const commitTitle = () => {
    if (!task) return;
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (!next || next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    dispatch({ type: 'UPDATE_TASK', id: task.id, patch: { title: next } });
  };

  const handleDelete = () => {
    if (!task) return;
    if (
      window.confirm(
        `Slet "${task.title}"? Dette kan ikke fortrydes.`
      )
    ) {
      dispatch({ type: 'DELETE_TASK', id: task.id });
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        task ? (
          <span className="text-slate-300 font-medium">
            {isUnscheduled ? (
              <span className="text-slate-400 font-normal">Uden fast dag</span>
            ) : (
              <>
                {dayLabel(((parseDateKey(task.date).getDay() + 6) % 7))}
                {' · '}
                <span className="text-slate-400 font-normal">
                  {format(parseDateKey(task.date), 'd. MMMM yyyy', { locale: da })}
                </span>
              </>
            )}
          </span>
        ) : (
          ''
        )
      }
      large
    >
      {task ? (
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Title section */}
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_TASK', id: task.id })}
              aria-label={task.done ? 'Marker som ikke færdig' : 'Marker som færdig'}
              className={[
                'shrink-0 mt-1 w-6 h-6 rounded-md border flex items-center justify-center transition',
                task.done
                  ? 'bg-sky-500 border-sky-500 text-white'
                  : 'border-slate-500 hover:border-slate-300',
              ].join(' ')}
            >
              {task.done ? <Icon name="check" size={16} /> : null}
            </button>

            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  } else if (e.key === 'Escape') {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
                className="flex-1 bg-slate-800 border border-sky-500/60 rounded-md px-2 py-1.5 text-lg font-semibold outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(task.title);
                  setEditingTitle(true);
                }}
                className={[
                  'flex-1 text-left text-lg font-semibold break-words py-1 px-1 rounded-md hover:bg-slate-800/50',
                  task.done ? 'line-through text-slate-400' : 'text-slate-100',
                ].join(' ')}
              >
                {task.title}
              </button>
            )}
          </div>

          {/* Subtasks */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 px-1">
              Underpunkter
            </h3>
            <SubtaskList taskId={task.id} subtasks={task.subtasks} />
          </section>

          {/* Footer actions */}
          <div className="border-t border-slate-800 pt-3 mt-2 flex flex-wrap gap-2">
            {!isUnscheduled ? (
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_TASK',
                    id: task.id,
                    patch: { repeatWeekly: !task.repeatWeekly },
                  })
                }
                className={[
                  'px-3 py-2 rounded-md text-sm',
                  task.repeatWeekly
                    ? 'bg-sky-500/15 text-sky-200 border border-sky-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200',
                ].join(' ')}
              >
                {task.repeatWeekly ? 'Gentager ugentligt' : 'Gør ugentlig'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onMove(task)}
              className="px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-2"
            >
              <Icon name="move" size={16} />
              Flyt til…
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-md bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm flex items-center gap-2"
            >
              <Icon name="trash" size={16} />
              Slet opgave
            </button>
            <div className="flex-1" />
            <div className="text-[11px] text-slate-500 self-center">
              Oprettet {format(new Date(task.createdAt), 'd. MMM yyyy HH:mm', { locale: da })}
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
