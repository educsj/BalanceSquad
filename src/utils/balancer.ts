import { Player, Team } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function addToTeam(teams: Team[], idx: number, player: Player): void {
  teams[idx].players.push(player);
  teams[idx].totalStars += player.level;
}

// Among a list of candidates, picks the one with:
//   1. Lowest totalStars (primary — maximises star balance)
//   2. Fewest players    (tie-breaker — evens out team sizes)
//   3. Random            (among fully tied candidates — removes index bias)
function pickBest(candidates: { i: number; stars: number; count: number }[]): number {
  const minStars = Math.min(...candidates.map(x => x.stars));
  const atMinStars = candidates.filter(x => x.stars === minStars);

  const minCount = Math.min(...atMinStars.map(x => x.count));
  const atMinBoth = atMinStars.filter(x => x.count === minCount);

  return atMinBoth[Math.floor(Math.random() * atMinBoth.length)].i;
}

// Returns the index of the best team to receive the next player.
//
// Rule 1 (GOLD): main teams (0..numTeams-1) are checked first.
//   The overflow team(s) only become eligible once ALL main teams are full.
//   This guarantees: Time 1…N fill to playersPerTeam before Time N+1 receives anyone.
//
// Rule 2: among eligible teams, pick by lowest totalStars (see pickBest).
//
// Fallback: if every team is somehow full (impossible with Math.ceil, kept as safety net),
//   add to the globally lowest-sum team.
function getEligibleTeam(teams: Team[], numTeams: number, playersPerTeam: number): number {
  const toCandidates = (slice: Team[], offset: number) =>
    slice
      .map((t, li) => ({ i: li + offset, stars: t.totalStars, count: t.players.length }))
      .filter(x => x.count < playersPerTeam);

  const mainCandidates = toCandidates(teams.slice(0, numTeams), 0);
  if (mainCandidates.length > 0) return pickBest(mainCandidates);

  const overflowCandidates = toCandidates(teams.slice(numTeams), numTeams);
  if (overflowCandidates.length > 0) return pickBest(overflowCandidates);

  return teams.reduce(
    (minI, t, i, arr) => (t.totalStars < arr[minI].totalStars ? i : minI),
    0,
  );
}

// Strongest-first ordering with same-level players shuffled to randomize ties.
// Works for any positive numeric level (0.5 increments included).
function sortByLevelDesc(players: Player[]): Player[] {
  const groups = new Map<number, Player[]>();
  players.forEach(p => {
    const arr = groups.get(p.level);
    if (arr) arr.push(p);
    else groups.set(p.level, [p]);
  });
  const levels = [...groups.keys()].sort((a, b) => b - a);
  return levels.flatMap(lvl => shuffle(groups.get(lvl)!));
}

function recomputeStars(team: Team): void {
  team.totalStars = team.players.reduce((s, p) => s + p.level, 0);
}

// Distributes a single-gender group across teams using a strict round-robin:
// in each round, every team with capacity receives ONE player, picked
// strongest-first and routed to the team with the lowest current totalStars.
// This guarantees that the number of players from this group differs by at
// most 1 between any two teams that had capacity throughout the placement.
//
// Main teams are preferred over overflow until they all reach playersPerTeam.
function distributeGenderGroup(
  teams: Team[],
  group: Player[],
  numTeams: number,
  playersPerTeam: number,
): void {
  if (group.length === 0) return;
  const sorted = sortByLevelDesc(group);
  let cursor = 0;

  while (cursor < sorted.length) {
    const mainElig = teams.slice(0, numTeams)
      .map((t, i) => ({ i, stars: t.totalStars, count: t.players.length }))
      .filter(c => c.count < playersPerTeam);

    const ovElig = teams.slice(numTeams)
      .map((t, idx) => ({ i: idx + numTeams, stars: t.totalStars, count: t.players.length }))
      .filter(c => c.count < playersPerTeam);

    const elig = mainElig.length > 0 ? mainElig : ovElig;
    if (elig.length === 0) break;

    // Stars asc, then count asc, then random tie-break — guarantees the
    // strongest remaining player goes to the team most in need of stars
    // while keeping team sizes even across rounds.
    elig.sort((a, b) => {
      if (a.stars !== b.stars) return a.stars - b.stars;
      if (a.count !== b.count) return a.count - b.count;
      return Math.random() - 0.5;
    });

    for (const c of elig) {
      if (cursor >= sorted.length) break;
      addToTeam(teams, c.i, sorted[cursor++]);
    }
  }
}

