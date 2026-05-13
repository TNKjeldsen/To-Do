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

interface WeekViewProps {
  reference: Date;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task) => void;
  onOpenUnscheduled: () => void;
  unscheduledCount: number;
}

export function WeekView({ reference, onOpenTask, onMoveTask, onOpenUnscheduled, unscheduledCount }: WeekViewProps) {
  const days = useMemo(() => weekDays(reference), [reference]);
  const dayKeys = useMemo(() => days.map(toDateKey), [days]);
  const { state } = useAppState();
  const dispatch = useDispatch();

  const todayIndex = days.findIndex((d) => isToday(d));
  const [activeIdx, setActiveIdx] = useState<number>(todayIndex >= 0 ? todayIndex : 0);
  const safeActive = Math.min(activeIdx, 6);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

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

  return (
    <div className="mx-auto px-3 pt-3 pb-36 sm:pb-24 max-w-[1700px]">
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
        {/* Mobile: swipeable single day — touch handlers on entire mobile block */}
        <div
          className="md:hidden"
          onTouchStart={(e) => {
            setTouchStartX(e.changedTouches[0]?.clientX ?? null);
            setTouchStartY(e.changedTouches[0]?.clientY ?? null);
          }}
          onTouchEnd={(e) => {
            const endX = e.changedTouches[0]?.clientX;
            const endY = e.changedTouches[0]?.clientY;
            if (touchStartX === null || touchStartY === null || typeof endX !== 'number' || typeof endY !== 'number') return;
            const deltaX = endX - touchStartX;
            const deltaY = endY - touchStartY;
            // Only trigger swipe if horizontal movement dominates
            if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > Math.abs(deltaX)) return;
            if (deltaX < 0) setActiveIdx((v) => Math.min(6, v + 1));
            if (deltaX > 0) setActiveIdx((v) => Math.max(0, v - 1));
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

      {/* FAB for unscheduled tasks */}
      <button
        type="button"
        onClick={onOpenUnscheduled}
        aria-label="Løbende opgaver"
        className="fixed bottom-[4.5rem] sm:bottom-6 left-4 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-800 border border-slate-700 shadow-lg hover:bg-slate-700 active:bg-slate-600 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-300">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-sm text-slate-200">Løbende</span>
        {unscheduledCount > 0 ? (
          <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white px-1">
            {unscheduledCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
