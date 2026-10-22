import { describe, expect, it } from 'vitest';
import { formatFallbackTrackTitle, getTrackTitle } from './trackTitles';
import type { LocationTrack } from '../api/types';

describe('trackTitles (frontend)', () => {
  describe('formatFallbackTrackTitle', () => {
    it('gibt "Sonntagsspaziergang" für einen Sonntag Vormittag zurück', () => {
      // 2026-10-18T09:00:00 (lokale Zeit) = Sonntag
      const sunday = new Date(2026, 9, 18, 9, 0, 0).toISOString();
      expect(formatFallbackTrackTitle(sunday)).toBe('Sonntagsspaziergang');
    });

    it('gibt "Morgendliche Tour am Montag" für Montagfrüh zurück', () => {
      // 2026-10-19T08:30:00 = Montag
      const monday = new Date(2026, 9, 19, 8, 30, 0).toISOString();
      expect(formatFallbackTrackTitle(monday)).toBe('Morgendliche Tour am Montag');
    });

    it('gibt "Feierabendrunde am Freitag" für Freitagabend zurück', () => {
      // 2026-10-23T18:45:00 = Freitag
      const friday = new Date(2026, 9, 23, 18, 45, 0).toISOString();
      expect(formatFallbackTrackTitle(friday)).toBe('Feierabendrunde am Freitag');
    });

    it('fällt bei ungültigem Datum auf "Aufzeichnung" zurück', () => {
      expect(formatFallbackTrackTitle('invalid-date')).toBe('Aufzeichnung');
    });
  });

  describe('getTrackTitle', () => {
    it('verwendet den gespeicherten Titel, wenn vorhanden', () => {
      const track: LocationTrack = {
        id: 1,
        trip_id: 1,
        user_id: 1,
        title: 'Radtour durch den Plänterwald',
        started_at: '2026-10-20T08:00:00Z',
        ended_at: '2026-10-20T09:00:00Z',
        visibility: 'private',
        excursion_id: null,
      };
      expect(getTrackTitle(track)).toBe('Radtour durch den Plänterwald');
    });

    it('fällt auf formatFallbackTrackTitle zurück, wenn kein Titel gespeichert ist', () => {
      // 2026-10-18T09:00:00 (lokale Zeit) = Sonntag
      const sundayIso = new Date(2026, 9, 18, 9, 0, 0).toISOString();
      const track: LocationTrack = {
        id: 2,
        trip_id: 1,
        user_id: 1,
        title: null,
        started_at: sundayIso,
        ended_at: null,
        visibility: 'private',
        excursion_id: null,
      };
      expect(getTrackTitle(track)).toBe('Sonntagsspaziergang');
    });
  });
});
