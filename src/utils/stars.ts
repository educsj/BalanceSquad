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
