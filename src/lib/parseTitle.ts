/**
 * Parse an optional trailing time from a task title. Accepts these forms at
 * the very end of the string (case-insensitive):
 *   "Vaske tøj 11:00"   → title "Vaske tøj",   time "11:00"
 *   "Vaske tøj 11.00"   → title "Vaske tøj",   time "11:00"
 *   "Vaske tøj kl 11"   → title "Vaske tøj",   time "11:00"
 *   "Vaske tøj kl. 11.30" → title "Vaske tøj", time "11:30"
 *
 * We deliberately require either an explicit colon/period between hours and
 * minutes OR a "kl"/"kl." prefix so that titles ending in plain digits
 * (e.g. "Køb mælk 2") are not interpreted as a time.
 */
export function parseTitleTime(input: string): { title: string; time?: string } {
  const original = input.trim();
  if (!original) return { title: original };
  const re = /\s+(?:kl\.?\s*(\d{1,2})(?:[:.](\d{2}))?|(\d{1,2})[:.](\d{2}))\s*$/i;
  const m = original.match(re);
  if (!m) return { title: original };
  const h = parseInt(m[1] ?? m[3] ?? '', 10);
  const mm = parseInt(m[2] ?? m[4] ?? '0', 10);
  if (!Number.isFinite(h) || h < 0 || h > 23) return { title: original };
  if (!Number.isFinite(mm) || mm < 0 || mm > 59) return { title: original };
  const stripped = original.slice(0, m.index).trim();
  if (!stripped) return { title: original };
  const time = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return { title: stripped, time };
}
