import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
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
import { useSelection } from '../state/SelectionContext';

interface DayTabProps {
  dateKey: string;
  active: boolean;
  today: boolean;
  short: string;
  dayNumber: number;
  count: number;
  draggingActive: boolean;
  /** Disable the underlying droppable (e.g. on desktop where the tab strip
   *  is hidden via CSS) so it doesn't compete with the day columns. */
  droppableDisabled: boolean;
  onClick: () => void;
}

function DayTab({
  dateKey,
  active,
  today,
  short,
  dayNumber,
  count,
  draggingActive,
  droppableDisabled,
  onClick,
}: DayTabProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tab-${dateKey}`,
    data: { dateKey },
    disabled: droppableDisabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={[
        'px-1 py-1 rounded-md border text-[11px] flex flex-col items-center transition',
        isOver
          ? 'bg-sky-500/25 border-sky-400 text-sky-50 ring-2 ring-sky-400/70 scale-105'
          : active
            ? 'bg-sky-500/15 border-sky-500/60 text-sky-100'
            : today
              ? 'bg-slate-800/40 border-sky-700/40 text-slate-100'
              : 'bg-slate-800/40 border-slate-700/60 text-slate-300',
        draggingActive && !isOver ? 'border-dashed' : '',
      ].join(' ')}
    >
      <span className="uppercase tracking-wide">{short}</span>
      <span className="font-semibold leading-tight">{dayNumber}</span>
      {count > 0 ? <span className="text-[10px] text-sky-300">{count}</span> : null}
    </button>
  );
}

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
  // Tap-to-pick (touch only) and dragging cards are the same gesture, so
  // drag-and-drop stands down while that mode is on. The desktop marquee
  // starts on empty space, so it never competes with a card drag.
  const { selectionMode, selectedIds, setSelection, clearSelection, setActiveDate } =
    useSelection();

  const todayIndex = days.findIndex((d) => isToday(d));
  const [activeIdx, setActiveIdx] = useState<number>(todayIndex >= 0 ? todayIndex : 0);
  const safeActive = Math.min(activeIdx, 6);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Track whether we're rendering the desktop (md+) layout. We need this in JS
  // (not just CSS) so we can disable the mobile day-tab droppables on desktop
  // where they would otherwise register as 0×0 drop targets at offset (0, 0)
  // and confuse the closestCenter collision detection.
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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

  // On phones there is no marquee and only one day is on screen, so that day is
  // implicitly the paste target.
  useEffect(() => {
    if (!isDesktop) setActiveDate(dayKeys[safeActive] ?? null);
  }, [isDesktop, dayKeys, safeActive, setActiveDate]);

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
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);
  // Suppress the click that browsers sometimes synthesize after a successful
  // drag — without this, releasing a card on top of another card would both
  // reorder it AND open the task detail sheet on PC.
  const suppressClickUntil = useRef<number>(0);
  const draggingTask = useMemo(
    () => state.tasks.find((t) => t.id === draggingTaskId) ?? null,
    [state.tasks, draggingTaskId]
  );

  // A capture-phase click listener runs before React's onClick on the cards,
  // so we can stop spurious post-drag clicks from opening the task detail.
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setDraggingTaskId(id);
    // Capture the source's rendered size so the floating DragOverlay matches
    // it instead of collapsing to min-content (which is what makes the text
    // wrap to one character per line).
    const node = document.querySelector<HTMLElement>(`[data-task-wrapper="${CSS.escape(id)}"]`);
    if (node) {
      const rect = node.getBoundingClientRect();
      setDragSize({ width: rect.width, height: rect.height });
    } else {
      setDragSize(null);
    }
  };

  const resetDragState = () => {
    setDraggingTaskId(null);
    setDragSize(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const wasDragging = draggingTaskId !== null;
    resetDragState();
    // If we got here from an actual drag (even an empty drop), eat the next
    // click anywhere on the page so the click event tied to the same pointer
    // sequence doesn't accidentally open the task detail.
    if (wasDragging) suppressClickUntil.current = Date.now() + 350;
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
      // When dropping onto a different day on mobile, follow the task there
      // so the user sees the result without an extra tap.
      const idx = dayKeys.indexOf(toDate);
      if (idx >= 0) setActiveIdx(idx);
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

  // ---------- Rubber-band selection (desktop) ----------
  const [marquee, setMarquee] = useState<DOMRect | null>(null);
  const marqueeStart = useRef<{
    x: number;
    y: number;
    additive: boolean;
    base: string[];
    moved: boolean;
  } | null>(null);

  const handleSelectPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop || e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Clicking anywhere in a day — card included — makes it the paste target.
    const column = target.closest<HTMLElement>('[data-day-column]');
    setActiveDate(column?.dataset.dayColumn ?? null);
    // Anything interactive keeps its own behaviour; the band only starts on
    // the empty parts of the week.
    if (target.closest('[data-task-wrapper], button, input, textarea, select, a, label')) {
      return;
    }
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    marqueeStart.current = {
      x: e.clientX,
      y: e.clientY,
      additive,
      base: additive ? [...selectedIds] : [],
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      const start = marqueeStart.current;
      if (!start) return;
      if (
        !start.moved &&
        Math.abs(ev.clientX - start.x) < 4 &&
        Math.abs(ev.clientY - start.y) < 4
      ) {
        return;
      }
      start.moved = true;
      const left = Math.min(start.x, ev.clientX);
      const top = Math.min(start.y, ev.clientY);
      const width = Math.abs(ev.clientX - start.x);
      const height = Math.abs(ev.clientY - start.y);
      setMarquee(new DOMRect(left, top, width, height));
      const hits = new Set(start.base);
      document.querySelectorAll<HTMLElement>('[data-task-wrapper]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const overlaps =
          r.right >= left && r.left <= left + width && r.bottom >= top && r.top <= top + height;
        if (overlaps && el.dataset.taskWrapper) hits.add(el.dataset.taskWrapper);
      });
      setSelection([...hits]);
    };

    const onUp = () => {
      const start = marqueeStart.current;
      // A click on empty space (no drag) means "never mind".
      if (start && !start.moved && !start.additive) clearSelection();
      marqueeStart.current = null;
      setMarquee(null);
      document.body.classList.remove('select-none');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    // Stop the browser from text-selecting the week while the band is drawn.
    document.body.classList.add('select-none');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      className="mx-auto px-3 pt-3 pb-36 sm:pb-24 max-w-[1700px]"
      onPointerDown={handleSelectPointerDown}
    >
      <DndContext
        // Use closestCenter so dropping near an empty column (which shrinks
        // after its task moves away) still resolves to that column — the
        // stricter default rectIntersection often misses these targets.
        collisionDetection={closestCenter}
        // Force droppables to be re-measured on every render. With the
        // default WhileDragging strategy, column rects can go stale after
        // a move (e.g. Tirsdag→Torsdag leaves Tirsdag empty/shorter), so
        // a subsequent drop on the source column was getting "no drop".
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDragState}
      >
        {/* We render *either* the mobile layout *or* the desktop grid — never
            both at once — because each DayColumn / DraggableTaskCard registers
            with dnd-kit using a stable id (`day-<date>` / task id). If both
            layouts were mounted (with one hidden via CSS), dnd-kit would see
            duplicate ids and the hidden 0×0 element would silently steal the
            registration after a re-render, causing drops to stop working
            until you refreshed the page. */}
        {!isDesktop ? (
          <>
            {/* Mobile day tabs (also act as drop targets so you can long-press
                a task and drop it on another day). */}
            <div className="mb-2 -mx-3 px-3 overflow-x-auto no-scrollbar">
              <div className="grid grid-cols-7 gap-1 min-w-full">
                {days.map((d, i) => (
                  <DayTab
                    key={dayKeys[i]}
                    dateKey={dayKeys[i]!}
                    active={i === safeActive}
                    today={isToday(d)}
                    short={dayLabel(i, true)}
                    dayNumber={d.getDate()}
                    count={tasksPerDay[i] ?? 0}
                    draggingActive={draggingTaskId !== null}
                    droppableDisabled={selectionMode}
                    onClick={() => setActiveIdx(i)}
                  />
                ))}
              </div>
            </div>

            {/* Swipeable single day — swipe is disabled while dragging so it
                doesn't fight with drag-and-drop. */}
            <div
              onTouchStart={(e) => {
                if (draggingTaskId !== null) return;
                setTouchStartX(e.changedTouches[0]?.clientX ?? null);
                setTouchStartY(e.changedTouches[0]?.clientY ?? null);
              }}
              onTouchEnd={(e) => {
                const endX = e.changedTouches[0]?.clientX;
                const endY = e.changedTouches[0]?.clientY;
                if (
                  touchStartX === null ||
                  touchStartY === null ||
                  typeof endX !== 'number' ||
                  typeof endY !== 'number'
                ) {
                  return;
                }
                const deltaX = endX - touchStartX;
                const deltaY = endY - touchStartY;
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
                enableDnD={!selectionMode}
                compact
              />
              {draggingTaskId !== null ? (
                <div className="mt-2 text-center text-[11px] text-sky-300/80">
                  Slip på en anden dag øverst for at flytte
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-7 gap-3">
            {days.map((_, i) => (
              <DayColumn
                key={dayKeys[i]}
                dateKey={dayKeys[i]!}
                dayIndex={i}
                onOpenTask={onOpenTask}
                onMoveTask={onMoveTask}
                enableDnD={!selectionMode}
              />
            ))}
          </div>
        )}
        <DragOverlay dropAnimation={null}>
          {draggingTask ? (
            <div
              className="dnd-overlay"
              style={
                dragSize
                  ? { width: dragSize.width, height: dragSize.height }
                  : undefined
              }
            >
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

      {marquee ? (
        <div
          aria-hidden="true"
          className="fixed z-40 pointer-events-none rounded-sm border border-sky-400/80 bg-sky-400/15"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      ) : null}

      {/* FAB for unscheduled tasks — hidden while the selection bar owns the
          bottom of the screen. */}
      {!selectionMode ? (
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
      ) : null}
    </div>
  );
}
