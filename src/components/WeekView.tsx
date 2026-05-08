import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { AddTaskInput } from './AddTaskInput';

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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

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

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 220,
        tolerance: 8,
      },
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
    const activeData = active.data.current as { dateKey?: string } | undefined;
    const dropData = over.data.current as { dateKey?: string; taskId?: string } | undefined;
    const toDate = dropData?.dateKey;
    if (!toDate) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.date !== toDate) {
      dispatch({ type: 'MOVE_TASK', id: taskId, toDate });
      return;
    }
    const sameDayTasks = state.tasks
      .filter((t) => t.workspace === activeWorkspace && t.date === toDate)
      .sort((a, b) => a.order - b.order);
    const toTaskId = dropData?.taskId ?? String(over.id);
    const toIndex = sameDayTasks.findIndex((t) => t.id === toTaskId);
    const fromDate = activeData?.dateKey;
    if (toIndex < 0 || fromDate !== toDate) return;
    dispatch({ type: 'REORDER_TASK', id: taskId, toIndex });
  };

  const unscheduledTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => t.workspace === activeWorkspace && (t.unscheduled || t.date === 'unscheduled'))
        .sort((a, b) => a.order - b.order),
    [state.tasks, activeWorkspace]
  );

  return (
    <div className="mx-auto px-3 pt-3 pb-24 max-w-[1700px]">
      {/* Mobile day tabs */}
      <div className="md:hidden mb-2 -mx-3 px-3 overflow-x-auto no-scrollbar">
        <div className="grid grid-cols-7 gap-1 min-w-full">
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
                  'px-1 py-1 rounded-md border text-[11px] flex flex-col items-center transition',
                  active
                    ? 'bg-sky-500/15 border-sky-500/60 text-sky-100'
                    : isT
                      ? 'bg-slate-800/40 border-sky-700/40 text-slate-100'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300',
                ].join(' ')}
              >
                <span className="uppercase tracking-wide">{dayLabel(i, true)}</span>
                <span className="font-semibold leading-tight">{d.getDate()}</span>
                {count > 0 ? <span className="text-[10px] text-sky-300">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingTaskId(null)}
      >
        {/* Mobile: swipeable single day */}
        <div className="md:hidden">
          <div
            onTouchStart={(e) => setTouchStartX(e.changedTouches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const endX = e.changedTouches[0]?.clientX;
              if (touchStartX === null || typeof endX !== 'number') return;
              const delta = endX - touchStartX;
              if (Math.abs(delta) < 50) return;
              if (delta < 0) setActiveIdx((v) => Math.min(6, v + 1));
              if (delta > 0) setActiveIdx((v) => Math.max(0, v - 1));
            }}
          >
            <DayColumn
              dateKey={dayKeys[safeActive]!}
              dayIndex={safeActive}
              onOpenTask={onOpenTask}
              onMoveTask={onMoveTask}
              enableDnD={true}
              compact
            />
          </div>
        </div>

        {/* Desktop: 7-day grid with DnD */}
        <div className="hidden md:block">
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

      <section className="mt-3 md:mt-4 w-full md:max-w-sm">
        <div className="mb-1 px-1 text-xs uppercase tracking-wider text-slate-400">
          Uden fast dag
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2">
          <ul className="flex flex-wrap gap-1.5 mb-2">
            {unscheduledTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700"
                >
                  {task.title}
                </button>
              </li>
            ))}
          </ul>
          <AddTaskInput date="unscheduled" placeholder="Tilføj hurtig opgave…" />
        </div>
      </section>
    </div>
  );
}
