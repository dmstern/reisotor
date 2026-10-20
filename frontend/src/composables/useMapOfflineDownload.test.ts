// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMapOfflineDownload } from './useMapOfflineDownload';
import * as offlineMapTiles from '../utils/offlineMapTiles';
import type L from 'leaflet';

vi.mock('../utils/offlineMapTiles', () => ({
  estimateTileDownload: vi.fn(),
  downloadTiles: vi.fn(),
  formatApproxSize: vi.fn((bytes) => `${bytes} B`),
  MAX_OFFLINE_TILES: 3000,
}));

describe('useMapOfflineDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with idle state and null result', () => {
    const { tileDownloadState, tileDownloadProgress, tileDownloadResult } = useMapOfflineDownload();
    expect(tileDownloadState.value).toBe('idle');
    expect(tileDownloadProgress.value).toEqual({ done: 0, total: 0 });
    expect(tileDownloadResult.value).toBeNull();
  });

  it('does nothing when getBounds returns null', async () => {
    const { downloadOfflineMap, tileDownloadState } = useMapOfflineDownload();
    await downloadOfflineMap(() => null);
    expect(tileDownloadState.value).toBe('idle');
  });

  it('does nothing when estimate returns 0 tiles', async () => {
    vi.mocked(offlineMapTiles.estimateTileDownload).mockReturnValue({
      count: 0,
      approxBytes: 0,
    });
    const confirmSpy = vi.spyOn(window, 'confirm');

    const { downloadOfflineMap, tileDownloadState } = useMapOfflineDownload();
    const fakeBounds = {} as L.LatLngBounds;
    await downloadOfflineMap(() => fakeBounds);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(tileDownloadState.value).toBe('idle');
    confirmSpy.mockRestore();
  });

  it('alerts and aborts when tile count exceeds MAX_OFFLINE_TILES', async () => {
    vi.mocked(offlineMapTiles.estimateTileDownload).mockReturnValue({
      count: 50_000,
      approxBytes: 50_000 * 15_000,
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm');

    const { downloadOfflineMap, tileDownloadState } = useMapOfflineDownload();
    const fakeBounds = {} as L.LatLngBounds;
    await downloadOfflineMap(() => fakeBounds);

    expect(alertSpy).toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(tileDownloadState.value).toBe('idle');
    expect(offlineMapTiles.downloadTiles).not.toHaveBeenCalled();
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('cancels download when user cancels confirm prompt', async () => {
    vi.mocked(offlineMapTiles.estimateTileDownload).mockReturnValue({
      count: 10,
      approxBytes: 1024,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { downloadOfflineMap, tileDownloadState } = useMapOfflineDownload();
    const fakeBounds = {} as L.LatLngBounds;
    await downloadOfflineMap(() => fakeBounds);

    expect(confirmSpy).toHaveBeenCalled();
    expect(tileDownloadState.value).toBe('idle');
    expect(offlineMapTiles.downloadTiles).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('runs download and sets state to done when confirmed', async () => {
    vi.mocked(offlineMapTiles.estimateTileDownload).mockReturnValue({
      count: 5,
      approxBytes: 500,
    });
    vi.mocked(offlineMapTiles.downloadTiles).mockImplementation(async (_bounds, progressCb) => {
      progressCb?.(2, 5);
      progressCb?.(5, 5);
      return { downloaded: 5, failed: 0 };
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { downloadOfflineMap, tileDownloadState, tileDownloadProgress, tileDownloadResult } =
      useMapOfflineDownload();
    const fakeBounds = {} as L.LatLngBounds;
    await downloadOfflineMap(() => fakeBounds);

    expect(tileDownloadState.value).toBe('done');
    expect(tileDownloadProgress.value).toEqual({ done: 5, total: 5 });
    expect(tileDownloadResult.value).toEqual({ downloaded: 5, failed: 0 });
    confirmSpy.mockRestore();
  });

  it('dismisses tile download result back to idle', () => {
    const { tileDownloadState, tileDownloadResult, dismissTileDownloadResult } =
      useMapOfflineDownload();
    tileDownloadState.value = 'done';
    tileDownloadResult.value = { downloaded: 5, failed: 0 };

    dismissTileDownloadResult();
    expect(tileDownloadState.value).toBe('idle');
    expect(tileDownloadResult.value).toBeNull();
  });
});
