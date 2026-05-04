import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pelada, DrawRecord, Team } from '../types';

const PELADAS_KEY = '@balancesquad:peladas';
const HIDE_RATINGS_KEY = '@balancesquad:hideRatings';
const LANGUAGE_KEY = '@balancesquad:language';

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

export async function updateDrawRecord(peladaId: string, teams: Team[], index = 0): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const history = pelada.drawHistory ?? [];
  if (index >= history.length) return;
  const updated: DrawRecord[] = history.map((r, i) => i === index ? { ...r, teams } : r);
  await updatePelada({ ...pelada, drawHistory: updated });
}

export async function getHideRatings(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HIDE_RATINGS_KEY);
  return raw === 'true';
}

export async function setHideRatings(value: boolean): Promise<void> {
  await AsyncStorage.setItem(HIDE_RATINGS_KEY, value ? 'true' : 'false');
}

export async function getLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_KEY);
}

export async function setLanguage(lang: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export async function exportData(): Promise<string> {
  const peladas = await loadPeladas();
  const hideRatings = await getHideRatings();
  return JSON.stringify({ peladas, hideRatings, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  if (Array.isArray(data.peladas)) {
    await savePeladas(data.peladas.map(migratePelada));
  }
  if (typeof data.hideRatings === 'boolean') {
    await setHideRatings(data.hideRatings);
  }
}
