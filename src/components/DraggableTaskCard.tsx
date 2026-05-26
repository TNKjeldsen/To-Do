import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';
import { TaskCard } from './TaskCard';

interface DraggableTaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onMove: (task: Task) => void;
  /** Whether DnD should be enabled. */
  enableDrag: boolean;
}

/**
 * Drag-and-drop wrapper for a TaskCard. The dnd-kit listeners are applied to
 * the entire card so users can long-press anywhere on it to start dragging
 * (especially important on mobile, where there is no visible drag handle).
 *
 * Click-vs-drag is handled by the sensor activation constraints in WeekView:
 *   - MouseSensor: 6 px movement before drag activates → plain clicks still
 *     fire onClick on the card.
 *   - TouchSensor: 220 ms hold before drag activates → quick taps still fire
 *     onClick, and scrolling still works because the delay-with-tolerance
 *     setup cancels drag if the finger moves significantly during the hold.
 */
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
    // Allow vertical scroll through the card; horizontal pan/drag is reserved
    // for swipe + dnd. `manipulation` also disables double-tap-to-zoom, which
    // is what we want on the small day cards.
    touchAction: 'manipulation',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(enableDrag ? listeners : {})}>
      <TaskCard task={task} onOpen={onOpen} onMove={onMove} isDragging={isDragging} />
    </div>
  );
}
