import { useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  dayLabel,
  isToday,
  parseDateKey,
  startOfMondayWeek,
  toDateKey,
  weekDays,
  weekLabel,
} from '../lib/date';
import type { Task } from '../types';
import { useDispatch } from '../state/AppStateContext';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

interface MoveTaskSheetProps {
  task: Task | null;
  onClose: () => void;
}

export function MoveTaskSheet({ task, onClose }: MoveTaskSheetProps) {
  const dispatch = useDispatch();
  const [reference, setReference] = useState<Date>(new Date());

  useEffect(() => {
    if (task) {
      setReference(task.date === 'unscheduled' ? new Date() : parseDateKey(task.date));
    }
  }, [task]);

  if (!task) {
    return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  }

  const days = weekDays(reference);
  const monday = startOfMondayWeek(reference);
  const sunday = addDays(monday, 6);
  const range = `${format(monday, 'd. MMM', { locale: da })} – ${format(sunday, 'd. MMM yyyy', { locale: da })}`;

  const move = (toDate: string) => {
    if (toDate === task.date) {
      onClose();
      return;
    }
    dispatch({ type: 'MOVE_TASK', id: task.id, toDate });
    onClose();
  };

  return (
    <Sheet
      open={true}
      onClose={onClose}
      title={
        <span>
          Flyt: <span className="text-slate-300 font-normal">{task.title}</span>
        </span>
      }
    >
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setReference((d) => addDays(d, -7))}
            aria-label="Forrige uge"
            className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700"
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <div className="flex-1 text-center">
            <div className="font-semibold text-sm">{weekLabel(monday)}</div>
            <div className="text-xs text-slate-400">{range}</div>
          </div>
          <button
            type="button"
            onClick={() => setReference((d) => addDays(d, 7))}
            aria-label="Næste uge"
            className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700"
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setReference(new Date())}
          className="w-full mb-3 text-xs text-sky-300 hover:text-sky-200 py-1"
        >
          Hop til denne uge
        </button>

        <ul className="flex flex-col gap-1.5">
          <li>
            <button
              type="button"
              onClick={() => move('unscheduled')}
              disabled={task.date === 'unscheduled'}
              className={[
                'w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg border text-left transition',
                task.date === 'unscheduled'
                  ? 'bg-slate-800/30 border-slate-800 opacity-60 cursor-not-allowed'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/70 active:bg-slate-700',
              ].join(' ')}
            >
              <div>
                <div className="font-semibold text-sm">Uden fast dag</div>
                <div className="text-xs text-slate-400">Gem som fleksibel opgave</div>
              </div>
              {task.date === 'unscheduled' ? (
                <span className="text-[11px] text-slate-500">Nuværende</span>
              ) : (
                <Icon name="chevron-right" size={18} className="text-slate-500" />
              )}
            </button>
          </li>
          {days.map((d, i) => {
            const key = toDateKey(d);
            const current = key === task.date;
            const today = isToday(d);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => move(key)}
                  disabled={current}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg border text-left transition',
                    current
                      ? 'bg-slate-800/30 border-slate-800 opacity-60 cursor-not-allowed'
                      : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/70 active:bg-slate-700',
                    today && !current ? 'border-sky-600/60' : '',
                  ].join(' ')}
                >
                  <div>
                    <div className="font-semibold text-sm">
                      {dayLabel(i)}
                      {today ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-sky-300">
                          I dag
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400">
                      {format(d, 'd. MMMM', { locale: da })}
                    </div>
                  </div>
                  {current ? (
                    <span className="text-[11px] text-slate-500">Nuværende</span>
                  ) : (
                    <Icon name="chevron-right" size={18} className="text-slate-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
