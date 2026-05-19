import { addDays, addMonths, computePeriodRange } from '../periods';

describe('addDays', () => {
  test('positive shift', () => {
    const d = new Date(2026, 4, 19); // May 19, 2026
    const out = addDays(d, 5);
    expect(out.getDate()).toBe(24);
    expect(out.getMonth()).toBe(4);
  });

  test('negative shift across month boundary', () => {
    const d = new Date(2026, 4, 1); // May 1
    const out = addDays(d, -1);
    expect(out.getMonth()).toBe(3); // April
    expect(out.getDate()).toBe(30);
  });

  test('original date is not mutated', () => {
    const d = new Date(2026, 4, 19);
    addDays(d, 5);
    expect(d.getDate()).toBe(19);
  });
});

describe('addMonths', () => {
  test('forward shift within same year', () => {
    const d = new Date(2026, 4, 15); // May
    const out = addMonths(d, 2);
    expect(out.getFullYear()).toBe(2026);
    expect(out.getMonth()).toBe(6); // July
  });

  test('backward shift across year boundary', () => {
    const d = new Date(2026, 0, 15); // January
    const out = addMonths(d, -2);
    expect(out.getFullYear()).toBe(2025);
    expect(out.getMonth()).toBe(10); // November
  });

  test('forward shift across year boundary', () => {
    const d = new Date(2026, 10, 15); // November
    const out = addMonths(d, 3);
    expect(out.getFullYear()).toBe(2027);
    expect(out.getMonth()).toBe(1); // February
  });

  test('day=31 source month → result lands in target month (no JS overflow)', () => {
    // The classic JS Date pitfall: May 31 + setMonth(3) rolls into May 1
    // because April only has 30 days. addMonths must guard against this.
    const d = new Date(2026, 4, 31); // May 31
    const out = addMonths(d, -1);
    expect(out.getMonth()).toBe(3); // April (not May)
    expect(out.getFullYear()).toBe(2026);
  });

  test('leap year forward/backward', () => {
    const d = new Date(2024, 1, 29); // Feb 29 2024 (leap)
    const out = addMonths(d, 12);
    expect(out.getFullYear()).toBe(2025);
    expect(out.getMonth()).toBe(1); // February
  });

  test('n=0 returns equivalent date', () => {
    const d = new Date(2026, 4, 19);
    const out = addMonths(d, 0);
    expect(out.getMonth()).toBe(4);
    expect(out.getFullYear()).toBe(2026);
  });

  test('original date is not mutated', () => {
    const d = new Date(2026, 4, 31);
    addMonths(d, -1);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(31);
  });
});

describe('computePeriodRange with shifted ref', () => {
  // Integration: confirm that shifting the ref by addMonths/addDays produces
  // the expected period range. This is the exact pattern RankingScreen uses
  // for prev/next navigation.
  test('month nav: addMonths(-1) on May ref produces April range', () => {
    const ref = new Date(2026, 4, 19); // May 19
    const prev = addMonths(ref, -1);
    const range = computePeriodRange('month', prev);
    expect(range).not.toBeNull();
    expect(range!.label).toMatch(/abr\/2026/i);
  });

  test('week nav: addDays(-7) shifts the label', () => {
    const ref = new Date(2026, 4, 19); // May 19
    const prev = addDays(ref, -7);
    const range = computePeriodRange('week', prev);
    expect(range).not.toBeNull();
    // Previous week range should include May 12
    expect(range!.startIso <= new Date(2026, 4, 12, 12, 0, 0).toISOString()).toBe(true);
  });

  test('year nav: addMonths(-12) crosses year', () => {
    const ref = new Date(2026, 4, 19);
    const prev = addMonths(ref, -12);
    const range = computePeriodRange('year', prev);
    expect(range!.label).toBe('2025');
  });

  test('all-time ignores ref', () => {
    expect(computePeriodRange('all', new Date(2026, 4, 19))).toBeNull();
  });
});
