import { buildDrawPayload, parseDrawPayload, payloadToPelada } from '../drawSharePayload';
import { DrawRecord } from '../../types';

const record: DrawRecord = {
  timestamp: '2026-05-18T12:00:00.000Z',
  balanceByGender: true,
  teams: [
    {
      id: 1, name: 'Time 1', totalStars: 9.5,
      players: [
        { id: 'a', name: 'João',  level: 4.5, gender: 'M' },
        { id: 'b', name: 'Maria', level: 5,   gender: 'F' },
      ],
    },
    {
      id: 2, name: 'Time 2', totalStars: 6,
      players: [
        { id: 'c', name: 'Pedro', level: 3 },
        { id: 'd', name: 'Ana',   level: 3,   gender: 'F' },
      ],
    },
  ],
};

describe('drawShare', () => {
  test('build → JSON → parse round-trip preserves data', () => {
    const payload = buildDrawPayload(record, { name: 'Pelada Teste', playersPerTeam: 4 });
    const json = JSON.stringify(payload);
    const parsed = parseDrawPayload(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.sourcePeladaName).toBe('Pelada Teste');
    expect(parsed!.playersPerTeam).toBe(4);
    expect(parsed!.balanceByGender).toBe(true);
    expect(parsed!.teams).toHaveLength(2);
    expect(parsed!.teams[0].players[0]).toMatchObject({ name: 'João', level: 4.5, gender: 'M' });
    expect(parsed!.teams[1].players[0].gender).toBeUndefined();
  });

  test('parseDrawPayload rejects non-balancesquad json', () => {
    expect(parseDrawPayload('{}')).toBeNull();
    expect(parseDrawPayload('not-json')).toBeNull();
    expect(parseDrawPayload(JSON.stringify({ _format: 'other', teams: [] }))).toBeNull();
    expect(parseDrawPayload(JSON.stringify({
      _format: 'balancesquad-draw',
      version: 1,
      sourcePeladaName: 'x',
      playersPerTeam: 5,
      timestamp: 't',
      teams: [{ id: 1, name: 'T1', totalStars: 0, players: [{ id: 'a', name: 'a', level: 3, gender: 'X' }] }],
    }))).toBeNull();
  });

  test('payloadToPelada builds a fresh pelada with players and the draw in history', () => {
    const payload = buildDrawPayload(record, { name: 'Origem', playersPerTeam: 4 });
    const pelada = payloadToPelada(payload, '(importado)');
    expect(pelada.name).toBe('Origem (importado)');
    expect(pelada.playersPerTeam).toBe(4);
    expect(pelada.players).toHaveLength(4);
    expect(pelada.players.map(p => p.name).sort()).toEqual(['Ana', 'João', 'Maria', 'Pedro']);
    expect(pelada.drawHistory).toHaveLength(1);
    expect(pelada.drawHistory![0].balanceByGender).toBe(true);
  });
});
