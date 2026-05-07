import { addDays, format } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  startOfMondayWeek,
  weekLabel,
} from '../lib/date';
import { Icon } from './Icon';
import { WorkspaceToggle } from './WorkspaceToggle';

interface WeekHeaderProps {
  reference: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSettings: () => void;
}

export function WeekHeader({
  reference,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
}: WeekHeaderProps) {
  const monday = startOfMondayWeek(reference);
  const sunday = addDays(monday, 6);
  const range = `${format(monday, 'd. MMM', { locale: da })} – ${format(sunday, 'd. MMM yyyy', { locale: da })}`;

  return (
    <header className="safe-top sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-[1700px] mx-auto px-3 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Forrige uge"
          className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition"
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <button
          type="button"
          onClick={onToday}
          aria-label="Gå til denne uge"
          className="px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 active:bg-slate-700 transition"
        >
          <Icon name="today" size={18} />
          <span className="hidden sm:inline">I dag</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Næste uge"
          className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition"
        >
          <Icon name="chevron-right" size={20} />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <div className="text-base sm:text-lg font-semibold leading-tight truncate">
            {weekLabel(monday)}
          </div>
          <div className="text-xs text-slate-400 leading-tight truncate">
            {range}
          </div>
        </div>

        <div className="hidden sm:block">
          <WorkspaceToggle />
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Indstillinger"
          className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition"
        >
          <Icon name="gear" size={20} />
        </button>
      </div>

      {/* Mobile-only second row for the workspace toggle, centered. */}
      <div className="sm:hidden flex justify-center pb-2 px-3">
        <WorkspaceToggle />
      </div>
    </header>
  );
}
