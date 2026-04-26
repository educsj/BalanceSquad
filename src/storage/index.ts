import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pelada } from '../types';

const PELADAS_KEY = '@balancesquad:peladas';

export async function loadPeladas(): Promise<Pelada[]> {
  const raw = await AsyncStorage.getItem(PELADAS_KEY);
  return raw ? JSON.parse(raw) : [];
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
