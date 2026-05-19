// Pure helpers extracted from notifications.ts so they're unit-testable
// without pulling in the expo-notifications SDK (Jest can't transpile its
// ESM exports). The SDK-backed wrappers live in notifications.ts.

// Computes the Date the session reminder should fire at. Returns null when:
//   - the session has no time set (no point firing without a precise hour)
//   - the resulting trigger has already passed
//   - the inputs are malformed
//
// `now` is injectable for deterministic tests.
export function computeSessionTrigger(
  date: string,             // YYYY-MM-DD
  time: string | undefined, // HH:mm or undefined
  leadHours: number,
  now: Date = new Date(),
): Date | null {
  if (!time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if ([year, month, day, hh, mm].some(n => !Number.isFinite(n))) return null;
  const sessionAt = new Date(year, month - 1, day, hh, mm, 0, 0);
  const trigger = new Date(sessionAt.getTime() - leadHours * 60 * 60 * 1000);
  if (trigger.getTime() <= now.getTime()) return null;
  return trigger;
}

// Maps a leadHours value to a coarse-grained title key the i18n layer can use
// to localize ("amanhã" / "hoje" / "em Xh"). Pure for testability.
export function titleKeyForLead(leadHours: number): 'tomorrow' | 'today' | 'soon' {
  if (leadHours >= 24) return 'tomorrow';
  if (leadHours >= 4) return 'today';
  return 'soon';
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
