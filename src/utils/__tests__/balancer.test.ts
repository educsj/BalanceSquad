import { balanceTeams, rematchTwoTeams } from '../balancer';
import { Player, Team } from '../../types';

// ─── helpers ────────────────────────────────────────────────────────────────

function p(id: string, level: number, gender?: 'M' | 'F'): Player {
  return { id, name: `Player ${id}`, level, gender };
}

function players(count: number, level: number = 3): Player[] {
  return Array.from({ length: count }, (_, i) => p(String(i + 1), level));
}

function teamWith(id: number, ps: Player[]): Team {
  return {
    id,
    name: `Time ${id}`,
    players: ps,
    totalStars: ps.reduce((s, x) => s + x.level, 0),
  };
}

function totalPlayerCount(teams: Team[]): number {
  return teams.reduce((s, t) => s + t.players.length, 0);
}

function allPlayerIds(teams: Team[]): string[] {
  return teams.flatMap(t => t.players.map(x => x.id));
}

function mainSpread(teams: Team[], numTeams: number): number {
  const stars = teams.slice(0, numTeams).map(t => t.totalStars);
  return Math.max(...stars) - Math.min(...stars);
}

// ─── balanceTeams ────────────────────────────────────────────────────────────

describe('balanceTeams', () => {
  describe('team count and structure', () => {
    test('exact fit: returns exactly numTeams', () => {
      expect(balanceTeams(players(10), 2, 5)).toHaveLength(2);
      expect(balanceTeams(players(9), 3, 3)).toHaveLength(3);
    });

    test('overflow: creates one extra team with remaining players', () => {
      // Math.ceil(12 / 5) = 3 — 2 main teams + 1 overflow
      const result = balanceTeams(players(12), 2, 5);
      expect(result).toHaveLength(3);
    });

    test('teams are numbered from 1', () => {
      const result = balanceTeams(players(6), 2, 3);
      expect(result[0]).toMatchObject({ id: 1, name: 'Time 1' });
      expect(result[1]).toMatchObject({ id: 2, name: 'Time 2' });
    });
  });

  describe('player integrity', () => {
    test('no players are lost', () => {
      const ps = players(10);
      const result = balanceTeams(ps, 2, 5);
      expect(totalPlayerCount(result)).toBe(10);
    });

    test('no players are duplicated', () => {
      const ps = players(10);
      const result = balanceTeams(ps, 2, 5);
      const ids = allPlayerIds(result);
      expect(new Set(ids).size).toBe(10);
    });

    test('every input player appears exactly once', () => {
      const ps = players(9);
      const result = balanceTeams(ps, 3, 3);
      const ids = allPlayerIds(result);
      ps.forEach(player => expect(ids).toContain(player.id));
    });
  });

  describe('team sizes', () => {
    test('main teams fill to playersPerTeam before overflow receives anyone', () => {
      // 12 players, 2 main teams of 5 → 2 players overflow
      const result = balanceTeams(players(12), 2, 5);
      expect(result[0].players).toHaveLength(5);
      expect(result[1].players).toHaveLength(5);
      expect(result[2].players).toHaveLength(2);
    });

    test('single-player overflow when 1 player exceeds slots', () => {
      // 11 players, 2 teams of 5 → Math.ceil(11/5)=3, overflow gets 1
      const result = balanceTeams(players(11), 2, 5);
      expect(result).toHaveLength(3);
      expect(result[2].players).toHaveLength(1);
    });
  });

  describe('totalStars accounting', () => {
    test("each team's totalStars equals the sum of its players' levels", () => {
      const ps = [p('a', 5), p('b', 4), p('c', 3), p('d', 2), p('e', 1), p('f', 3)];
      const result = balanceTeams(ps, 2, 3);
      result.forEach(team => {
        const expected = team.players.reduce((s, x) => s + x.level, 0);
        expect(team.totalStars).toBe(expected);
      });
    });
  });

  describe('balance quality', () => {
    test('uniform skill: 2 teams have identical star totals (spread = 0)', () => {
      // All level-3, 2 teams of 3 → each team gets 9 stars
      const result = balanceTeams(players(6, 3), 2, 3);
      expect(mainSpread(result, 2)).toBe(0);
    });

    test('uniform skill: 3 teams have identical star totals (spread = 0)', () => {
      const result = balanceTeams(players(9, 3), 3, 3);
      expect(mainSpread(result, 3)).toBe(0);
    });

    test('mixed skill: spread is minimised — no single swap between main teams reduces it', () => {
      // Symmetric pairs at each level → optimizer must converge to spread = 0
      const ps = [
        p('1', 5), p('2', 5),
        p('3', 4), p('4', 4),
        p('5', 3), p('6', 3),
        p('7', 2), p('8', 2),
      ];
      const result = balanceTeams(ps, 2, 4);
      const current = mainSpread(result, 2);

      // Post-condition: no swap between teams[0] and teams[1] reduces spread further
      const [t0, t1] = result;
      for (let i = 0; i < t0.players.length; i++) {
        for (let j = 0; j < t1.players.length; j++) {
          const lvlI = t0.players[i].level;
          const lvlJ = t1.players[j].level;
          if (lvlI === lvlJ) continue;
          const newSpread = Math.abs(
            (t0.totalStars - lvlI + lvlJ) - (t1.totalStars - lvlJ + lvlI),
          );
          expect(newSpread).toBeGreaterThanOrEqual(current);
        }
      }
    });

    test('mixed skill: 3 teams — no single swap between any pair reduces spread further', () => {
      const ps = [
        p('1', 5), p('2', 5), p('3', 5),
        p('4', 2), p('5', 2), p('6', 2),
        p('7', 4), p('8', 4), p('9', 4),
      ];
      const result = balanceTeams(ps, 3, 3);
      const numTeams = 3;
      const mainStars = result.slice(0, numTeams).map(t => t.totalStars);
      const current = Math.max(...mainStars) - Math.min(...mainStars);

      for (let ti = 0; ti < numTeams - 1; ti++) {
        for (let tj = ti + 1; tj < numTeams; tj++) {
          for (let pi = 0; pi < result[ti].players.length; pi++) {
            for (let pj = 0; pj < result[tj].players.length; pj++) {
              const lvlI = result[ti].players[pi].level;
              const lvlJ = result[tj].players[pj].level;
              if (lvlI === lvlJ) continue;
              const newStars = mainStars.map((s, k) =>
                k === ti ? s - lvlI + lvlJ : k === tj ? s - lvlJ + lvlI : s,
              );
              const newSpread = Math.max(...newStars) - Math.min(...newStars);
              expect(newSpread).toBeGreaterThanOrEqual(current);
            }
          }
        }
      }
    });
  });
});

