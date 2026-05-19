import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pelada, DrawRecord, Team, DrawResult, Match } from '../types';

const PELADAS_KEY = '@balancesquad:peladas';
const HIDE_RATINGS_KEY = '@balancesquad:hideRatings';
const LANGUAGE_KEY = '@balancesquad:language';
const THEME_MODE_KEY = '@balancesquad:themeMode';
const DRAW_HISTORY_LIMIT = 20;

export type ThemeMode = 'system' | 'light' | 'dark';

function migratePelada(pelada: Pelada): Pelada {
  if (pelada.lastDraw && pelada.lastDraw.length > 0 && !pelada.drawHistory) {
    return {
      ...pelada,
      drawHistory: [{ teams: pelada.lastDraw, timestamp: '' }],
      lastDraw: undefined,
    };
  }
  const { lastDraw: _removed, ...rest } = pelada;
  return rest as Pelada;
}

export async function loadPeladas(): Promise<Pelada[]> {
  const raw = await AsyncStorage.getItem(PELADAS_KEY);
  if (!raw) return [];
  const peladas: Pelada[] = JSON.parse(raw);
  return peladas.map(migratePelada);
}

export async function savePeladas(peladas: Pelada[]): Promise<void> {
  await AsyncStorage.setItem(PELADAS_KEY, JSON.stringify(peladas));
}

export async function getPeladaById(id: string): Promise<Pelada | undefined> {
  const peladas = await loadPeladas();
  return peladas.find(p => p.id === id);
}

export async function updatePelada(updated: Pelada): Promise<void> {
  const peladas = await loadPeladas();
  await savePeladas(peladas.map(p => (p.id === updated.id ? updated : p)));
}

export async function addDrawRecord(
  peladaId: string,
  teams: Team[],
  meta?: { balanceByGender?: boolean },
): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const record: DrawRecord = {
    teams,
    timestamp: new Date().toISOString(),
    ...(meta?.balanceByGender ? { balanceByGender: true } : {}),
  };
  const history = [record, ...(pelada.drawHistory ?? [])].slice(0, DRAW_HISTORY_LIMIT);
  await updatePelada({ ...pelada, drawHistory: history });
}

async function updateRecord(
  peladaId: string,
  index: number,
  updater: (r: DrawRecord) => DrawRecord,
): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const history = pelada.drawHistory ?? [];
  if (index >= history.length) return;
  const updated: DrawRecord[] = history.map((r, i) => i === index ? updater(r) : r);
  await updatePelada({ ...pelada, drawHistory: updated });
}

export async function addMatch(
  peladaId: string,
  historyIndex: number,
  match: Match,
): Promise<void> {
  await updateRecord(peladaId, historyIndex, r => ({
    ...r,
    matches: [...(r.matches ?? []), match],
  }));
}

export async function updateMatch(
  peladaId: string,
  historyIndex: number,
  match: Match,
): Promise<void> {
  await updateRecord(peladaId, historyIndex, r => ({
    ...r,
    matches: (r.matches ?? []).map(m => m.id === match.id ? match : m),
  }));
}

export async function removeMatch(
  peladaId: string,
  historyIndex: number,
  matchId: string,
): Promise<void> {
  await updateRecord(peladaId, historyIndex, r => ({
    ...r,
    matches: (r.matches ?? []).filter(m => m.id !== matchId),
  }));
}

export async function setDrawResult(
  peladaId: string,
  index: number,
  result: DrawResult | undefined,
): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const history = pelada.drawHistory ?? [];
  if (index >= history.length) return;
  const updated: DrawRecord[] = history.map((r, i) => {
    if (i !== index) return r;
    if (!result) {
      const { result: _omit, ...rest } = r;
      return rest as DrawRecord;
    }
    return { ...r, result };
  });
  await updatePelada({ ...pelada, drawHistory: updated });
}

export async function updateDrawRecord(peladaId: string, teams: Team[], index = 0): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const history = pelada.drawHistory ?? [];
  if (index >= history.length) return;
  const updated: DrawRecord[] = history.map((r, i) => i === index ? { ...r, teams } : r);
  await updatePelada({ ...pelada, drawHistory: updated });
}

export async function getHideRatings(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HIDE_RATINGS_KEY);
  return raw === 'true';
}

export async function setHideRatings(value: boolean): Promise<void> {
  await AsyncStorage.setItem(HIDE_RATINGS_KEY, value ? 'true' : 'false');
}

export async function getLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_KEY);
}

export async function setLanguage(lang: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export async function getThemeMode(): Promise<ThemeMode> {
  const raw = await AsyncStorage.getItem(THEME_MODE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(THEME_MODE_KEY, mode);
}

export async function exportData(): Promise<string> {
  const peladas = await loadPeladas();
  const hideRatings = await getHideRatings();
  return JSON.stringify({ peladas, hideRatings, exportedAt: new Date().toISOString() }, null, 2);
}

interface BackupData {
  peladas: Pelada[];
  hideRatings?: boolean;
}

// Rejects malformed JSON before it can land in AsyncStorage and brick the app.
// Mirrors the strictness of parseDrawPayload — every required field is shape-
// checked. Returns null on any deviation.
export function parseBackupData(jsonString: string): BackupData | null {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.peladas)) return null;

  for (const p of obj.peladas) {
    if (!p || typeof p !== 'object') return null;
    const pelada = p as Record<string, unknown>;
    if (typeof pelada.id !== 'string') return null;
    if (typeof pelada.name !== 'string') return null;
    if (typeof pelada.playersPerTeam !== 'number') return null;
    if (!Array.isArray(pelada.players)) return null;
    for (const pl of pelada.players) {
      if (!pl || typeof pl !== 'object') return null;
      const player = pl as Record<string, unknown>;
      if (typeof player.id !== 'string') return null;
      if (typeof player.name !== 'string') return null;
      if (typeof player.level !== 'number') return null;
      if (player.gender !== undefined && player.gender !== 'M' && player.gender !== 'F') return null;
    }
    if (pelada.drawHistory !== undefined && !Array.isArray(pelada.drawHistory)) return null;
  }

  const result: BackupData = { peladas: obj.peladas as Pelada[] };
  if (typeof obj.hideRatings === 'boolean') result.hideRatings = obj.hideRatings;
  return result;
}

export async function importData(jsonString: string): Promise<boolean> {
  const parsed = parseBackupData(jsonString);
  if (!parsed) return false;
  await savePeladas(parsed.peladas.map(migratePelada));
  if (parsed.hideRatings !== undefined) await setHideRatings(parsed.hideRatings);
  return true;
}
