import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { isToday, toDateKey, weekDays, dayLabel } from '../lib/date';
import type { Task } from '../types';
import { DayColumn } from './DayColumn';
import { TaskCard } from './TaskCard';
import { useAppState, useDispatch } from '../state/AppStateContext';

interface WeekViewProps {
  reference: Date;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task) => void;
}

export function WeekView({ reference, onOpenTask, onMoveTask }: WeekViewProps) {
  const days = useMemo(() => weekDays(reference), [reference]);
  const dayKeys = useMemo(() => days.map(toDateKey), [days]);
  const { state } = useAppState();
  const dispatch = useDispatch();

  const todayIndex = days.findIndex((d) => isToday(d));
  const [activeIdx, setActiveIdx] = useState<number>(todayIndex >= 0 ? todayIndex : 0);
  const safeActive = Math.min(activeIdx, 6);

  const activeWorkspace = state.activeWorkspace;
  const tasksPerDay = useMemo(() => {
    const counts = new Array(7).fill(0) as number[];
    for (const t of state.tasks) {
      if (t.workspace !== activeWorkspace) continue;
      const idx = dayKeys.indexOf(t.date);
      if (idx >= 0 && !t.done) counts[idx]! += 1;
    }
    return counts;
  }, [state.tasks, dayKeys, activeWorkspace]);

  // Mouse sensor only — touch users get the explicit Move button instead.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const draggingTask = useMemo(
    () => state.tasks.find((t) => t.id === draggingTaskId) ?? null,
    [state.tasks, draggingTaskId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingTaskId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const dropData = over.data.current as { dateKey?: string } | undefined;
    const toDate = dropData?.dateKey;
    if (!toDate) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task || task.date === toDate) return;
    dispatch({ type: 'MOVE_TASK', id: taskId, toDate });
  };

  return (
    <div className="mx-auto px-3 pt-3 pb-24 max-w-[1700px]">
      {/* Mobile day tabs */}
      <div className="md:hidden mb-3 -mx-3 px-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-1.5">
          {days.map((d, i) => {
            const active = i === safeActive;
            const isT = isToday(d);
            const count = tasksPerDay[i] ?? 0;
            return (
              <button
                type="button"
                key={dayKeys[i]}
                onClick={() => setActiveIdx(i)}
                aria-current={active ? 'true' : undefined}
                className={[
                  'shrink-0 px-3 py-2 rounded-lg border text-sm flex flex-col items-center min-w-[64px] transition',
                  active
                    ? 'bg-sky-500/15 border-sky-500/60 text-sky-100'
                    : isT
                      ? 'bg-slate-800/40 border-sky-700/40 text-slate-100'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300',
                ].join(' ')}
              >
                <span className="text-[11px] uppercase tracking-wider opacity-80">
                  {dayLabel(i, true)}
                </span>
                <span className="font-semibold leading-tight">{d.getDate()}</span>
                {count > 0 ? (
                  <span className="mt-0.5 text-[10px] text-sky-300">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: single day, no DnD */}
      <div className="md:hidden">
        <DayColumn
          dateKey={dayKeys[safeActive]!}
          dayIndex={safeActive}
          onOpenTask={onOpenTask}
          onMoveTask={onMoveTask}
          enableDnD={false}
        />
      </div>

      {/* Desktop: 7-day grid with DnD */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingTaskId(null)}
        >
          <div className="grid grid-cols-7 gap-3">
            {days.map((_, i) => (
              <DayColumn
                key={dayKeys[i]}
                dateKey={dayKeys[i]!}
                dayIndex={i}
                onOpenTask={onOpenTask}
                onMoveTask={onMoveTask}
                enableDnD={true}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingTask ? (
              <div className="dnd-overlay">
                <TaskCard
                  task={draggingTask}
                  onOpen={() => {}}
                  onMove={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
