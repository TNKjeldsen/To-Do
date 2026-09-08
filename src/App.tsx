import { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { AppStateProvider, useAppState, useDispatch } from './state/AppStateContext';
import { SelectionProvider, useSelection } from './state/SelectionContext';
import { WeekHeader } from './components/WeekHeader';
import { WeekView } from './components/WeekView';
import { TaskDetail } from './components/TaskDetail';
import { MoveTaskSheet } from './components/MoveTaskSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { DrivingSheet } from './components/DrivingSheet';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { UnscheduledSheet } from './components/UnscheduledSheet';
import { SelectionBar } from './components/SelectionBar';
import { PasteSheet } from './components/PasteSheet';
import { WorkspaceToggle } from './components/WorkspaceToggle';
import type { Task } from './types';

function AppShell() {
  const [reference, setReference] = useState<Date>(() => new Date());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drivingOpen, setDrivingOpen] = useState(false);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const { state } = useAppState();
  const dispatch = useDispatch();
  const { selectedIds, clipboard, activeDate, copySelection, clearSelection } =
    useSelection();

  // Ctrl/Cmd+C copies the marked cards, Ctrl/Cmd+V drops them into whichever
  // day was last clicked, Escape drops the selection. Nothing fires while the
  // user is typing in a field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === 'c' && selectedIds.size > 0) {
        e.preventDefault();
        copySelection();
      } else if (key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        // No day pointed at yet — let the user pick one instead of guessing.
        if (activeDate) {
          dispatch({ type: 'PASTE_TASKS', snapshots: clipboard, toDate: activeDate });
        } else {
          setPasteOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, clipboard, activeDate, copySelection, clearSelection, dispatch]);

  const unscheduledCount = useMemo(
    () =>
      state.tasks.filter(
        (t) => t.workspace === state.activeWorkspace && (t.unscheduled || t.date === 'unscheduled') && !t.done
      ).length,
    [state.tasks, state.activeWorkspace]
  );

  return (
    <div className="min-h-full">
      <WeekHeader
        reference={reference}
        onPrev={() => setReference((d) => addDays(d, -7))}
        onNext={() => setReference((d) => addDays(d, 7))}
        onToday={() => setReference(new Date())}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDriving={() => setDrivingOpen(true)}
      />
      <WeekView
        reference={reference}
        onOpenTask={(task) => setOpenTaskId(task.id)}
        onMoveTask={setMoveTask}
        onOpenUnscheduled={() => setUnscheduledOpen(true)}
        unscheduledCount={unscheduledCount}
      />

      <TaskDetail
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onMove={(task) => {
          setOpenTaskId(null);
          setMoveTask(task);
        }}
      />

      <MoveTaskSheet task={moveTask} onClose={() => setMoveTask(null)} />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <DrivingSheet open={drivingOpen} onClose={() => setDrivingOpen(false)} />

      <UnscheduledSheet
        open={unscheduledOpen}
        onClose={() => setUnscheduledOpen(false)}
        onOpenTask={(task) => setOpenTaskId(task.id)}
      />

      <SelectionBar onPaste={() => setPasteOpen(true)} />

      <PasteSheet
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        reference={reference}
      />

      {/* Mobile footer: workspace toggle */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-slate-950/90 backdrop-blur border-t border-slate-800 safe-bottom flex justify-center py-2">
        <WorkspaceToggle />
      </div>

      <PWAUpdatePrompt />
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <SelectionProvider>
        <AppShell />
      </SelectionProvider>
    </AppStateProvider>
  );
}
