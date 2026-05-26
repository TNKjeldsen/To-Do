import type {
  DrivingData,
  DrivingExclusion,
  ExclusionReason,
  WorkAddress,
} from '../types';
import { toDateKey } from './date';

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  sick: 'Sygdom',
  wfh: 'Hjemmearbejde',
  vacation: 'Ferie',
  holiday: 'Helligdag',
  other: 'Andet',
};

export const EXCLUSION_ORDER: ExclusionReason[] = [
  'wfh',
  'sick',
  'vacation',
  'holiday',
  'other',
];

/**
 * Compute the date of Easter Sunday for a given year using Gauss's algorithm.
 * Returns a local Date at midnight.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysLocal(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Return the set of Danish public holiday dates (YYYY-MM-DD) for a given year.
 * Includes only days where workplaces are typically closed:
 *   - Nytårsdag (1. jan)
 *   - Skærtorsdag (Påske - 3)
 *   - Langfredag (Påske - 2)
 *   - Påskedag (søndag — også weekend, men inkluderet for fuldstændighed)
 *   - 2. påskedag (Påske + 1)
 *   - Store bededag (Påske + 26) — kun for år til og med 2023
 *   - Kristi himmelfartsdag (Påske + 39)
 *   - Pinsedag (Påske + 49 — søndag)
 *   - 2. pinsedag (Påske + 50)
 *   - Juledag (25. dec)
 *   - 2. juledag (26. dec)
 */
export function danishHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const dates: Date[] = [
    new Date(year, 0, 1),
    addDaysLocal(easter, -3),
    addDaysLocal(easter, -2),
    easter,
    addDaysLocal(easter, 1),
    addDaysLocal(easter, 39),
    addDaysLocal(easter, 49),
    addDaysLocal(easter, 50),
    new Date(year, 11, 25),
    new Date(year, 11, 26),
  ];
  if (year <= 2023) {
    dates.push(addDaysLocal(easter, 26));
  }
  return new Set(dates.map(toDateKey));
}

/** Cache holiday sets across calls within a session. */
const holidayCache = new Map<number, Set<string>>();
export function isDanishHoliday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  const year = d.getFullYear();
  let set = holidayCache.get(year);
  if (!set) {
    set = danishHolidays(year);
    holidayCache.set(year, set);
  }
  return set.has(toDateKey(d));
}

/** A date is a potential commute day when it's Mon-Fri AND not a public holiday. */
export function isPotentialCommuteDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !isDanishHoliday(date);
}

/**
 * Find the work address effective on a given date (the latest entry whose
 * `from` is ≤ date). Returns null when no addresses are configured or the
 * date is before the earliest one.
 */
export function effectiveAddress(
  driving: DrivingData,
  date: Date | string
): WorkAddress | null {
  const key = typeof date === 'string' ? date : toDateKey(date);
  const sorted = [...driving.workAddresses].sort((a, b) => a.from.localeCompare(b.from));
  let match: WorkAddress | null = null;
  for (const w of sorted) {
    if (w.from <= key) match = w;
    else break;
  }
  return match;
}

/** Build a lookup of exclusions by date for quick access. */
function exclusionMap(exclusions: DrivingExclusion[]): Map<string, DrivingExclusion> {
  const m = new Map<string, DrivingExclusion>();
  for (const e of exclusions) m.set(e.date, e);
  return m;
}

export interface DayInfo {
  dateKey: string;
  date: Date;
  /** True for Mon-Fri and not a public holiday. */
  potential: boolean;
  /** True when the user actually drove (potential AND not excluded). */
  drove: boolean;
  /** Round trip distance for the day (0 when not drove). */
  km: number;
  /** Active address for the day. */
  address: WorkAddress | null;
  /** Exclusion for the day if any. */
  exclusion: DrivingExclusion | null;
  /** Public holiday flag (informational). */
  isHoliday: boolean;
}

/** Build per-day info for a calendar month. */
export function monthDays(
  year: number,
  month: number /* 0-indexed */,
  driving: DrivingData
): DayInfo[] {
  const exMap = exclusionMap(driving.exclusions);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out: DayInfo[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = !isWeekend && isDanishHoliday(date);
    const potential = !isWeekend && !isHoliday;
    const exclusion = exMap.get(dateKey) ?? null;
    const drove = potential && !exclusion;
    const address = drove ? effectiveAddress(driving, date) : null;
    const km = drove && address ? Math.max(0, address.oneWayKm) * 2 : 0;
    out.push({ dateKey, date, potential, drove, km, address, exclusion, isHoliday });
  }
  return out;
}

export interface MonthSummary {
  year: number;
  month: number;
  /** Days where the user drove. */
  drovenDays: number;
  /** Total km for the month. */
  totalKm: number;
  /** Days excluded (sick / WFH / etc.) — only counts weekdays that weren't holidays. */
  excludedDays: number;
  /** Breakdown by address (label → km). Useful when an address change happens mid-month. */
  byAddress: { address: WorkAddress; days: number; km: number }[];
}

export function summarizeMonth(
  year: number,
  month: number,
  driving: DrivingData
): MonthSummary {
  const days = monthDays(year, month, driving);
  const byAddressMap = new Map<string, { address: WorkAddress; days: number; km: number }>();
  let drovenDays = 0;
  let totalKm = 0;
  let excludedDays = 0;
  for (const d of days) {
    if (d.drove && d.address) {
      drovenDays += 1;
      totalKm += d.km;
      const prev = byAddressMap.get(d.address.id);
      if (prev) {
        prev.days += 1;
        prev.km += d.km;
      } else {
        byAddressMap.set(d.address.id, { address: d.address, days: 1, km: d.km });
      }
    } else if (d.potential && d.exclusion) {
      excludedDays += 1;
    }
  }
  return {
    year,
    month,
    drovenDays,
    totalKm,
    excludedDays,
    byAddress: [...byAddressMap.values()],
  };
}

export interface YearSummary {
  year: number;
  months: MonthSummary[];
  totalDays: number;
  totalKm: number;
}

export function summarizeYear(year: number, driving: DrivingData): YearSummary {
  const months: MonthSummary[] = [];
  let totalDays = 0;
  let totalKm = 0;
  for (let m = 0; m < 12; m++) {
    const s = summarizeMonth(year, m, driving);
    months.push(s);
    totalDays += s.drovenDays;
    totalKm += s.totalKm;
  }
  return { year, months, totalDays, totalKm };
}

/** Build a CSV string for a year's driving log, ready for tax declaration. */
export function yearSummaryToCsv(summary: YearSummary): string {
  const months = [
    'Januar',
    'Februar',
    'Marts',
    'April',
    'Maj',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'December',
  ];
  const escape = (v: string | number): string => {
    const s = String(v);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows: string[] = [];
  rows.push(['Måned', 'Kørsels­dage', 'Km i alt'].join(';'));
  for (const m of summary.months) {
    rows.push([months[m.month] ?? '', m.drovenDays, m.totalKm].map(escape).join(';'));
  }
  rows.push(['I alt', summary.totalDays, summary.totalKm].map(escape).join(';'));
  return rows.join('\n');
}
