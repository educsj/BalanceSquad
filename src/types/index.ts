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

export interface DrawRecord {
  teams: Team[];
  timestamp: string; // ISO 8601
  balanceByGender?: boolean;
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
};

// Kept for backward compatibility with legacy screen files
export type BottomTabParamList = {
  Players: { peladaId: string };
  Presence: { peladaId: string };
};
