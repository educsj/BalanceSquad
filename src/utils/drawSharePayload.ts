import { Pelada, DrawRecord, Team, Player } from '../types';

const FORMAT_TAG = 'balancesquad-draw';
const FORMAT_VERSION = 1;

// Wire format for a single draw, designed to be opened on another phone.
// Carries every detail needed to rebuild the draw: player identity (name +
// level + optional gender), the team composition and the source group context.
export interface DrawPayload {
  _format: typeof FORMAT_TAG;
  version: number;
  sourcePeladaName: string;
  playersPerTeam: number;
  timestamp: string;
  balanceByGender?: boolean;
  teams: Team[];
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
  };
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
  return obj as unknown as DrawPayload;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Builds a fresh Pelada from a payload, deduplicating players across teams by
// id (a player could only appear once anyway, but the dedup is defensive) and
// keeping their identity stable inside the new group so the draw history still
// references the same player ids.
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