// ─── half-star levels ────────────────────────────────────────────────────────

describe('balanceTeams with fractional levels', () => {
  test('handles 0.5-step levels without crashing', () => {
    const ps = [
      p('1', 4.5), p('2', 3.5), p('3', 2.5), p('4', 1.5),
      p('5', 4),   p('6', 3),   p('7', 2),   p('8', 1),
    ];
    const result = balanceTeams(ps, 2, 4);
    expect(totalPlayerCount(result)).toBe(8);
    const sumLevels = ps.reduce((s, x) => s + x.level, 0);
    const sumStars  = result.reduce((s, t) => s + t.totalStars, 0);
    expect(sumStars).toBeCloseTo(sumLevels, 5);
  });

  test('symmetric half-star pairs produce zero spread', () => {
    const ps = [
      p('1', 4.5), p('2', 4.5),
      p('3', 3.5), p('4', 3.5),
      p('5', 2.5), p('6', 2.5),
    ];
    const result = balanceTeams(ps, 2, 3);
    expect(mainSpread(result, 2)).toBeCloseTo(0, 5);
  });
});

// ─── gender balancing ────────────────────────────────────────────────────────

describe('balanceTeams with balanceByGender option', () => {
  test('distributes males and females proportionally across teams', () => {
    const ps = [
      p('m1', 3, 'M'), p('m2', 3, 'M'), p('m3', 3, 'M'), p('m4', 3, 'M'),
      p('m5', 3, 'M'), p('m6', 3, 'M'), p('m7', 3, 'M'), p('m8', 3, 'M'),
      p('f1', 3, 'F'), p('f2', 3, 'F'), p('f3', 3, 'F'), p('f4', 3, 'F'),
    ];
    const result = balanceTeams(ps, 4, 3, { balanceByGender: true });
    expect(result).toHaveLength(4);
    result.forEach(team => {
      const males   = team.players.filter(x => x.gender === 'M').length;
      const females = team.players.filter(x => x.gender === 'F').length;
      expect(males).toBe(2);
      expect(females).toBe(1);
    });
  });

  test('7 women across 3 teams of 6 always split 3-2-2 (no clustering)', () => {
    // Reported bug: greedy lowest-stars placement let all 7 women land in
    // 4-1-2. Round-robin must give |max - min| <= 1 every run.
    const ps = [
      // 11 men, mixed levels — uneven stars per team after placement
      p('m1', 5, 'M'), p('m2', 5, 'M'), p('m3', 4, 'M'), p('m4', 4, 'M'),
      p('m5', 3, 'M'), p('m6', 3, 'M'), p('m7', 2, 'M'), p('m8', 2, 'M'),
      p('m9', 1, 'M'), p('m10', 1, 'M'), p('m11', 1, 'M'),
      // 7 women
      p('f1', 5, 'F'), p('f2', 4, 'F'), p('f3', 3, 'F'), p('f4', 3, 'F'),
      p('f5', 2, 'F'), p('f6', 2, 'F'), p('f7', 1, 'F'),
    ];
    for (let run = 0; run < 30; run++) {
      const result = balanceTeams(ps, 3, 6, { balanceByGender: true });
      const fPerTeam = result.slice(0, 3).map(t => t.players.filter(x => x.gender === 'F').length);
      expect(Math.max(...fPerTeam) - Math.min(...fPerTeam)).toBeLessThanOrEqual(1);
      expect(fPerTeam.reduce((a, b) => a + b, 0)).toBe(7);
    }
  });

  test('uneven men stars do not pull all women into one team', () => {
    // Men cluster stars heavily — without round-robin, women would all flow
    // to the weakest-stars team until it caught up.
    const ps = [
      p('m1', 5, 'M'), p('m2', 5, 'M'), p('m3', 5, 'M'),
      p('m4', 1, 'M'), p('m5', 1, 'M'), p('m6', 1, 'M'),
      p('f1', 3, 'F'), p('f2', 3, 'F'), p('f3', 3, 'F'), p('f4', 3, 'F'),
    ];
    for (let run = 0; run < 30; run++) {
      const result = balanceTeams(ps, 2, 5, { balanceByGender: true });
      const fPerTeam = result.slice(0, 2).map(t => t.players.filter(x => x.gender === 'F').length);
      expect(Math.abs(fPerTeam[0] - fPerTeam[1])).toBeLessThanOrEqual(1);
    }
  });

  test('treats players without gender as male for the gender-balanced draw', () => {
    // 3 women + 6 unspecified + 3 men, 3 teams of 4 (no overflow).
    // Under the "sem-gênero = homem" rule, the female count must be balanced
    // (1 per team) and the male+unspecified count must also be balanced.
    const ps = [
      p('f1', 4, 'F'), p('f2', 3, 'F'), p('f3', 2, 'F'),
      p('m1', 5, 'M'), p('m2', 4, 'M'), p('m3', 3, 'M'),
      p('u1', 5),      p('u2', 4),      p('u3', 3),
      p('u4', 2),      p('u5', 2),      p('u6', 1),
    ];
    for (let run = 0; run < 30; run++) {
      const result = balanceTeams(ps, 3, 4, { balanceByGender: true });
      const fPerTeam = result.slice(0, 3).map(t => t.players.filter(x => x.gender === 'F').length);
      const nonFPerTeam = result.slice(0, 3).map(t => t.players.filter(x => x.gender !== 'F').length);
      expect(Math.max(...fPerTeam) - Math.min(...fPerTeam)).toBeLessThanOrEqual(1);
      expect(Math.max(...nonFPerTeam) - Math.min(...nonFPerTeam)).toBeLessThanOrEqual(1);
    }
  });

  test('stress: random rosters keep gender-count diff <= 1 across main teams', () => {
    // Fuzz: build random rosters and assert the property the user reported
    // being broken — no team should be 2+ women off another.
    for (let run = 0; run < 200; run++) {
      const numTeams = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
      const perTeam = 4 + Math.floor(Math.random() * 4);  // 4..7
      const total = numTeams * perTeam;
      const fCount = Math.floor(Math.random() * (total + 1));
      const mCount = total - fCount;
      const ps: ReturnType<typeof p>[] = [];
      for (let i = 0; i < fCount; i++) ps.push(p(`f${i}`, 1 + Math.floor(Math.random() * 5), 'F'));
      for (let i = 0; i < mCount; i++) ps.push(p(`m${i}`, 1 + Math.floor(Math.random() * 5), 'M'));
      const result = balanceTeams(ps, numTeams, perTeam, { balanceByGender: true });
      const fPerTeam = result.slice(0, numTeams).map(t => t.players.filter(x => x.gender === 'F').length);
      const mPerTeam = result.slice(0, numTeams).map(t => t.players.filter(x => x.gender === 'M').length);
      expect(Math.max(...fPerTeam) - Math.min(...fPerTeam)).toBeLessThanOrEqual(1);
      expect(Math.max(...mPerTeam) - Math.min(...mPerTeam)).toBeLessThanOrEqual(1);
    }
  });

  test('still respects star balance with mixed levels and genders', () => {
    const ps = [
      p('m1', 5, 'M'), p('m2', 5, 'M'),
      p('m3', 1, 'M'), p('m4', 1, 'M'),
      p('f1', 4, 'F'), p('f2', 2, 'F'),
    ];
    const result = balanceTeams(ps, 2, 3, { balanceByGender: true });
    result.forEach(team => {
      expect(team.players.filter(x => x.gender === 'M').length).toBe(2);
      expect(team.players.filter(x => x.gender === 'F').length).toBe(1);
    });
    // With the 2M+1F-per-team constraint, the optimal split is 10/8 (spread = 2):
    // males {5,1}+{5,1} = 6/6, females {4}+{2} or {2}+{4} = 4/2.
    expect(mainSpread(result, 2)).toBeLessThanOrEqual(2);
  });
});

