// Calendar-based period filtering for the ranking screen. Each period kind
// resolves to a [start, end) window relative to a reference date (defaults to
// now). "All" means no filter — any timestamp passes.

export type PeriodKind = 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'all';

export interface PeriodRange {
  startIso: string;          // inclusive
  endIso: string;            // exclusive
  label: string;             // human-readable, e.g. "Maio 2026", "Q2 2026"
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoOf(d: Date): string {
  return d.toISOString();
}

// ISO week starts on Monday. Mon=1..Sun=7 in our calculation.
function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const offset = day === 0 ? 6 : day - 1; // back to Monday
  d.setDate(d.getDate() - offset);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Shifts `d` by `n` months. To avoid JS rolling Jan 31 + 1 month into March,
// we snap the day to 1 before applying the offset. The result is always at
// day=1 of the target month — fine for period navigation since callers
// (computePeriodRange) only read year/month anyway.
export function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(1);
  out.setMonth(out.getMonth() + n);
  return out;
}

// month: 0-indexed (0=Jan).
function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function computePeriodRange(kind: PeriodKind, ref: Date = new Date()): PeriodRange | null {
  if (kind === 'all') return null;

  if (kind === 'week') {
    const start = startOfWeek(ref);
    const end = addDays(start, 7);
    const label = `${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(addDays(end, -1).getDate())}/${pad(addDays(end, -1).getMonth() + 1)}`;
    return { startIso: isoOf(start), endIso: isoOf(end), label };
  }

  if (kind === 'month') {
    const start = startOfMonth(ref.getFullYear(), ref.getMonth());
    const end = startOfMonth(ref.getFullYear(), ref.getMonth() + 1);
    const label = `${MONTHS_PT[ref.getMonth()]}/${ref.getFullYear()}`;
    return { startIso: isoOf(start), endIso: isoOf(end), label };
  }

  if (kind === 'quarter') {
    const q = Math.floor(ref.getMonth() / 3); // 0..3
    const startMonth = q * 3;
    const start = startOfMonth(ref.getFullYear(), startMonth);
    const end = startOfMonth(ref.getFullYear(), startMonth + 3);
    const label = `Q${q + 1} ${ref.getFullYear()}`;
    return { startIso: isoOf(start), endIso: isoOf(end), label };
  }

  if (kind === 'semester') {
    const h = ref.getMonth() < 6 ? 0 : 1;
    const start = startOfMonth(ref.getFullYear(), h === 0 ? 0 : 6);
    const end = startOfMonth(ref.getFullYear(), h === 0 ? 6 : 12);
    const label = `S${h + 1} ${ref.getFullYear()}`;
    return { startIso: isoOf(start), endIso: isoOf(end), label };
  }

  if (kind === 'year') {
    const start = startOfMonth(ref.getFullYear(), 0);
    const end = startOfMonth(ref.getFullYear() + 1, 0);
    return { startIso: isoOf(start), endIso: isoOf(end), label: String(ref.getFullYear()) };
  }

  return null;
}

// True if `timestamp` falls inside the period (or no period = always true).
export function isInPeriod(timestamp: string, range: PeriodRange | null): boolean {
  if (!range) return true;
  if (!timestamp) return false;
  return timestamp >= range.startIso && timestamp < range.endIso;
}
