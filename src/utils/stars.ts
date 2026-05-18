// Renders 4 → "4", 4.5 → "4.5". Avoids "4.0" / "4.50" noise.
export function formatStars(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function clampLevel(v: number): number {
  if (v < 0.5) return 0.5;
  if (v > 5) return 5;
  return Math.round(v * 2) / 2;
}

// Average rating per player on the team. totalStars stays the sum (storage
// representation), but UI shows the more meaningful per-player average so
// teams of different sizes are comparable.
export function teamAverage(team: { players: unknown[]; totalStars: number }): number {
  if (team.players.length === 0) return 0;
  return team.totalStars / team.players.length;
}
