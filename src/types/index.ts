export type StarLevel = 1 | 2 | 3 | 4 | 5;

export interface Player {
  id: string;
  name: string;
  level: StarLevel;
}

export interface Pelada {
  id: string;
  name: string;
  playersPerTeam: number;
  players: Player[];
}

export interface Team {
  id: number;
  name: string;
  players: Player[];
  totalStars: number;
}

export type RootStackParamList = {
  Home: undefined;
  PeladaTabs: { peladaId: string };
  Teams: { teams: Team[] };
};

export type BottomTabParamList = {
  Players: { peladaId: string };
  Presence: { peladaId: string };
};
