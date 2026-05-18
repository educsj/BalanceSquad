import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Pelada, DrawRecord } from '../types';
import { loadPeladas, savePeladas } from '../storage';
import {
  buildDrawPayload, parseDrawPayload, payloadToPelada, safeSlug, DrawPayload,
} from './drawSharePayload';

export { buildDrawPayload, parseDrawPayload, payloadToPelada };
export type { DrawPayload };

// Writes the payload to the app cache as <slug>-<timestamp>.json and opens
// the native share sheet. Resolves to the file URI for callers that want it.
export async function exportDrawToFile(
  record: DrawRecord,
  pelada: Pick<Pelada, 'name' | 'playersPerTeam'>,
  dialogTitle: string,
): Promise<string | null> {
  const payload = buildDrawPayload(record, pelada);
  const json = JSON.stringify(payload, null, 2);
  const filename = `balancesquad-draw-${safeSlug(pelada.name)}-${Date.now()}.json`;
  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle });
  }
  return fileUri;
}

// Persists the freshly-built pelada and returns the resulting Pelada record so
// the caller can refresh its list view.
export async function importDrawAsPelada(payload: DrawPayload, importedSuffix: string): Promise<Pelada> {
  const pelada = payloadToPelada(payload, importedSuffix);
  const all = await loadPeladas();
  await savePeladas([...all, pelada]);
  return pelada;
}
