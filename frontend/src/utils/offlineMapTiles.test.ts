// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  lngToTileX,
  latToTileY,
  tileRange,
  allTileUrls,
  estimateTileDownload,
  formatApproxSize,
  MAX_OFFLINE_TILES,
} from './offlineMapTiles';
import type L from 'leaflet';

function createMockBounds(
  south: number,
  west: number,
  north: number,
  east: number
): L.LatLngBounds {
  return {
    getSouth: () => south,
    getWest: () => west,
    getNorth: () => north,
    getEast: () => east,
  } as unknown as L.LatLngBounds;
}

describe('offlineMapTiles', () => {
  describe('coordinate conversions and clamping', () => {
    it('clamps longitude within valid range', () => {
      const zoom = 12;
      const maxTile = 2 ** zoom - 1;
      expect(lngToTileX(-200, zoom)).toBe(0);
      expect(lngToTileX(-180, zoom)).toBe(0);
      expect(lngToTileX(180, zoom)).toBe(maxTile);
      expect(lngToTileX(250, zoom)).toBe(maxTile);
    });

    it('clamps latitude within Web Mercator bounds and avoids NaN or negatives', () => {
      const zoom = 12;
      const maxTile = 2 ** zoom - 1;
      expect(latToTileY(95, zoom)).toBe(0);
      expect(latToTileY(85.0511, zoom)).toBe(0);
      expect(latToTileY(-85.0511, zoom)).toBe(maxTile);
      expect(latToTileY(-95, zoom)).toBe(maxTile);
    });

    it('tileRange ensures xMin <= xMax and yMin <= yMax', () => {
      const bounds = createMockBounds(47.5, 11.0, 48.5, 12.0);
      const range = tileRange(bounds, 12);
      expect(range.xMin).toBeLessThanOrEqual(range.xMax);
      expect(range.yMin).toBeLessThanOrEqual(range.yMax);
      expect(range.xMin).toBeGreaterThanOrEqual(0);
      expect(range.yMin).toBeGreaterThanOrEqual(0);
    });
  });

  describe('estimateTileDownload', () => {
    it('estimates tile count mathematically without crashing on world-spanning bounds', () => {
      const worldBounds = createMockBounds(-90, -180, 90, 180);
      const estimate = estimateTileDownload(worldBounds);

      expect(estimate.count).toBeGreaterThan(0);
      expect(estimate.approxBytes).toBe(estimate.count * 15_000);
      expect(Number.isFinite(estimate.count)).toBe(true);
    });

    it('computes expected count for a small city region', () => {
      const bounds = createMockBounds(48.1, 11.5, 48.2, 11.6);
      const estimate = estimateTileDownload(bounds);

      expect(estimate.count).toBeGreaterThan(0);
      expect(estimate.count).toBeLessThan(MAX_OFFLINE_TILES);
      expect(estimate.approxBytes).toBe(estimate.count * 15_000);
    });
  });

  describe('allTileUrls', () => {
    it('respects the maxTiles cap to prevent out-of-memory crashes', () => {
      const worldBounds = createMockBounds(-90, -180, 90, 180);
      const urls = allTileUrls(worldBounds, 50);

      expect(urls.length).toBe(50);
      expect(urls[0]).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    });
  });

  describe('formatApproxSize', () => {
    it('formats sizes below 1 MB as KB', () => {
      expect(formatApproxSize(50_000)).toBe('50 KB');
      expect(formatApproxSize(950_000)).toBe('950 KB');
    });

    it('formats sizes of 1 MB and above as MB', () => {
      expect(formatApproxSize(1_500_000)).toBe('1.5 MB');
      expect(formatApproxSize(12_000_000)).toBe('12.0 MB');
    });
  });
});
