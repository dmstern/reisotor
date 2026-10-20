import { ref } from 'vue';
import type L from 'leaflet';
import {
  downloadTiles,
  estimateTileDownload,
  formatApproxSize,
  MAX_OFFLINE_TILES,
} from '../utils/offlineMapTiles';

export type TileDownloadState = 'idle' | 'downloading' | 'done';

export interface TileDownloadProgress {
  done: number;
  total: number;
}

export interface TileDownloadResult {
  downloaded: number;
  failed: number;
}

export function useMapOfflineDownload() {
  const tileDownloadState = ref<TileDownloadState>('idle');
  const tileDownloadProgress = ref<TileDownloadProgress>({ done: 0, total: 0 });
  const tileDownloadResult = ref<TileDownloadResult | null>(null);

  async function downloadOfflineMap(getBounds: () => L.LatLngBounds | null | undefined) {
    if (tileDownloadState.value === 'downloading') return;
    const bounds = getBounds();
    if (!bounds) return;

    const estimate = estimateTileDownload(bounds);
    if (estimate.count === 0) return;

    if (estimate.count > MAX_OFFLINE_TILES) {
      if (typeof window !== 'undefined') {
        window.alert(
          `Der Kartenausschnitt ist zu groß für den Offline-Download (${estimate.count.toLocaleString('de-DE')} Kacheln, ca. ${formatApproxSize(estimate.approxBytes)}).\n\nBitte zoome näher an den gewünschten Bereich heran.`
        );
      }
      return;
    }

    const confirmed =
      typeof window !== 'undefined' &&
      window.confirm(
        `Aktuellen Kartenausschnitt für die Offline-Nutzung herunterladen?\n\n${estimate.count.toLocaleString('de-DE')} Kacheln, ca. ${formatApproxSize(estimate.approxBytes)}.`
      );
    if (!confirmed) return;

    try {
      tileDownloadState.value = 'downloading';
      tileDownloadProgress.value = { done: 0, total: estimate.count };
      tileDownloadResult.value = await downloadTiles(bounds, (done, total) => {
        tileDownloadProgress.value = { done, total };
      });
      tileDownloadState.value = 'done';
    } catch (err) {
      console.error('Fehler beim Offline-Download der Kartenkacheln:', err);
      tileDownloadState.value = 'idle';
      tileDownloadResult.value = null;
    }
  }

  function dismissTileDownloadResult() {
    tileDownloadState.value = 'idle';
    tileDownloadResult.value = null;
  }

  return {
    tileDownloadState,
    tileDownloadProgress,
    tileDownloadResult,
    downloadOfflineMap,
    dismissTileDownloadResult,
  };
}
