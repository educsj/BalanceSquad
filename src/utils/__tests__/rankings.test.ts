import {
  aggregatePlayerStats,
  aggregateScorers,
  aggregateMvps,
  aggregateTeamChampions,
  periodMatchCount,
} from '../rankings';
import { Pelada, Match, DrawRecord, Player } from '../../types';
import { computePeriodRange, isInPeriod, PeriodKind } from '../periods';

function pl(id: string, name: string): Player {
  return { id, name, level: 3 };
}

function makeMatch(
  id: string,
  timestamp: string,
  homeIds: string[],
  awayIds: string[],
  result: Match['result'],
  goals?: { playerId: string; count: number }[],
  mvp?: string,
): Match {
  return {
    id,
    timestamp,
    homeTeamId: 1,
    awayTeamId: 2,
    homePlayerIds: homeIds,
    awayPlayerIds: awayIds,
    result,
    ...(goals ? { goals } : {}),
    ...(mvp ? { mvpPlayerId: mvp } : {}),
  };
}

function makePelada(records: DrawRecord[]): Pelada {
  return {
    id: 'p1',
    name: 'Test',
    playersPerTeam: 3,
    players: [pl('a', 'Alice'), pl('b', 'Bob'), pl('c', 'Carol'), pl('d', 'Dave')],
    drawHistory: records,
  };
}

function makeRecord(matches: Match[], timestamp: string): DrawRecord {
  return {
    timestamp,
    teams: [
      { id: 1, name: 'T1', players: [pl('a', 'Alice'), pl('b', 'Bob')], totalStars: 6 },
      { id: 2, name: 'T2', players: [pl('c', 'Carol'), pl('d', 'Dave')], totalStars: 6 },
    ],
    matches,
  };
}

describe('aggregatePlayerStats', () => {
  test('soma V/E/D pelo lineup real, não pelo time original', () => {
    const m1 = makeMatch('m1', '2026-05-10T12:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'home' });
    // Alice trocou para o lado away na partida 2
    const m2 = makeMatch('m2', '2026-05-10T13:00:00Z',
      ['b'], ['c', 'a'],
      { type: 'win', winner: 'away' });
    const pelada = makePelada([makeRecord([m1, m2], '2026-05-10T11:00:00Z')]);
    const stats = aggregatePlayerStats(pelada, null);

    const alice = stats.find(s => s.id === 'a')!;
    expect(alice.played).toBe(2);
    expect(alice.wins).toBe(2);
    expect(alice.losses).toBe(0);

    const bob = stats.find(s => s.id === 'b')!;
    expect(bob.played).toBe(2);
    expect(bob.wins).toBe(1);
    expect(bob.losses).toBe(1);
  });
});

describe('aggregateScorers', () => {
  test('soma gols por jogador através de partidas', () => {
    const m1 = makeMatch('m1', '2026-05-10T12:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'home' },
      [{ playerId: 'a', count: 2 }, { playerId: 'd', count: 1 }]);
    const m2 = makeMatch('m2', '2026-05-10T13:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'draw' },
      [{ playerId: 'a', count: 1 }]);
    const pelada = makePelada([makeRecord([m1, m2], '2026-05-10T11:00:00Z')]);
    const scorers = aggregateScorers(pelada, null);

    expect(scorers[0]).toMatchObject({ id: 'a', goals: 3 });
    expect(scorers.find(s => s.id === 'd')).toMatchObject({ goals: 1 });
    expect(scorers.find(s => s.id === 'b')).toBeUndefined(); // sem gols
  });
});

describe('aggregateMvps', () => {
  test('conta MVPs por jogador', () => {
    const m1 = makeMatch('m1', '2026-05-10T12:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'home' }, undefined, 'a');
    const m2 = makeMatch('m2', '2026-05-10T13:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'draw' }, undefined, 'a');
    const m3 = makeMatch('m3', '2026-05-10T14:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'away' }, undefined, 'c');
    const pelada = makePelada([makeRecord([m1, m2, m3], '2026-05-10T11:00:00Z')]);
    const mvps = aggregateMvps(pelada, null);

    expect(mvps[0]).toMatchObject({ id: 'a', count: 2 });
    expect(mvps[1]).toMatchObject({ id: 'c', count: 1 });
  });
});

describe('aggregateTeamChampions', () => {
  test('elege o time vencedor de cada sorteio (mais vitórias)', () => {
    const m1 = makeMatch('m1', '2026-05-10T12:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'home' });
    const m2 = makeMatch('m2', '2026-05-10T13:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'home' });
    const m3 = makeMatch('m3', '2026-05-10T14:00:00Z',
      ['a', 'b'], ['c', 'd'],
      { type: 'win', winner: 'away' });
    const pelada = makePelada([makeRecord([m1, m2, m3], '2026-05-10T11:00:00Z')]);
    const champs = aggregateTeamChampions(pelada, null);

    expect(champs).toHaveLength(1);
    expect(champs[0].teamId).toBe(1);
    expect(champs[0].wins).toBe(2);
    expect(champs[0].totalMatches).toBe(3);
  });
});

describe('period filter', () => {
  test('mês corta partidas fora do intervalo', () => {
    const inside = makeMatch('mi', '2026-05-15T12:00:00Z',
      ['a'], ['b'], { type: 'win', winner: 'home' });
    const outside = makeMatch('mo', '2026-04-15T12:00:00Z',
      ['a'], ['b'], { type: 'win', winner: 'home' });
    const pelada = makePelada([makeRecord([inside, outside], '2026-05-15T11:00:00Z')]);

    // ref date 15/05/2026 → mês de maio
    const range = computePeriodRange('month', new Date('2026-05-15T12:00:00Z'));
    expect(isInPeriod(inside.timestamp, range)).toBe(true);
    expect(isInPeriod(outside.timestamp, range)).toBe(false);
    expect(periodMatchCount(pelada, range)).toBe(1);
  });

  test('"all" não filtra nada', () => {
    const inside = makeMatch('mi', '2020-01-01T12:00:00Z',
      ['a'], ['b'], { type: 'win', winner: 'home' });
    const pelada = makePelada([makeRecord([inside], '2020-01-01T11:00:00Z')]);
    expect(computePeriodRange('all')).toBeNull();
    expect(periodMatchCount(pelada, null)).toBe(1);
  });

  test('todas as PeriodKind retornam range válido (exceto "all")', () => {
    const kinds: PeriodKind[] = ['week', 'month', 'quarter', 'semester', 'year'];
    for (const k of kinds) {
      const r = computePeriodRange(k, new Date('2026-05-15T12:00:00Z'));
      expect(r).not.toBeNull();
      expect(r!.startIso < r!.endIso).toBe(true);
    }
  });
});