// Belt-and-suspenders safety net: after the round-robin distribution and the
// optimizer pass, if any gender's count differs by more than 1 across main
// teams, swap a same-gender excess into the minority team and a non-gender
// player back the other way. Re-runs until every gender is balanced.
//
// Round-robin should already produce this property, but this guards against
// unexpected interactions (e.g. when a team is full of one gender before the
// minority gets its turn) and makes the contract explicit.
function enforceGenderBalance(teams: Team[], numTeams: number): void {
  const main = teams.slice(0, numTeams);
  for (const g of ['M', 'F'] as const) {
    let guard = 0;
    while (guard++ < 100) {
      const counts = main.map(t => t.players.filter(p => p.gender === g).length);
      const maxC = Math.max(...counts);
      const minC = Math.min(...counts);
      if (maxC - minC <= 1) break;
      const maxIdx = counts.indexOf(maxC);
      const minIdx = counts.indexOf(minC);
      const gIdx = main[maxIdx].players.findIndex(p => p.gender === g);
      const nonGIdx = main[minIdx].players.findIndex(p => p.gender !== g);
      if (gIdx === -1 || nonGIdx === -1) break;

      const a = main[maxIdx].players[gIdx];
      const b = main[minIdx].players[nonGIdx];
      main[maxIdx].players[gIdx] = b;
      main[minIdx].players[nonGIdx] = a;
      main[maxIdx].totalStars = main[maxIdx].totalStars - a.level + b.level;
      main[minIdx].totalStars = main[minIdx].totalStars - b.level + a.level;
    }
  }
}

function applyGenderRoundRobin(
  teams: Team[],
  present: Player[],
  numTeams: number,
  playersPerTeam: number,
): void {
  const males       = present.filter(p => p.gender === 'M');
  const females     = present.filter(p => p.gender === 'F');
  const unspecified = present.filter(p => !p.gender);

  // Place the smaller of M/F first so the minority is spread cleanly before
  // capacity gets eaten by the larger group. Unspecified always last — no
  // gender constraint, so they fill whatever slots remain.
  const gendered = [males, females].sort((a, b) => a.length - b.length);
  [...gendered, unspecified].forEach(g =>
    distributeGenderGroup(teams, g, numTeams, playersPerTeam),
  );
}

export interface RematchOptions {
  balanceByGender?: boolean;
}

// Redistributes the combined players of two teams back into those same two teams,
// preserving the original team ids/names and re-balancing stars from scratch.
// The per-team cap is derived automatically (Math.ceil of the combined count / 2).
// When `balanceByGender` is on, distribution is gender-aware and the optimizer
// only swaps same-gender players.
export function rematchTwoTeams(
  teamA: Team,
  teamB: Team,
  options: RematchOptions = {},
): [Team, Team] {
  const present = [...teamA.players, ...teamB.players];
  const playersPerTeam = Math.ceil(present.length / 2);

  const pair: Team[] = [
    { ...teamA, players: [], totalStars: 0 },
    { ...teamB, players: [], totalStars: 0 },
  ];

  if (options.balanceByGender) {
    applyGenderRoundRobin(pair, present, 2, playersPerTeam);
    const optimized = optimizeBalance(pair, 2, true);
    enforceGenderBalance(optimized, 2);
    const finalized = optimizeBalance(optimized, 2, true);
    return [finalized[0], finalized[1]];
  }

  // numTeams = 2 — both slots are "main" teams, no overflow possible
  sortByLevelDesc(present).forEach(player => {
    addToTeam(pair, getEligibleTeam(pair, 2, playersPerTeam), player);
  });

  return [pair[0], pair[1]];
}

