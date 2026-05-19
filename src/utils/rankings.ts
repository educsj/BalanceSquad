import { Pelada, DrawRecord, Match } from '../types';
import { PeriodRange, isInPeriod } from './periods';

export interface PlayerStat {
  id: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export interface ScorerStat {
  id: string;
  name: string;
  goals: number;
  matches: number;
  perMatch: number;
}

export interface MvpStat {
  id: string;
  name: string;
  count: number;
}

export interface TeamChampionEntry {
  recordIndex: number;
  recordTimestamp: string;
  teamId: number;
  teamName: string;
  wins: number;
  totalMatches: number;
}

interface RawData {
  // Player name lookup that prefers the most recent appearance — keeps team
  // renames and player renames behaving naturally.
  names: Map<string, string>;
  // Matches that fall inside the period, paired with their parent record for
  // context (we need teams[] to translate teamId -> name in some views).
  matches: { match: Match; record: DrawRecord; recordIndex: number }[];
}

function collectMatches(pelada: Pelada, range: PeriodRange | null): RawData {
  const names = new Map<string, string>();
  pelada.players.forEach(p => names.set(p.id, p.name));

  const out: RawData = { names, matches: [] };
  const history = pelada.drawHistory ?? [];
  for (let i = 0; i < history.length; i++) {
    const record = history[i];
    record.teams.forEach(t => t.players.forEach(p => {
      if (!names.has(p.id)) names.set(p.id, p.name);
    }));
    for (const m of record.matches ?? []) {
      if (!isInPeriod(m.timestamp, range)) continue;
      out.matches.push({ match: m, record, recordIndex: i });
    }
  }
  return out;
}

export function aggregatePlayerStats(pelada: Pelada, range: PeriodRange | null): PlayerStat[] {
  const data = collectMatches(pelada, range);
  const counters = new Map<string, { played: number; wins: number; draws: number; losses: number }>();
  const ensure = (id: string) => {
    if (!counters.has(id)) counters.set(id, { played: 0, wins: 0, draws: 0, losses: 0 });
    return counters.get(id)!;
  };

  for (const { match: m } of data.matches) {
    const homeWon = m.result.type === 'win' && m.result.winner === 'home';
    const awayWon = m.result.type === 'win' && m.result.winner === 'away';
    m.homePlayerIds.forEach(id => {
      const c = ensure(id);
      c.played++;
      if (m.result.type === 'draw') c.draws++;
      else if (homeWon) c.wins++;
      else c.losses++;
    });
    m.awayPlayerIds.forEach(id => {
      const c = ensure(id);
      c.played++;
      if (m.result.type === 'draw') c.draws++;
      else if (awayWon) c.wins++;
      else c.losses++;
    });
  }

  const out: PlayerStat[] = [];
  counters.forEach((c, id) => {
    out.push({
      id,
      name: data.names.get(id) ?? '—',
      played: c.played,
      wins: c.wins,
      draws: c.draws,
      losses: c.losses,
      winRate: c.played === 0 ? 0 : c.wins / c.played,
    });
  });
  out.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.played - a.played;
  });
  return out;
}

export function aggregateScorers(pelada: Pelada, range: PeriodRange | null): ScorerStat[] {
  const data = collectMatches(pelada, range);
  const goals = new Map<string, number>();
  const appearances = new Map<string, number>();
  for (const { match: m } of data.matches) {
    [...m.homePlayerIds, ...m.awayPlayerIds].forEach(id => {
      appearances.set(id, (appearances.get(id) ?? 0) + 1);
    });
    (m.goals ?? []).forEach(g => {
      goals.set(g.playerId, (goals.get(g.playerId) ?? 0) + g.count);
    });
  }
  const out: ScorerStat[] = [];
  goals.forEach((count, id) => {
    const matches = appearances.get(id) ?? 0;
    out.push({
      id,
      name: data.names.get(id) ?? '—',
      goals: count,
      matches,
      perMatch: matches === 0 ? 0 : count / matches,
    });
  });
  out.sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.perMatch !== a.perMatch) return b.perMatch - a.perMatch;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function aggregateMvps(pelada: Pelada, range: PeriodRange | null): MvpStat[] {
  const data = collectMatches(pelada, range);
  const counts = new Map<string, number>();
  for (const { match: m } of data.matches) {
    if (!m.mvpPlayerId) continue;
    counts.set(m.mvpPlayerId, (counts.get(m.mvpPlayerId) ?? 0) + 1);
  }
  const out: MvpStat[] = [];
  counts.forEach((count, id) => {
    out.push({ id, name: data.names.get(id) ?? '—', count });
  });
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return out;
}

