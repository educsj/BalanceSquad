// Allowed values: 0.5, 1.0, 1.5, 2.0, ... 5.0 (10 steps).
// Stored as number to keep arithmetic simple in the balancer.
export type StarLevel = number;

export type Gender = 'M' | 'F';

export interface Player {
  id: string;
  name: string;
  level: StarLevel;
  gender?: Gender;
}

export interface Team {
  id: number;
  name: string;
  players: Player[];
  totalStars: number;
}

// Legacy single-result-per-draw shape. Kept readable on disk so old records
// don't crash, but the ranking now reads `matches` instead.
export type DrawResult =
  | { type: 'win'; winnerTeamId: number }
  | { type: 'draw' };

// A single game played within a sortition session. Real peladas have many
// of these per sorteio, with lineups that can drift from the original team
// rosters as players swap in and out.
export type MatchResult =
  | { type: 'win'; winner: 'home' | 'away' }
  | { type: 'draw' };

export interface Match {
  id: string;
  timestamp: string;        // ISO 8601
  homeTeamId: number;       // refs Team.id within the same DrawRecord
  awayTeamId: number;
  homePlayerIds: string[];  // actual lineup for this match (defaults to team roster)
  awayPlayerIds: string[];
  result: MatchResult;
}

export interface DrawRecord {
  teams: Team[];
  timestamp: string; // ISO 8601
  balanceByGender?: boolean;
  result?: DrawResult;       // legacy, ignored by ranking
  matches?: Match[];
}

export interface Pelada {
  id: string;
  name: string;
  playersPerTeam: number;
  players: Player[];
  lastDraw?: Team[]; // legacy — migrated to drawHistory on load
  drawHistory?: DrawRecord[];
}

export type RootStackParamList = {
  Home: undefined;
  PeladaHub: { peladaId: string };
  PlayerRegister: { peladaId: string; editPlayerId?: string };
  PlayerList: { peladaId: string };
  DrawConfig: { peladaId: string; selectedPlayerIds: string[]; guestPlayers?: Player[] };
  Teams: {
    teams: Team[];
    peladaId: string;
    historyIndex?: number;
    openMergeModal?: boolean;
    balanceByGender?: boolean;
  };
  ManualTeams: { players: Player[]; numTeams: number; peladaId: string; playersPerTeam: number };
  DrawHistory: { peladaId: string };
  Ranking: { peladaId: string };
  Matches: { peladaId: string; historyIndex: number };
  MatchEditor: { peladaId: string; historyIndex: number; matchId?: string };
};

// Kept for backward compatibility with legacy screen files
export type BottomTabParamList = {
  Players: { peladaId: string };
  Presence: { peladaId: string };
};
