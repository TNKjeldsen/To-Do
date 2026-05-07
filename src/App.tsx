import { useState } from 'react';
import { addDays } from 'date-fns';
import { AppStateProvider } from './state/AppStateContext';
import { WeekHeader } from './components/WeekHeader';
import { WeekView } from './components/WeekView';
import { TaskDetail } from './components/TaskDetail';
import { MoveTaskSheet } from './components/MoveTaskSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import type { Task } from './types';

function AppShell() {
  const [reference, setReference] = useState<Date>(() => new Date());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-full">
      <WeekHeader
        reference={reference}
        onPrev={() => setReference((d) => addDays(d, -7))}
        onNext={() => setReference((d) => addDays(d, 7))}
        onToday={() => setReference(new Date())}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <WeekView
        reference={reference}
        onOpenTask={(task) => setOpenTaskId(task.id)}
        onMoveTask={setMoveTask}
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

      <PWAUpdatePrompt />
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}
