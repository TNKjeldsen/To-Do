import { useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  dayLabel,
  isToday,
  startOfMondayWeek,
  toDateKey,
  todayKey,
  weekDays,
  weekLabel,
} from '../lib/date';
import { useDispatch, useTasksByDate } from '../state/AppStateContext';
import { useSelection } from '../state/SelectionContext';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

interface PasteSheetProps {
  open: boolean;
  onClose: () => void;
  /** Week the user is currently looking at, so the picker opens there. */
  reference: Date;
}

/** Day picker for pasting the copied cards. Mirrors MoveTaskSheet's layout. */
export function PasteSheet({ open, onClose, reference }: PasteSheetProps) {
  const dispatch = useDispatch();
  const { clipboard, clearClipboard } = useSelection();
  const [week, setWeek] = useState<Date>(reference);

  useEffect(() => {
    if (open) setWeek(reference);
  }, [open, reference]);

  const days = weekDays(week);
  const monday = startOfMondayWeek(week);
  const sunday = addDays(monday, 6);
  const range = `${format(monday, 'd. MMM', { locale: da })} – ${format(sunday, 'd. MMM yyyy', { locale: da })}`;
  const tomorrow = toDateKey(addDays(new Date(), 1));

  const paste = (toDate: string) => {
    if (clipboard.length === 0) return;
    dispatch({ type: 'PASTE_TASKS', snapshots: clipboard, toDate });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Sæt ${clipboard.length} ${clipboard.length === 1 ? 'opgave' : 'opgaver'} ind i…`}
    >
      <div className="px-4 py-4">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => paste(todayKey())}
            className="flex-1 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 active:bg-slate-600 text-sm font-semibold transition"
          >
            I dag
          </button>
          <button
            type="button"
            onClick={() => paste(tomorrow)}
            className="flex-1 px-3 py-2.5 rounded-lg bg-sky-500/15 border border-sky-500/50 text-sky-100 hover:bg-sky-500/25 active:bg-sky-500/35 text-sm font-semibold transition"
          >
            I morgen
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setWeek((d) => addDays(d, -7))}
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
            onClick={() => setWeek((d) => addDays(d, 7))}
            aria-label="Næste uge"
            className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700"
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </div>

        <ul className="flex flex-col gap-1.5">
          {days.map((d, i) => (
            <li key={toDateKey(d)}>
              <DayOption
                dateKey={toDateKey(d)}
                label={dayLabel(i)}
                dateLabel={format(d, 'd. MMMM', { locale: da })}
                today={isToday(d)}
                onPick={paste}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => paste('unscheduled')}
              className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg border bg-slate-800/60 border-slate-700 hover:bg-slate-700/70 active:bg-slate-700 text-left transition"
            >
              <div>
                <div className="font-semibold text-sm">Uden fast dag</div>
                <div className="text-xs text-slate-400">Gem som fleksible opgaver</div>
              </div>
              <Icon name="chevron-right" size={18} className="text-slate-500" />
            </button>
          </li>
        </ul>

        <button
          type="button"
          onClick={() => {
            clearClipboard();
            onClose();
          }}
          className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Ryd udklipsholder
        </button>
      </div>
    </Sheet>
  );
}

interface DayOptionProps {
  dateKey: string;
  label: string;
  dateLabel: string;
  today: boolean;
  onPick: (dateKey: string) => void;
}

function DayOption({ dateKey, label, dateLabel, today, onPick }: DayOptionProps) {
  const existing = useTasksByDate(dateKey).length;
  return (
    <button
      type="button"
      onClick={() => onPick(dateKey)}
      className={[
        'w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg border text-left transition',
        'bg-slate-800/60 border-slate-700 hover:bg-slate-700/70 active:bg-slate-700',
        today ? 'border-sky-600/60' : '',
      ].join(' ')}
    >
      <div>
        <div className="font-semibold text-sm">
          {label}
          {today ? (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-sky-300">
              I dag
            </span>
          ) : null}
        </div>
        <div className="text-xs text-slate-400">{dateLabel}</div>
      </div>
      <div className="flex items-center gap-2">
        {existing > 0 ? (
          <span className="text-[11px] text-slate-500">{existing} i forvejen</span>
        ) : null}
        <Icon name="chevron-right" size={18} className="text-slate-500" />
      </div>
    </button>
  );
}
