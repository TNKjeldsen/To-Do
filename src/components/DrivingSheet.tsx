import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { useAppState, useDispatch } from '../state/AppStateContext';
import { todayKey, toDateKey } from '../lib/date';
import {
  EXCLUSION_LABEL,
  EXCLUSION_ORDER,
  monthDays,
  summarizeMonth,
  summarizeYear,
  yearSummaryToCsv,
  type DayInfo,
} from '../lib/driving';
import type { ExclusionReason, WorkAddress } from '../types';

interface DrivingSheetProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'month' | 'year';

const MONTHS_LONG = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
];

function formatKm(km: number): string {
  if (Number.isInteger(km)) return `${km} km`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function DrivingSheet({ open, onClose }: DrivingSheetProps) {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const driving = state.driving;
  const isWork = state.activeWorkspace === 'work';

  const today = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('month');
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth());
  const [setupOpen, setSetupOpen] = useState(false);

  // If user isn't in the Arbejde workspace, the feature is disabled.
  if (!isWork) {
    return (
      <Sheet open={open} onClose={onClose} title="Kørsel" large>
        <div className="px-4 py-10 text-center text-sm text-slate-300 flex flex-col gap-3 items-center">
          <Icon name="car" size={32} className="text-slate-500" />
          <div className="font-semibold">Kun tilgængelig i Arbejde</div>
          <div className="text-xs text-slate-400 max-w-xs">
            Kørselsregistrering er beregnet til indberetning af kørsel mellem hjem
            og arbejde. Skift til <span className="text-amber-300 font-medium">Arbejde</span>
            -fanen for at bruge den.
          </div>
        </div>
      </Sheet>
    );
  }

  const hasSetup = driving.workAddresses.length > 0;

  return (
    <Sheet open={open} onClose={onClose} title="Kørsel" large>
      <div className="px-4 py-4 flex flex-col gap-4">
        {!hasSetup ? (
          <SetupBanner
            onOpen={() => {
              setSetupOpen(true);
            }}
          />
        ) : null}

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Periode"
          className="inline-flex items-center rounded-lg bg-slate-800/70 border border-slate-700 p-0.5 self-start"
        >
          {(['month', 'year'] as const).map((t) => {
            const label = t === 'month' ? 'Denne måned' : 'I år';
            const active = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-medium transition',
                  active
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === 'month' ? (
          <MonthView
            year={year}
            month={month}
            setYear={setYear}
            setMonth={setMonth}
            hasSetup={hasSetup}
          />
        ) : (
          <YearView year={year} setYear={setYear} hasSetup={hasSetup} />
        )}

        {/* Setup section (collapsible) */}
        <section className="rounded-lg border border-slate-800 bg-slate-800/40">
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between text-sm hover:bg-slate-800/70 rounded-lg"
            aria-expanded={setupOpen}
          >
            <span className="font-semibold text-slate-200">Adresser & opsætning</span>
            <span className={['transition', setupOpen ? 'rotate-180' : ''].join(' ')}>
              <Icon name="caret-down" size={16} />
            </span>
          </button>
          {setupOpen ? <SetupSection /> : null}
        </section>

        {/* Yearly CSV export */}
        {hasSetup ? (
          <section className="border-t border-slate-800 pt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-slate-500">
              Eksportér årsoversigt for {year} som CSV — klar til indberetning.
            </div>
            <button
              type="button"
              onClick={() => exportYearCsv(year, driving, dispatch /* unused */)}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-2"
            >
              <Icon name="download" size={14} />
              Eksportér {year}
            </button>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}

function SetupBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm flex items-start gap-3">
      <div className="text-sky-300 mt-0.5">
        <Icon name="car" size={18} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sky-100">Kom i gang</div>
        <div className="text-xs text-sky-100/80 mt-0.5">
          Tilføj en eller flere arbejdsadresser med afstand fra hjem. Når
          adressen er sat op, tæller alle hverdage automatisk som kørt.
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold"
        >
          Opsæt adresser
        </button>
      </div>
    </div>
  );
}

interface MonthViewProps {
  year: number;
  month: number;
  setYear: (v: number) => void;
  setMonth: (v: number) => void;
  hasSetup: boolean;
}

function MonthView({ year, month, setYear, setMonth, hasSetup }: MonthViewProps) {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const driving = state.driving;

  const days = useMemo(() => monthDays(year, month, driving), [year, month, driving]);
  const summary = useMemo(() => summarizeMonth(year, month, driving), [year, month, driving]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const toggleDay = (info: DayInfo) => {
    if (info.potential) {
      if (info.exclusion) {
        dispatch({ type: 'REMOVE_EXCLUSION', date: info.dateKey });
      } else {
        dispatch({ type: 'SET_EXCLUSION', date: info.dateKey, reason: 'wfh' });
      }
    } else {
      if (info.forcedDriven) {
        dispatch({ type: 'REMOVE_INCLUSION', date: info.dateKey });
      } else {
        dispatch({ type: 'ADD_INCLUSION', date: info.dateKey });
      }
    }
  };

  const setReason = (dateKey: string, reason: ExclusionReason) => {
    dispatch({ type: 'SET_EXCLUSION', date: dateKey, reason });
  };

  const monthLabel = MONTHS_LONG[month] ?? '';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Forrige måned"
          className="p-1.5 rounded-md hover:bg-slate-800 active:bg-slate-700"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="text-center">
          <div className="text-base font-semibold capitalize">
            {monthLabel} {year}
          </div>
          <div className="text-xs text-slate-400">
            <span className="text-sky-300 font-medium">{summary.drovenDays}</span>{' '}
            kørsels­dage · {formatKm(summary.totalKm)}
            {summary.excludedDays > 0 ? (
              <span className="text-slate-500"> · {summary.excludedDays} fraværsdage</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="Næste måned"
          className="p-1.5 rounded-md hover:bg-slate-800 active:bg-slate-700"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {summary.byAddress.length > 1 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
          <div className="font-semibold text-amber-200 mb-1">Adresseskift denne måned</div>
          <ul className="space-y-0.5 text-amber-100/90">
            {summary.byAddress.map((b) => (
              <li key={b.address.id}>
                {b.address.label || 'Uden navn'}: {b.days} dage · {formatKm(b.km)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hasSetup ? (
        <div className="text-center text-sm text-slate-500 py-6">
          Tilføj en arbejdsadresse under "Adresser & opsætning" for at se kørsel.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {days.map((info) => (
            <DayRow
              key={info.dateKey}
              info={info}
              onToggle={() => toggleDay(info)}
              onSetReason={(reason) => setReason(info.dateKey, reason)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface DayRowProps {
  info: DayInfo;
  onToggle: () => void;
  onSetReason: (reason: ExclusionReason) => void;
}

function DayRow({ info, onToggle, onSetReason }: DayRowProps) {
  const dow = info.date.getDay();
  const weekend = dow === 0 || dow === 6;
  const dayLabel = format(info.date, 'EEE d. MMM', { locale: da });
  const isToday = info.dateKey === toDateKey(new Date());

  // Non-potential days (weekend / public holiday) — either show a quiet
  // "skipped" row with a small "Marker som kørt" link, OR if the user has
  // explicitly opted in, render it like a normal driven day so it can be
  // toggled back off.
  if (!info.potential && !info.forcedDriven) {
    return (
      <li
        className={[
          'rounded-md px-2.5 py-1.5 text-xs flex items-center justify-between gap-2',
          'bg-slate-900/40 border border-slate-800/60 text-slate-500',
        ].join(' ')}
      >
        <span className="capitalize">{dayLabel}</span>
        <div className="flex items-center gap-2">
          <span className="italic">
            {info.isHoliday ? 'Helligdag' : weekend ? 'Weekend' : ''}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-400 hover:text-sky-200 hover:border-sky-500/40 text-[11px] transition"
            aria-label={`Marker ${dayLabel} som kørt`}
          >
            + Kørt alligevel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={[
        'rounded-md px-2.5 py-1.5 border flex items-center gap-2 transition',
        info.drove
          ? 'bg-slate-800/60 border-slate-700/70'
          : 'bg-slate-900/60 border-slate-800/70',
        isToday ? 'ring-1 ring-sky-500/50' : '',
        info.forcedDriven ? 'ring-1 ring-amber-500/40' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={info.drove ? 'Marker som ikke kørt' : 'Marker som kørt'}
        className={[
          'shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition',
          info.drove
            ? 'bg-sky-500 border-sky-500 text-white'
            : 'border-slate-600 hover:border-slate-400',
        ].join(' ')}
      >
        {info.drove ? <Icon name="check" size={12} /> : null}
      </button>
      <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
        <span className={['capitalize text-sm', info.drove ? 'text-slate-100' : 'text-slate-400'].join(' ')}>
          {dayLabel}
        </span>
        {info.forcedDriven ? (
          <span className="text-[10px] uppercase tracking-wide text-amber-300/90">
            {info.isHoliday ? 'Helligdag · kørt' : 'Weekend · kørt'}
          </span>
        ) : null}
        {info.drove ? (
          <span className="text-xs text-sky-300">
            {formatKm(info.km)}
            {info.address?.label ? (
              <span className="text-slate-500"> · {info.address.label}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      {info.exclusion ? (
        <select
          value={info.exclusion.reason}
          onChange={(e) => onSetReason(e.target.value as ExclusionReason)}
          className="bg-slate-800 border border-slate-700 rounded-md px-1.5 py-1 text-xs text-slate-200 outline-none focus:border-sky-500/60 [color-scheme:dark]"
          aria-label="Årsag"
        >
          {EXCLUSION_ORDER.map((r) => (
            <option key={r} value={r}>
              {EXCLUSION_LABEL[r]}
            </option>
          ))}
        </select>
      ) : null}
    </li>
  );
}

interface YearViewProps {
  year: number;
  setYear: (v: number) => void;
  hasSetup: boolean;
}

function YearView({ year, setYear, hasSetup }: YearViewProps) {
  const { state } = useAppState();
  const summary = useMemo(() => summarizeYear(year, state.driving), [year, state.driving]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setYear(year - 1)}
          aria-label="Forrige år"
          className="p-1.5 rounded-md hover:bg-slate-800 active:bg-slate-700"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="text-center">
          <div className="text-base font-semibold">{year}</div>
          <div className="text-xs text-slate-400">
            <span className="text-sky-300 font-medium">{summary.totalDays}</span> kørsels­dage
            <span className="text-slate-500"> · </span>
            <span className="text-sky-300 font-medium">{formatKm(summary.totalKm)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setYear(year + 1)}
          aria-label="Næste år"
          className="p-1.5 rounded-md hover:bg-slate-800 active:bg-slate-700"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {!hasSetup ? (
        <div className="text-center text-sm text-slate-500 py-6">
          Tilføj en arbejdsadresse under "Adresser & opsætning" for at se årsoversigten.
        </div>
      ) : (
        <ul className="rounded-lg border border-slate-800 divide-y divide-slate-800 overflow-hidden">
          {summary.months.map((m) => (
            <li
              key={m.month}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/40 hover:bg-slate-800/70 transition"
            >
              <span className="capitalize text-sm">{MONTHS_LONG[m.month]}</span>
              <div className="text-right text-xs">
                <span className="text-sky-300 font-medium">{m.drovenDays}</span>
                <span className="text-slate-500"> dage · </span>
                <span className="text-slate-200">{formatKm(m.totalKm)}</span>
                {m.excludedDays > 0 ? (
                  <span className="text-slate-500"> · {m.excludedDays} fravær</span>
                ) : null}
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 font-semibold">
            <span className="text-sm">I alt</span>
            <div className="text-right text-sm">
              <span className="text-sky-300">{summary.totalDays}</span>
              <span className="text-slate-500"> dage · </span>
              <span className="text-sky-300">{formatKm(summary.totalKm)}</span>
            </div>
          </li>
        </ul>
      )}
    </section>
  );
}

function SetupSection() {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const driving = state.driving;

  const [homeDraft, setHomeDraft] = useState(driving.homeAddress ?? '');
  const sortedAddresses = useMemo(
    () => [...driving.workAddresses].sort((a, b) => a.from.localeCompare(b.from)),
    [driving.workAddresses]
  );

  const [addOpen, setAddOpen] = useState(sortedAddresses.length === 0);
  const [newLabel, setNewLabel] = useState('');
  const [newKm, setNewKm] = useState('');
  const [newFrom, setNewFrom] = useState(`${new Date().getFullYear()}-01-01`);

  const commitHome = () => {
    if (homeDraft.trim() === (driving.homeAddress ?? '')) return;
    dispatch({ type: 'SET_HOME_ADDRESS', address: homeDraft });
  };

  const addAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const km = parseFloat(newKm.replace(',', '.'));
    if (!Number.isFinite(km) || km < 0) return;
    if (!newFrom) return;
    dispatch({
      type: 'ADD_WORK_ADDRESS',
      address: { label: newLabel.trim(), oneWayKm: km, from: newFrom },
    });
    setNewLabel('');
    setNewKm('');
    setAddOpen(false);
  };

  return (
    <div className="p-3 pt-1 flex flex-col gap-4">
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">
          Hjemmeadresse
        </label>
        <input
          type="text"
          value={homeDraft}
          onChange={(e) => setHomeDraft(e.target.value)}
          onBlur={commitHome}
          placeholder="fx Vejen 12, 8000 Aarhus"
          className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-sky-500/60"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Vejledende — bruges ikke til beregning.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Arbejdsadresser
          </label>
          {!addOpen ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1"
            >
              <Icon name="plus" size={12} />
              Tilføj
            </button>
          ) : null}
        </div>

        <ul className="flex flex-col gap-1.5">
          {sortedAddresses.map((w) => (
            <WorkAddressRow key={w.id} address={w} />
          ))}
          {sortedAddresses.length === 0 && !addOpen ? (
            <li className="text-xs text-slate-500 italic">Endnu ingen arbejdsadresser.</li>
          ) : null}
        </ul>

        {addOpen ? (
          <form onSubmit={addAddress} className="mt-2 rounded-md border border-slate-700 bg-slate-900/60 p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Ny arbejdsadresse</span>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Annullér"
                className="p-1 rounded-md hover:bg-slate-700 text-slate-400"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Navn / adresse (fx Hovedkontor, Vej 1)"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:border-sky-500/60"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                Km én vej
                <input
                  type="text"
                  inputMode="decimal"
                  value={newKm}
                  onChange={(e) => setNewKm(e.target.value)}
                  placeholder="fx 30"
                  required
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:border-sky-500/60"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                Gyldig fra
                <input
                  type="date"
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  required
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:border-sky-500/60 [color-scheme:dark]"
                />
              </label>
            </div>
            <button
              type="submit"
              className="self-end px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold"
            >
              Tilføj adresse
            </button>
          </form>
        ) : null}

        <p className="text-[11px] text-slate-500 mt-2">
          Når du skifter arbejdsplads, tilføj en ny adresse med datoen for første
          arbejdsdag på det nye sted. Den nye adresse bruges automatisk fra og
          med den dato.
        </p>
      </div>
    </div>
  );
}

function WorkAddressRow({ address }: { address: WorkAddress }) {
  const dispatch = useDispatch();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(address.label);
  const [km, setKm] = useState(String(address.oneWayKm).replace('.', ','));
  const [from, setFrom] = useState(address.from);

  const save = () => {
    const kmNum = parseFloat(km.replace(',', '.'));
    if (!Number.isFinite(kmNum) || kmNum < 0) return;
    dispatch({
      type: 'UPDATE_WORK_ADDRESS',
      id: address.id,
      patch: { label, oneWayKm: kmNum, from },
    });
    setEditing(false);
  };

  const remove = () => {
    if (window.confirm(`Slet "${address.label || 'adresse'}"?`)) {
      dispatch({ type: 'DELETE_WORK_ADDRESS', id: address.id });
    }
  };

  if (editing) {
    return (
      <li className="rounded-md border border-slate-700 bg-slate-900/60 p-2.5 flex flex-col gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Navn / adresse"
          className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:border-sky-500/60"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="Km én vej"
            className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:border-sky-500/60"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:border-sky-500/60 [color-scheme:dark]"
          />
        </div>
        <div className="flex gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-xs"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={save}
            className="px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold"
          >
            Gem
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-slate-700/70 bg-slate-800/60 px-2.5 py-1.5 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-100 truncate">
          {address.label || <span className="italic text-slate-500">Uden navn</span>}
        </div>
        <div className="text-[11px] text-slate-400">
          {formatKm(address.oneWayKm)} én vej · gyldig fra{' '}
          {format(new Date(`${address.from}T00:00:00`), 'd. MMM yyyy', { locale: da })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Redigér"
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700"
      >
        <Icon name="pencil" size={14} />
      </button>
      <button
        type="button"
        onClick={remove}
        aria-label="Slet"
        className="p-1.5 rounded-md text-slate-400 hover:text-red-300 hover:bg-slate-700"
      >
        <Icon name="trash" size={14} />
      </button>
    </li>
  );
}

function exportYearCsv(
  year: number,
  driving: import('../types').DrivingData,
  _dispatch: unknown
) {
  const summary = summarizeYear(year, driving);
  if (summary.totalDays === 0) return;
  const csv = yearSummaryToCsv(summary);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `koersel-${year}-${todayKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
