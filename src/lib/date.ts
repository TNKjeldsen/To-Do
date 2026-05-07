import {
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  isSameDay,
  startOfWeek,
} from 'date-fns';

/**
 * Format a Date as a local YYYY-MM-DD string. We deliberately do NOT use
 * Date.toISOString() because that converts to UTC and can cause off-by-one-day
 * errors near midnight in the user's timezone.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string into a local Date at midnight. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Monday-first start of week. */
export function startOfMondayWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** Returns 7 Date objects, Monday through Sunday, for the given week. */
export function weekDays(reference: Date): Date[] {
  const monday = startOfMondayWeek(reference);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

const DAY_LABELS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const DAY_LABELS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

/** Index 0..6 where 0 = Monday. */
export function dayLabel(index: number, short = false): string {
  const labels = short ? DAY_LABELS_SHORT : DAY_LABELS_LONG;
  return labels[index] ?? '';
}

export function formatDayDate(date: Date): string {
  return format(date, 'd. LLL');
}

export function weekLabel(date: Date): string {
  const week = getISOWeek(date);
  const year = getISOWeekYear(date);
  return `Uge ${week} · ${year}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}
