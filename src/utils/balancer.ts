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

// Redistributes the combined players of two teams back into those same two teams,
// preserving the original team ids/names and re-balancing stars from scratch.
// The per-team cap is derived automatically (Math.ceil of the combined count / 2).
export function rematchTwoTeams(teamA: Team, teamB: Team): [Team, Team] {
  const present = [...teamA.players, ...teamB.players];
  const playersPerTeam = Math.ceil(present.length / 2);

  const pair: Team[] = [
    { ...teamA, players: [], totalStars: 0 },
    { ...teamB, players: [], totalStars: 0 },
  ];

  const sorted = ([5, 4, 3, 2, 1] as const).flatMap(lvl =>
    shuffle(present.filter(p => p.level === lvl)),
  );

  // numTeams = 2 — both slots are "main" teams, no overflow possible
  sorted.forEach(player => {
    addToTeam(pair, getEligibleTeam(pair, 2, playersPerTeam), player);
  });

  return [pair[0], pair[1]];
}

export function balanceTeams(present: Player[], numTeams: number, playersPerTeam: number): Team[] {
  const totalTeams = Math.ceil(present.length / playersPerTeam);

  const teams: Team[] = Array.from({ length: totalTeams }, (_, i) => ({
    id: i + 1,
    name: `Time ${i + 1}`,
    players: [],
    totalStars: 0,
  }));

  // Sort all players strongest-first (5★ → 4★ → 3★ → 2★ → 1★).
  // Players within the same level are shuffled to avoid name-order bias.
  // Processing strongest players first lets the greedy distribute high-value
  // players across teams before filling in weaker ones, maximising star balance.
  // (Separating elite/base into their own phases and inserting 1★ before 2-4★
  //  caused weak players to pile up in the team that lacked an elite starter,
  //  creating an unrecoverable star-sum deficit in that team.)
  const sorted = ([5, 4, 3, 2, 1] as const).flatMap(lvl =>
    shuffle(present.filter(p => p.level === lvl)),
  );

  sorted.forEach(player => {
    addToTeam(teams, getEligibleTeam(teams, numTeams, playersPerTeam), player);
  });

  return teams;
}
