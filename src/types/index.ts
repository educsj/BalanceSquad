export type StarLevel = 1 | 2 | 3 | 4 | 5;

export interface Player {
  id: string;
  name: string;
  level: StarLevel;
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
  Teams: { teams: Team[]; peladaId: string; historyIndex?: number; openMergeModal?: boolean };
  ManualTeams: { players: Player[]; numTeams: number; peladaId: string; playersPerTeam: number };
  DrawHistory: { peladaId: string };
};

// Kept for backward compatibility with legacy screen files
export type BottomTabParamList = {
  Players: { peladaId: string };
  Presence: { peladaId: string };
};
