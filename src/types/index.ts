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
  PeladaTabs: { peladaId: string };
  Teams: { teams: Team[]; peladaId: string; historyIndex?: number };
  ManualTeams: { players: Player[]; numTeams: number; peladaId: string; playersPerTeam: number };
  DrawHistory: { peladaId: string };
};

export type BottomTabParamList = {
  Players: { peladaId: string };
  Presence: { peladaId: string };
};