// One champion per sortition: the team that won the most matches inside that
// sorteio's match list. Ties broken by team id (deterministic).
export function aggregateTeamChampions(
  pelada: Pelada,
  range: PeriodRange | null,
): TeamChampionEntry[] {
  const history = pelada.drawHistory ?? [];
  const out: TeamChampionEntry[] = [];
  for (let i = 0; i < history.length; i++) {
    const record = history[i];
    const inPeriod = (record.matches ?? []).filter(m => isInPeriod(m.timestamp, range));
    if (inPeriod.length === 0) continue;
    const winsByTeam = new Map<number, number>();
    for (const m of inPeriod) {
      if (m.result.type === 'win') {
        const winnerId = m.result.winner === 'home' ? m.homeTeamId : m.awayTeamId;
        winsByTeam.set(winnerId, (winsByTeam.get(winnerId) ?? 0) + 1);
      }
    }
    if (winsByTeam.size === 0) continue;
    let bestId = -1;
    let bestWins = -1;
    winsByTeam.forEach((wins, id) => {
      if (wins > bestWins || (wins === bestWins && id < bestId)) {
        bestId = id;
        bestWins = wins;
      }
    });
    const team = record.teams.find(t => t.id === bestId);
    if (!team) continue;
    out.push({
      recordIndex: i,
      recordTimestamp: record.timestamp,
      teamId: team.id,
      teamName: team.name,
      wins: bestWins,
      totalMatches: inPeriod.length,
    });
  }
  out.sort((a, b) => b.wins - a.wins || a.recordIndex - b.recordIndex);
  return out;
}

export function periodMatchCount(pelada: Pelada, range: PeriodRange | null): number {
  return collectMatches(pelada, range).matches.length;
}

export interface PlayerProfileMatch {
  matchId: string;
  timestamp: string;
  side: 'home' | 'away';
  opponent: 'home' | 'away';
  outcome: 'win' | 'loss' | 'draw';
  goalsScored: number;
  wasMvp: boolean;
  teammates: string[]; // player ids on the same side (excluding self)
  opponents: string[]; // player ids on the other side
}

export interface PlayerProfile {
  id: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  mvps: number;
  matches: PlayerProfileMatch[];
  // Head-to-head: against another player, how many times was the current player
  // on the winning side vs that opponent? Includes draws.
  headToHead: { id: string; name: string; played: number; wins: number; draws: number; losses: number }[];
  // Teammates: how often did the current player team up with someone, and
  // what was the win rate of those joint matches?
  teammates: { id: string; name: string; played: number; wins: number }[];
}

export function buildPlayerProfile(
  pelada: Pelada,
  playerId: string,
  range: PeriodRange | null,
): PlayerProfile | null {
  const data = collectMatches(pelada, range);
  const name = data.names.get(playerId);
  if (!name) return null;

  const profile: PlayerProfile = {
    id: playerId,
    name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    mvps: 0,
    matches: [],
    headToHead: [],
    teammates: [],
  };

  const h2hMap = new Map<string, { played: number; wins: number; draws: number; losses: number }>();
  const teammateMap = new Map<string, { played: number; wins: number }>();
  const ensureH2H = (id: string) => {
    if (!h2hMap.has(id)) h2hMap.set(id, { played: 0, wins: 0, draws: 0, losses: 0 });
    return h2hMap.get(id)!;
  };
  const ensureTm = (id: string) => {
    if (!teammateMap.has(id)) teammateMap.set(id, { played: 0, wins: 0 });
    return teammateMap.get(id)!;
  };

  for (const { match: m } of data.matches) {
    let side: 'home' | 'away' | null = null;
    if (m.homePlayerIds.includes(playerId)) side = 'home';
    else if (m.awayPlayerIds.includes(playerId)) side = 'away';
    if (!side) continue;

    profile.played++;
    const wonSide = m.result.type === 'win' ? m.result.winner : null;
    const outcome: 'win' | 'loss' | 'draw' =
      m.result.type === 'draw' ? 'draw' : (wonSide === side ? 'win' : 'loss');
    if (outcome === 'win') profile.wins++;
    else if (outcome === 'draw') profile.draws++;
    else profile.losses++;

    if (m.mvpPlayerId === playerId) profile.mvps++;
    if (m.goals) {
      const g = m.goals.find(x => x.playerId === playerId);
      if (g) profile.goals += g.count;
    }

    const sameSide = side === 'home' ? m.homePlayerIds : m.awayPlayerIds;
    const otherSide = side === 'home' ? m.awayPlayerIds : m.homePlayerIds;

    sameSide.forEach(pid => {
      if (pid === playerId) return;
      const tm = ensureTm(pid);
      tm.played++;
      if (outcome === 'win') tm.wins++;
    });

    otherSide.forEach(pid => {
      const h = ensureH2H(pid);
      h.played++;
      if (outcome === 'win') h.wins++;
      else if (outcome === 'draw') h.draws++;
      else h.losses++;
    });

    profile.matches.push({
      matchId: m.id,
      timestamp: m.timestamp,
      side,
      opponent: side === 'home' ? 'away' : 'home',
      outcome,
      goalsScored: m.goals?.find(x => x.playerId === playerId)?.count ?? 0,
      wasMvp: m.mvpPlayerId === playerId,
      teammates: sameSide.filter(p => p !== playerId),
      opponents: otherSide,
    });
  }

  h2hMap.forEach((v, id) => {
    profile.headToHead.push({ id, name: data.names.get(id) ?? '—', ...v });
  });
  teammateMap.forEach((v, id) => {
    profile.teammates.push({ id, name: data.names.get(id) ?? '—', ...v });
  });

  profile.headToHead.sort((a, b) => b.played - a.played);
  profile.teammates.sort((a, b) => b.played - a.played);
  profile.matches.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));

  return profile;
}
