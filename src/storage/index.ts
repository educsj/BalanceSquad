import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pelada, DrawRecord, Team } from '../types';

const PELADAS_KEY = '@balancesquad:peladas';
const HIDE_RATINGS_KEY = '@balancesquad:hideRatings';

function migratePelada(pelada: Pelada): Pelada {
  if (pelada.lastDraw && pelada.lastDraw.length > 0 && !pelada.drawHistory) {
    return {
      ...pelada,
      drawHistory: [{ teams: pelada.lastDraw, timestamp: '' }],
      lastDraw: undefined,
    };
  }
  const { lastDraw: _removed, ...rest } = pelada;
  return rest as Pelada;
}

export async function loadPeladas(): Promise<Pelada[]> {
  const raw = await AsyncStorage.getItem(PELADAS_KEY);
  if (!raw) return [];
  const peladas: Pelada[] = JSON.parse(raw);
  return peladas.map(migratePelada);
}

export async function savePeladas(peladas: Pelada[]): Promise<void> {
  await AsyncStorage.setItem(PELADAS_KEY, JSON.stringify(peladas));
}

export async function getPeladaById(id: string): Promise<Pelada | undefined> {
  const peladas = await loadPeladas();
  return peladas.find(p => p.id === id);
}

export async function updatePelada(updated: Pelada): Promise<void> {
  const peladas = await loadPeladas();
  await savePeladas(peladas.map(p => (p.id === updated.id ? updated : p)));
}

export async function addDrawRecord(peladaId: string, teams: Team[]): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const record: DrawRecord = { teams, timestamp: new Date().toISOString() };
  const history = [record, ...(pelada.drawHistory ?? [])].slice(0, 5);
  await updatePelada({ ...pelada, drawHistory: history });
}

export async function updateLatestDrawRecord(peladaId: string, teams: Team[]): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const history = pelada.drawHistory ?? [];
  if (history.length === 0) return;
  const updated: DrawRecord[] = [{ ...history[0], teams }, ...history.slice(1)];
  await updatePelada({ ...pelada, drawHistory: updated });
}

export async function getHideRatings(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HIDE_RATINGS_KEY);
  return raw === 'true';
}

export async function setHideRatings(value: boolean): Promise<void> {
  await AsyncStorage.setItem(HIDE_RATINGS_KEY, value ? 'true' : 'false');
}
