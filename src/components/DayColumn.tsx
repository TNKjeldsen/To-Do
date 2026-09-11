import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../types';
import {
  dayLabel,
  formatDayDate,
  isToday,
  parseDateKey,
} from '../lib/date';
import { AddTaskInput } from './AddTaskInput';
import { DraggableTaskCard } from './DraggableTaskCard';
import { useTasksByDate } from '../state/AppStateContext';
import { useSelection } from '../state/SelectionContext';

interface DayColumnProps {
  /** YYYY-MM-DD */
  dateKey: string;
  /** 0 = Monday */
  dayIndex: number;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task) => void;
  enableDnD: boolean;
  compact?: boolean;
}

export function DayColumn({
  dateKey,
  dayIndex,
  onOpenTask,
  onMoveTask,
  enableDnD,
  compact = false,
}: DayColumnProps) {
  const date = parseDateKey(dateKey);
  const tasks = useTasksByDate(dateKey);
  const today = isToday(date);
  const { selectionMode, selectedIds, setMany, clipboard, activeDate } = useSelection();
  // Only worth pointing out while there is actually something to paste.
  const isPasteTarget = activeDate === dateKey && clipboard.length > 0;
  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateKey}`,
    data: { dateKey },
    disabled: !enableDnD,
  });

  return (
    <section
      ref={setNodeRef}
      data-day-column={dateKey}
      className={[
        'flex flex-col rounded-xl border bg-slate-900/40 transition',
        today ? 'border-sky-600/60' : 'border-slate-800',
        isOver
          ? 'ring-2 ring-sky-400/70 bg-sky-500/5'
          : isPasteTarget
            ? 'ring-1 ring-sky-500/50'
            : '',
      ].join(' ')}
      aria-labelledby={`day-${dateKey}`}
    >
      <header
        className={[
          'flex items-baseline justify-between gap-1.5 border-b',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
          today ? 'border-sky-700/40 bg-sky-500/10' : 'border-slate-800',
        ].join(' ')}
      >
        <h2 id={`day-${dateKey}`} className="font-semibold text-sm tracking-wide truncate">
          <span className={today ? 'text-sky-300' : 'text-slate-100'}>
            {dayLabel(dayIndex)}
          </span>
        </h2>
        {/* While picking cards the date makes way for a select-all toggle —
            the columns are too narrow on a 7-day desktop grid for both. */}
        {selectionMode && tasks.length > 0 ? (
          <button
            type="button"
            onClick={() => setMany(tasks.map((t) => t.id), !allSelected)}
            className="shrink-0 text-[11px] px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 active:bg-slate-700 transition"
          >
            {allSelected ? 'Ingen' : 'Alle'}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
            {formatDayDate(date)}
          </span>
        )}
      </header>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={['flex flex-col gap-1.5 min-h-[2.5rem]', compact ? 'p-1.5' : 'p-2'].join(' ')}>
          {tasks.map((task) => (
            <li key={task.id}>
              <DraggableTaskCard
                task={task}
                onOpen={onOpenTask}
                onMove={onMoveTask}
                enableDrag={enableDnD}
              />
            </li>
          ))}
        </ul>
      </SortableContext>

      <div className={compact ? 'px-1.5 pb-1.5' : 'px-2 pb-2'}>
        <AddTaskInput date={dateKey} />
      </div>
    </section>
  );
}
