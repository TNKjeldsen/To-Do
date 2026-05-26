import { useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { da } from 'date-fns/locale';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { useAppState, useDispatch } from '../state/AppStateContext';
import { todayKey } from '../lib/date';
import type { Trip } from '../types';

interface DrivingSheetProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  id?: string;
  date: string;
  from: string;
  to: string;
  km: string;
  purpose: string;
  note: string;
}

const emptyForm = (): FormState => ({
  date: todayKey(),
  from: '',
  to: '',
  km: '',
  purpose: '',
  note: '',
});

/** Group trips by YYYY-MM, newest month first. */
function groupByMonth(trips: Trip[]): { key: string; label: string; trips: Trip[] }[] {
  const buckets = new Map<string, Trip[]>();
  for (const t of trips) {
    const key = t.date.slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  const result: { key: string; label: string; trips: Trip[] }[] = [];
  const keys = [...buckets.keys()].sort((a, b) => b.localeCompare(a));
  for (const k of keys) {
    const sample = buckets.get(k)!;
    sample.sort((a, b) => b.date.localeCompare(a.date));
    const d = parse(`${k}-01`, 'yyyy-MM-dd', new Date());
    result.push({
      key: k,
      label: format(d, 'LLLL yyyy', { locale: da }),
      trips: sample,
    });
  }
  return result;
}

function formatKm(km: number): string {
  if (Number.isInteger(km)) return `${km} km`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function tripsToCsv(trips: Trip[]): string {
  const escape = (v: string | number): string => {
    const s = String(v);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = ['Dato', 'Fra', 'Til', 'Km', 'Formål', 'Notat'].join(';');
  const rows = trips
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) =>
      [t.date, escape(t.from), escape(t.to), escape(t.km), escape(t.purpose), escape(t.note ?? '')].join(';')
    );
  return [header, ...rows].join('\n');
}

export function DrivingSheet({ open, onClose }: DrivingSheetProps) {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const activeWorkspace = state.activeWorkspace;

  const allTrips = useMemo(
    () => state.trips.filter((t) => t.workspace === activeWorkspace),
    [state.trips, activeWorkspace]
  );

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'month' | 'year'>('month');
  const editing = Boolean(form.id);

  const now = new Date();
  const thisMonthKey = format(now, 'yyyy-MM');
  const thisYearKey = format(now, 'yyyy');

  const filteredTrips = useMemo(() => {
    if (filter === 'month') {
      return allTrips.filter((t) => t.date.slice(0, 7) === thisMonthKey);
    }
    if (filter === 'year') {
      return allTrips.filter((t) => t.date.slice(0, 4) === thisYearKey);
    }
    return allTrips;
  }, [allTrips, filter, thisMonthKey, thisYearKey]);

  const totalKm = useMemo(
    () => filteredTrips.reduce((acc, t) => acc + (Number.isFinite(t.km) ? t.km : 0), 0),
    [filteredTrips]
  );

  const grouped = useMemo(() => groupByMonth(filteredTrips), [filteredTrips]);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const kmNum = Number.parseFloat(form.km.replace(',', '.'));
    if (!Number.isFinite(kmNum) || kmNum < 0) return;
    if (!form.date) return;
    if (editing) {
      dispatch({
        type: 'UPDATE_TRIP',
        id: form.id!,
        patch: {
          date: form.date,
          from: form.from,
          to: form.to,
          km: kmNum,
          purpose: form.purpose,
          note: form.note,
        },
      });
    } else {
      dispatch({
        type: 'ADD_TRIP',
        trip: {
          date: form.date,
          from: form.from.trim(),
          to: form.to.trim(),
          km: kmNum,
          purpose: form.purpose.trim(),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
      });
    }
    resetForm();
  };

  const startEdit = (trip: Trip) => {
    setForm({
      id: trip.id,
      date: trip.date,
      from: trip.from,
      to: trip.to,
      km: String(trip.km).replace('.', ','),
      purpose: trip.purpose,
      note: trip.note ?? '',
    });
    setFormOpen(true);
  };

  const removeTrip = (trip: Trip) => {
    if (
      window.confirm(
        `Slet kørsel ${format(parse(trip.date, 'yyyy-MM-dd', new Date()), 'd. MMM yyyy', { locale: da })} (${formatKm(trip.km)})?`
      )
    ) {
      dispatch({ type: 'DELETE_TRIP', id: trip.id });
      if (form.id === trip.id) resetForm();
    }
  };

  const exportCsv = () => {
    if (allTrips.length === 0) return;
    const csv = tripsToCsv(allTrips);
    // Add BOM so Excel opens it correctly with æ/ø/å.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koersel-${activeWorkspace}-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Kørsel" large>
      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Filter + summary */}
        <section className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter periode"
            className="inline-flex items-center rounded-lg bg-slate-800/70 border border-slate-700 p-0.5"
          >
            {(['month', 'year', 'all'] as const).map((f) => {
              const label = f === 'month' ? 'Denne måned' : f === 'year' ? 'I år' : 'Alt';
              const isActive = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={isActive}
                  className={[
                    'px-2.5 py-1.5 rounded-md text-xs font-medium transition',
                    isActive
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="ml-auto text-sm">
            <span className="text-slate-400">Total: </span>
            <span className="font-semibold text-sky-300">{formatKm(totalKm)}</span>
            <span className="text-slate-500 text-xs ml-1">
              ({filteredTrips.length} {filteredTrips.length === 1 ? 'tur' : 'ture'})
            </span>
          </div>
        </section>

        {/* Add / edit form */}
        <section className="rounded-lg border border-slate-800 bg-slate-800/40">
          {formOpen ? (
            <form onSubmit={submit} className="p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">
                  {editing ? 'Redigér tur' : 'Ny tur'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  aria-label="Annullér"
                  className="p-1 rounded-md hover:bg-slate-700 text-slate-400"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Dato
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/60 [color-scheme:dark]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Km
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.km}
                    onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
                    required
                    placeholder="fx 42,5"
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/60"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Fra
                  <input
                    type="text"
                    value={form.from}
                    onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                    placeholder="Hjem"
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/60"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Til
                  <input
                    type="text"
                    value={form.to}
                    onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                    placeholder="Kunde / lokation"
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/60"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Formål
                <input
                  type="text"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="Kundemøde, indkøb, …"
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/60"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Notat (valgfri)
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/60 resize-none"
                />
              </label>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-sm"
                >
                  Annullér
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold"
                >
                  {editing ? 'Gem ændringer' : 'Tilføj tur'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm());
                setFormOpen(true);
              }}
              className="w-full p-3 flex items-center justify-center gap-2 text-sm text-sky-300 hover:bg-slate-800/70 transition rounded-lg"
            >
              <Icon name="plus" size={16} />
              Tilføj ny tur
            </button>
          )}
        </section>

        {/* Trip list grouped by month */}
        <section className="flex flex-col gap-3">
          {grouped.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              {allTrips.length === 0
                ? `Ingen kørsel registreret i ${activeWorkspace === 'work' ? 'Arbejde' : 'Privat'} endnu.`
                : 'Ingen ture i den valgte periode.'}
            </div>
          ) : (
            grouped.map((g) => {
              const monthKm = g.trips.reduce((acc, t) => acc + t.km, 0);
              return (
                <div key={g.key}>
                  <div className="flex items-baseline justify-between mb-1.5 px-1">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold capitalize">
                      {g.label}
                    </h4>
                    <div className="text-[11px] text-slate-500">
                      {formatKm(monthKm)} · {g.trips.length} {g.trips.length === 1 ? 'tur' : 'ture'}
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {g.trips.map((trip) => (
                      <li
                        key={trip.id}
                        className="rounded-lg border border-slate-700/70 bg-slate-800/60 hover:bg-slate-800 transition p-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <div className="text-xs text-slate-400">
                                {format(parse(trip.date, 'yyyy-MM-dd', new Date()), 'EEE d. MMM', { locale: da })}
                              </div>
                              <div className="text-sm font-semibold text-sky-300">
                                {formatKm(trip.km)}
                              </div>
                            </div>
                            <div className="text-sm text-slate-100 mt-0.5 break-words">
                              {trip.from || trip.to ? (
                                <>
                                  <span>{trip.from || '—'}</span>
                                  <span className="text-slate-500"> → </span>
                                  <span>{trip.to || '—'}</span>
                                </>
                              ) : (
                                <span className="text-slate-500 italic">Ingen rute</span>
                              )}
                            </div>
                            {trip.purpose ? (
                              <div className="text-xs text-slate-400 mt-0.5 break-words">
                                {trip.purpose}
                              </div>
                            ) : null}
                            {trip.note ? (
                              <div className="text-xs text-slate-500 mt-0.5 italic break-words">
                                {trip.note}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(trip)}
                              aria-label="Redigér"
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
                            >
                              <Icon name="pencil" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTrip(trip)}
                              aria-label="Slet"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-300 hover:bg-slate-700 transition"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>

        {/* Export */}
        {allTrips.length > 0 ? (
          <section className="border-t border-slate-800 pt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-slate-500">
              Eksportér alle ture i {activeWorkspace === 'work' ? 'Arbejde' : 'Privat'} som CSV — kan åbnes i Excel eller Numbers.
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-2"
            >
              <Icon name="download" size={14} />
              Eksportér CSV
            </button>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}
