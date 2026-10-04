import { ref } from 'vue';
import type L from 'leaflet';
import { downloadTiles, estimateTileDownload, formatApproxSize } from '../utils/offlineMapTiles';

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
    const confirmed =
      typeof window !== 'undefined' &&
      window.confirm(
        `Aktuellen Kartenausschnitt für die Offline-Nutzung herunterladen?\n\n${estimate.count} Kacheln, ca. ${formatApproxSize(estimate.approxBytes)}.`
      );
    if (!confirmed) return;

    tileDownloadState.value = 'downloading';
    tileDownloadProgress.value = { done: 0, total: estimate.count };
    tileDownloadResult.value = await downloadTiles(bounds, (done, total) => {
      tileDownloadProgress.value = { done, total };
    });
    tileDownloadState.value = 'done';
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
