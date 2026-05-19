import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pelada, DrawRecord, Team, DrawResult, Match, PeladaSession, SessionStatus } from '../types';
import { applyRsvp, applyCancel, RsvpOutcome } from '../utils/sessions';

export type { RsvpOutcome } from '../utils/sessions';

const PELADAS_KEY = '@balancesquad:peladas';
const HIDE_RATINGS_KEY = '@balancesquad:hideRatings';
const LANGUAGE_KEY = '@balancesquad:language';
const THEME_MODE_KEY = '@balancesquad:themeMode';
const ONBOARDING_SEEN_KEY = '@balancesquad:onboardingSeen';
const DRAW_HISTORY_LIMIT = 20;

export type ThemeMode = 'system' | 'light' | 'dark';

function migratePelada(pelada: Pelada): Pelada {
  let migrated: Pelada = pelada;
  if (pelada.lastDraw && pelada.lastDraw.length > 0 && !pelada.drawHistory) {
    migrated = {
      ...pelada,
      drawHistory: [{ teams: pelada.lastDraw, timestamp: '' }],
      lastDraw: undefined,
    };
  } else {
    const { lastDraw: _removed, ...rest } = pelada;
    migrated = rest as Pelada;
  }
  // Ensure `sessions` is always an array — added in the Presença bundle.
  // Older peladas won't have this field; new screens depend on it being a list.
  if (!migrated.sessions) {
    migrated = { ...migrated, sessions: [] };
  }
  return migrated;
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

// ─── Sessions (Presença bundle) ──────────────────────────────────────────────
//
// Sessions are scheduled peladas with date/time, capacity, RSVPs and a
// waitlist. The lifecycle:
//
//   created (status='scheduled')
//     ↓ players RSVP (or fall into the waitlist when full)
//     ↓ organizer cancels someone → next in waitlist auto-promotes to rsvps
//     ↓ on game day, organizer runs the draw — linkSessionToDraw flips the
//       status to 'completed' and links to drawHistory[i]
//
// Sessions are stored per-pelada (Pelada.sessions[]) — keeps the AsyncStorage
// shape consistent and avoids a parallel "@balancesquad:sessions" key.

function newSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface CreateSessionInput {
  date: string;            // ISO date YYYY-MM-DD
  time?: string;
  maxPlayers: number;
  notes?: string;
}

export async function createSession(
  peladaId: string,
  input: CreateSessionInput,
): Promise<PeladaSession | null> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return null;
  const session: PeladaSession = {
    id: newSessionId(),
    date: input.date,
    time: input.time,
    maxPlayers: input.maxPlayers,
    rsvps: [],
    waitlist: [],
    status: 'scheduled',
    ...(input.notes ? { notes: input.notes } : {}),
  };
  const sessions = [...(pelada.sessions ?? []), session];
  await updatePelada({ ...pelada, sessions });
  return session;
}

async function updateSessionInternal(
  peladaId: string,
  sessionId: string,
  updater: (s: PeladaSession) => PeladaSession,
): Promise<PeladaSession | null> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return null;
  const sessions = pelada.sessions ?? [];
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx < 0) return null;
  const updated = updater(sessions[idx]);
  const next = sessions.map((s, i) => (i === idx ? updated : s));
  await updatePelada({ ...pelada, sessions: next });
  return updated;
}

export async function updateSession(
  peladaId: string,
  sessionId: string,
  patch: Partial<Omit<PeladaSession, 'id' | 'rsvps' | 'waitlist' | 'status' | 'drawHistoryIndex'>>,
): Promise<PeladaSession | null> {
  // Restricted patch — never overwrite the lifecycle fields by accident.
  return updateSessionInternal(peladaId, sessionId, s => ({ ...s, ...patch }));
}

export async function setSessionStatus(
  peladaId: string,
  sessionId: string,
  status: SessionStatus,
): Promise<PeladaSession | null> {
  return updateSessionInternal(peladaId, sessionId, s => ({ ...s, status }));
}

export async function removeSession(peladaId: string, sessionId: string): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const sessions = (pelada.sessions ?? []).filter(s => s.id !== sessionId);
  await updatePelada({ ...pelada, sessions });
}

// Adds a player to the session's rsvps if there's room, else to the waitlist.
// Returns what actually happened so the UI can show the right snackbar.
// 'not_found' means the session didn't exist (caller handles that).
export async function rsvpToSession(
  peladaId: string,
  sessionId: string,
  playerId: string,
): Promise<RsvpOutcome | 'not_found'> {
  let outcome: RsvpOutcome | 'not_found' = 'not_found';
  const result = await updateSessionInternal(peladaId, sessionId, s => {
    const r = applyRsvp(s, playerId);
    outcome = r.outcome;
    return r.session;
  });
  if (!result) return 'not_found';
  return outcome;
}

// Removes a player from the session. If they were confirmed and the waitlist
// is non-empty, auto-promotes the first person in the waitlist to rsvps.
// Idempotent — calling on a non-RSVPd player is a no-op.
export async function cancelRsvp(
  peladaId: string,
  sessionId: string,
  playerId: string,
): Promise<void> {
  await updateSessionInternal(peladaId, sessionId, s => applyCancel(s, playerId));
}

// Called by the draw flow when a session "goes live" — links it to the
// drawHistory entry that just got created and flips the status to completed.
export async function linkSessionToDraw(
  peladaId: string,
  sessionId: string,
  drawHistoryIndex: number,
): Promise<void> {
  await updateSessionInternal(peladaId, sessionId, s => ({
    ...s,
    drawHistoryIndex,
    status: 'completed',
  }));
}

// ─── Preferences ─────────────────────────────────────────────────────────────

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

export async function getOnboardingSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
  return raw === 'true';
}

export async function setOnboardingSeen(value: boolean): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, value ? 'true' : 'false');
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
