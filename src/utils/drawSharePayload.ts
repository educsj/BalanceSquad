import { Pelada, DrawRecord, Team, Player, Match, MatchResult } from '../types';

const FORMAT_TAG = 'balancesquad-draw';
const FORMAT_VERSION = 1;

// Wire format for a single draw, designed to be opened on another phone.
// Carries every detail needed to rebuild the draw: player identity (name +
// level + optional gender), team composition, source group context, and the
// session's recorded matches (so receivers see the full history too).
export interface DrawPayload {
  _format: typeof FORMAT_TAG;
  version: number;
  sourcePeladaName: string;
  playersPerTeam: number;
  timestamp: string;
  balanceByGender?: boolean;
  teams: Team[];
  matches?: Match[];
}

function copyMatch(m: Match): Match {
  return {
    id: m.id,
    timestamp: m.timestamp,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homePlayerIds: [...m.homePlayerIds],
    awayPlayerIds: [...m.awayPlayerIds],
    result: m.result,
    ...(m.goals && m.goals.length > 0 ? { goals: m.goals.map(g => ({ ...g })) } : {}),
    ...(m.mvpPlayerId ? { mvpPlayerId: m.mvpPlayerId } : {}),
  };
}

export function buildDrawPayload(
  record: DrawRecord,
  pelada: Pick<Pelada, 'name' | 'playersPerTeam'>,
): DrawPayload {
  return {
    _format: FORMAT_TAG,
    version: FORMAT_VERSION,
    sourcePeladaName: pelada.name,
    playersPerTeam: pelada.playersPerTeam,
    timestamp: record.timestamp,
    ...(record.balanceByGender ? { balanceByGender: true } : {}),
    teams: record.teams.map(t => ({
      id: t.id,
      name: t.name,
      totalStars: t.totalStars,
      players: t.players.map(p => ({
        id: p.id,
        name: p.name,
        level: p.level,
        ...(p.gender ? { gender: p.gender } : {}),
      })),
    })),
    ...(record.matches && record.matches.length > 0
      ? { matches: record.matches.map(copyMatch) }
      : {}),
  };
}

function isValidMatch(raw: unknown): raw is Match {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string') return false;
  if (typeof m.timestamp !== 'string') return false;
  if (typeof m.homeTeamId !== 'number') return false;
  if (typeof m.awayTeamId !== 'number') return false;
  if (!Array.isArray(m.homePlayerIds) || !m.homePlayerIds.every(x => typeof x === 'string')) return false;
  if (!Array.isArray(m.awayPlayerIds) || !m.awayPlayerIds.every(x => typeof x === 'string')) return false;
  const r = m.result as MatchResult | undefined;
  if (!r || typeof r !== 'object') return false;
  if (r.type === 'win') {
    if (r.winner !== 'home' && r.winner !== 'away') return false;
  } else if (r.type !== 'draw') {
    return false;
  }
  if (m.goals !== undefined) {
    if (!Array.isArray(m.goals)) return false;
    for (const g of m.goals) {
      if (!g || typeof g !== 'object') return false;
      const goal = g as Record<string, unknown>;
      if (typeof goal.playerId !== 'string') return false;
      if (typeof goal.count !== 'number') return false;
    }
  }
  if (m.mvpPlayerId !== undefined && typeof m.mvpPlayerId !== 'string') return false;
  return true;
}

// Type guard + structural validation: rejects anything that does not look like
// a draw payload we minted ourselves. Returns the validated payload or null.
export function parseDrawPayload(raw: string): DrawPayload | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj._format !== FORMAT_TAG) return null;
  if (typeof obj.sourcePeladaName !== 'string') return null;
  if (typeof obj.playersPerTeam !== 'number') return null;
  if (typeof obj.timestamp !== 'string') return null;
  if (!Array.isArray(obj.teams)) return null;
  for (const t of obj.teams) {
    if (!t || typeof t !== 'object') return null;
    const team = t as Record<string, unknown>;
    if (typeof team.id !== 'number') return null;
    if (typeof team.name !== 'string') return null;
    if (typeof team.totalStars !== 'number') return null;
    if (!Array.isArray(team.players)) return null;
    for (const p of team.players) {
      if (!p || typeof p !== 'object') return null;
      const pl = p as Record<string, unknown>;
      if (typeof pl.id !== 'string') return null;
      if (typeof pl.name !== 'string') return null;
      if (typeof pl.level !== 'number') return null;
      if (pl.gender !== undefined && pl.gender !== 'M' && pl.gender !== 'F') return null;
    }
  }
  if (obj.matches !== undefined) {
    if (!Array.isArray(obj.matches)) return null;
    if (!obj.matches.every(isValidMatch)) return null;
  }
  return obj as unknown as DrawPayload;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Builds a fresh Pelada from a payload, deduplicating players across teams by
// id and keeping their identity stable inside the new group so the imported
// matches still reference the same player ids.
export function payloadToPelada(payload: DrawPayload, importedSuffix: string): Pelada {
  const allPlayers = new Map<string, Player>();
  payload.teams.forEach(team => {
    team.players.forEach(p => {
      if (!allPlayers.has(p.id)) allPlayers.set(p.id, { ...p });
    });
  });

  const record: DrawRecord = {
    teams: payload.teams,
    timestamp: payload.timestamp || new Date().toISOString(),
    ...(payload.balanceByGender ? { balanceByGender: true } : {}),
    ...(payload.matches && payload.matches.length > 0
      ? { matches: payload.matches.map(copyMatch) }
      : {}),
  };

  return {
    id: generateId(),
    name: `${payload.sourcePeladaName} ${importedSuffix}`,
    playersPerTeam: payload.playersPerTeam,
    players: [...allPlayers.values()],
    drawHistory: [record],
  };
}

export function safeSlug(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'sorteio';
}
