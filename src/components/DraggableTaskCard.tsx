import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';
import { TaskCard } from './TaskCard';

interface DraggableTaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onMove: (task: Task) => void;
  /** Whether DnD should be enabled (false on mobile / touch). */
  enableDrag: boolean;
}

export function DraggableTaskCard({
  task,
  onOpen,
  onMove,
  enableDrag,
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { taskId: task.id, dateKey: task.date },
    disabled: !enableDrag,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard
        task={task}
        onOpen={onOpen}
        onMove={onMove}
        dragHandleProps={enableDrag ? listeners : undefined}
        isDragging={isDragging}
      />
    </div>
  );
}
