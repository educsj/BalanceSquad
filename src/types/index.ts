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

export interface GoalEntry {
  playerId: string;
  count: number;
}

export interface Match {
  id: string;
  timestamp: string;        // ISO 8601
  homeTeamId: number;       // refs Team.id within the same DrawRecord
  awayTeamId: number;
  homePlayerIds: string[];  // actual lineup for this match (defaults to team roster)
  awayPlayerIds: string[];
  result: MatchResult;
  goals?: GoalEntry[];      // optional per-player goal counts for this match
  mvpPlayerId?: string;     // optional standout player of this match
}

export interface DrawRecord {
  teams: Team[];
  timestamp: string; // ISO 8601
  balanceByGender?: boolean;
  result?: DrawResult;       // legacy, ignored by ranking
  matches?: Match[];
}

// A scheduled pelada session: organizers create one for an upcoming date,
// players RSVP, and on game day the session links to a DrawRecord once the
// actual draw happens. Past sessions stay around for the calendar view and
// attendance history.
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface PeladaSession {
  id: string;
  date: string;            // ISO date YYYY-MM-DD
  time?: string;           // HH:mm (optional)
  maxPlayers: number;      // capacity (defaults to numTeams * playersPerTeam)
  rsvps: string[];         // confirmed player IDs (up to maxPlayers)
  waitlist: string[];      // queued player IDs (FIFO)
  status: SessionStatus;
  drawHistoryIndex?: number; // link to drawHistory[i] once the draw happens
  notes?: string;
  // One-off players ("avulsos") added directly to this session — kept here
  // so they don't pollute the permanent pelada.players roster. IDs in
  // rsvps/waitlist may reference these. Carried through to DrawConfig via
  // the existing `guestPlayers` param when the draw runs.
  guestPlayers?: Player[];
}

export interface Pelada {
  id: string;
  name: string;
  playersPerTeam: number;
  players: Player[];
  lastDraw?: Team[]; // legacy — migrated to drawHistory on load
  drawHistory?: DrawRecord[];
  sessions?: PeladaSession[];
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
  MatchEditor: {
    peladaId: string;
    historyIndex: number;
    matchId?: string;
    prefillHomeTeamId?: number;
    prefillAwayTeamId?: number;
  };
  PlayerProfile: { peladaId: string; playerId: string };
  SessionsCalendar: { peladaId: string };
  SessionCreate: { peladaId: string };
  SessionDetail: { peladaId: string; sessionId: string };
};

// Kept for backward compatibility with legacy screen files
export type BottomTabParamList = {
  Players: { peladaId: string };
  Presence: { peladaId: string };
};