// Local-search post-optimizer: repeatedly swaps players between main teams
// if the swap reduces the spread (max − min) of totalStars. Runs in O(n²)
// passes until convergence.
//
// When respectGender = true, only swap players of the same gender — preserves
// the gender balance produced by the gender-aware distribution.
function optimizeBalance(teams: Team[], numTeams: number, respectGender = false): Team[] {
  const result = teams.map(t => ({ ...t, players: [...t.players] }));

  let improved = true;
  while (improved) {
    improved = false;
    outer:
    for (let ti = 0; ti < numTeams - 1; ti++) {
      for (let tj = ti + 1; tj < numTeams; tj++) {
        for (let pi = 0; pi < result[ti].players.length; pi++) {
          for (let pj = 0; pj < result[tj].players.length; pj++) {
            const pl1 = result[ti].players[pi];
            const pl2 = result[tj].players[pj];
            if (pl1.level === pl2.level) continue;
            if (respectGender && pl1.gender !== pl2.gender) continue;

            const mainStars = result.slice(0, numTeams).map(t => t.totalStars);
            const currentSpread = Math.max(...mainStars) - Math.min(...mainStars);

            const newI = result[ti].totalStars - pl1.level + pl2.level;
            const newJ = result[tj].totalStars - pl2.level + pl1.level;
            const newStars = mainStars.map((s, k) => k === ti ? newI : k === tj ? newJ : s);
            const newSpread = Math.max(...newStars) - Math.min(...newStars);

            if (newSpread < currentSpread) {
              [result[ti].players[pi], result[tj].players[pj]] =
                [result[tj].players[pj], result[ti].players[pi]];
              result[ti].totalStars = newI;
              result[tj].totalStars = newJ;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }

  return result;
}

export interface BalanceOptions {
  balanceByGender?: boolean;
}

export function balanceTeams(
  present: Player[],
  numTeams: number,
  playersPerTeam: number,
  options: BalanceOptions = {},
): Team[] {
  const maxMainPlayers = numTeams * playersPerTeam;
  const totalTeams = Math.ceil(present.length / playersPerTeam);

  const teams: Team[] = Array.from({ length: totalTeams }, (_, i) => ({
    id: i + 1,
    name: `Time ${i + 1}`,
    players: [],
    totalStars: 0,
  }));

  if (options.balanceByGender) {
    // Strict round-robin per gender: each team gets one player from a gender
    // per round before any team gets a second. Guarantees the count of each
    // gender differs by at most 1 across teams, no matter how lopsided the
    // star totals are after men are placed.
    applyGenderRoundRobin(teams, present, numTeams, playersPerTeam);
    const balanced = optimizeBalance(teams, numTeams, true);
    enforceGenderBalance(balanced, numTeams);
    // One last star pass after the safety swaps — gender count is now locked
    // and the optimizer can shuffle same-gender players to tighten the spread.
    return optimizeBalance(balanced, numTeams, true);
  }

  // Shuffle the full list so overflow candidates are chosen at random —
  // anyone can end up in the sobra team, regardless of their level.
  const randomised = shuffle(present);
  const overflowPlayers = randomised.slice(maxMainPlayers);
  const mainPlayers    = randomised.slice(0, maxMainPlayers);

  // Pre-fill the overflow team (last slot) with the randomly chosen players.
  overflowPlayers.forEach(p => addToTeam(teams, totalTeams - 1, p));

  // Distribute the remaining players across the main teams using the
  // strongest-first greedy so star sums stay as balanced as possible.
  sortByLevelDesc(mainPlayers).forEach(player => {
    addToTeam(teams, getEligibleTeam(teams, numTeams, playersPerTeam), player);
  });

  return optimizeBalance(teams, numTeams);
}

// Rebuilds the totalStars of every team from its current player list.
// Used after add/remove edits in the Teams screen.
export function recalcTeams(teams: Team[]): Team[] {
  return teams.map(t => {
    const next = { ...t, players: [...t.players] };
    recomputeStars(next);
    return next;
  });
}
