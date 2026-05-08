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

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateKey}`,
    data: { dateKey },
    disabled: !enableDnD,
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        'flex flex-col rounded-xl border bg-slate-900/40 transition',
        today ? 'border-sky-600/60' : 'border-slate-800',
        isOver ? 'ring-2 ring-sky-400/70 bg-sky-500/5' : '',
      ].join(' ')}
      aria-labelledby={`day-${dateKey}`}
    >
      <header
        className={[
          'flex items-baseline justify-between border-b',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
          today ? 'border-sky-700/40 bg-sky-500/10' : 'border-slate-800',
        ].join(' ')}
      >
        <h2 id={`day-${dateKey}`} className="font-semibold text-sm tracking-wide">
          <span className={today ? 'text-sky-300' : 'text-slate-100'}>
            {dayLabel(dayIndex)}
          </span>
        </h2>
        <span className="text-xs text-slate-400">{formatDayDate(date)}</span>
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