// ─── rematchTwoTeams ─────────────────────────────────────────────────────────

describe('rematchTwoTeams', () => {
  const ta = teamWith(1, [p('1', 5), p('2', 5), p('3', 1), p('4', 1)]);
  const tb = teamWith(2, [p('5', 3), p('6', 3), p('7', 3), p('8', 3)]);

  test('returns exactly 2 teams', () => {
    expect(rematchTwoTeams(ta, tb)).toHaveLength(2);
  });

  test('preserves original team ids and names', () => {
    const [newA, newB] = rematchTwoTeams(ta, tb);
    expect(newA.id).toBe(ta.id);
    expect(newA.name).toBe(ta.name);
    expect(newB.id).toBe(tb.id);
    expect(newB.name).toBe(tb.name);
  });

  test('no players are lost or duplicated', () => {
    const [newA, newB] = rematchTwoTeams(ta, tb);
    const totalIn = ta.players.length + tb.players.length;
    const totalOut = newA.players.length + newB.players.length;
    expect(totalOut).toBe(totalIn);
    expect(new Set(allPlayerIds([newA, newB])).size).toBe(totalIn);
  });

  test("each team's totalStars equals the sum of its players' levels", () => {
    const [newA, newB] = rematchTwoTeams(ta, tb);
    [newA, newB].forEach(team => {
      const expected = team.players.reduce((s, x) => s + x.level, 0);
      expect(team.totalStars).toBe(expected);
    });
  });

  test('empty team triggers even split (does not leave the rematch broken)', () => {
    // User manually removed everyone from team B before triggering rebalance.
    // The "preserve sizes" rule would leave B empty — useless. Fall back to
    // an even split so both teams come out populated.
    const full  = teamWith(1, [p('1', 5), p('2', 4), p('3', 3), p('4', 2), p('5', 1)]);
    const empty = teamWith(2, []);
    for (let run = 0; run < 20; run++) {
      const [a, b] = rematchTwoTeams(full, empty);
      expect(a.players.length + b.players.length).toBe(5);
      expect(Math.abs(a.players.length - b.players.length)).toBeLessThanOrEqual(1);
      expect(b.players.length).toBeGreaterThan(0);
    }
  });

  test('preserves original team sizes (no flattening of 5+1 into 3+3)', () => {
    // Mixed sizes — main + overflow case. After rematch, |A| stays 5 and |B|
    // stays 1, even though Math.ceil(6/2) would naively force 3+3.
    const big   = teamWith(1, [p('1', 5), p('2', 4), p('3', 3), p('4', 2), p('5', 1)]);
    const tiny  = teamWith(2, [p('6', 3)]);
    for (let run = 0; run < 20; run++) {
      const [a, b] = rematchTwoTeams(big, tiny);
      expect(a.players).toHaveLength(5);
      expect(b.players).toHaveLength(1);
    }
  });

  test('handles odd total: team sizes differ by at most 1', () => {
    // 5 players total → Math.ceil(5/2) = 3 per team; one gets 3, other gets 2
    const tx = teamWith(1, [p('a', 3), p('b', 3), p('c', 3)]);
    const ty = teamWith(2, [p('d', 3), p('e', 3)]);
    const [newX, newY] = rematchTwoTeams(tx, ty);
    expect(newX.players.length + newY.players.length).toBe(5);
    expect(Math.abs(newX.players.length - newY.players.length)).toBeLessThanOrEqual(1);
  });

  test('rebalances heavily stacked teams — spread improves every run', () => {
    // All 5-stars vs all 1-stars: worst possible imbalance (spread = 12)
    const stacked = teamWith(1, [p('1', 5), p('2', 5), p('3', 5)]);
    const weak    = teamWith(2, [p('4', 1), p('5', 1), p('6', 1)]);
    const oldSpread = Math.abs(stacked.totalStars - weak.totalStars);

    // Run 20 times to account for randomness — must always improve
    for (let run = 0; run < 20; run++) {
      const [newA, newB] = rematchTwoTeams(stacked, weak);
      const newSpread = Math.abs(newA.totalStars - newB.totalStars);
      expect(newSpread).toBeLessThan(oldSpread);
    }
  });

  test('post-condition: no single swap between the two teams reduces spread further', () => {
    // Use a wide mix to exercise the optimizer's convergence guarantee
    const bigA = teamWith(1, [p('1', 5), p('2', 4), p('3', 2), p('4', 1)]);
    const bigB = teamWith(2, [p('5', 5), p('6', 3), p('7', 3), p('8', 1)]);
    const [newA, newB] = rematchTwoTeams(bigA, bigB);
    const current = Math.abs(newA.totalStars - newB.totalStars);

    for (let i = 0; i < newA.players.length; i++) {
      for (let j = 0; j < newB.players.length; j++) {
        const lvlI = newA.players[i].level;
        const lvlJ = newB.players[j].level;
        if (lvlI === lvlJ) continue;
        const newSpread = Math.abs(
          (newA.totalStars - lvlI + lvlJ) - (newB.totalStars - lvlJ + lvlI),
        );
        expect(newSpread).toBeGreaterThanOrEqual(current);
      }
    }
  });

  test('already-balanced teams stay balanced (spread ≤ 1)', () => {
    // Total = 4+2+3+3 = 12; best split is 6/6
    const bal1 = teamWith(1, [p('1', 4), p('2', 2)]);
    const bal2 = teamWith(2, [p('3', 3), p('4', 3)]);

    for (let run = 0; run < 10; run++) {
      const [newA, newB] = rematchTwoTeams(bal1, bal2);
      expect(Math.abs(newA.totalStars - newB.totalStars)).toBeLessThanOrEqual(1);
    }
  });
});
