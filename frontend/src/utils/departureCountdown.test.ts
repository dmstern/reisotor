import { describe, expect, it } from 'vitest';
import { computeDepartureCountdown, computeVacationPhase } from './departureCountdown';

// Regressionstest für einen gemeldeten Bug: die vorherige Implementierung nutzte
// `new Date(startDateStr)` (UTC-Mitternacht) gemischt mit lokaler "heute Mitternacht"-Zeit und
// rundete per Math.ceil() auf - das zeigte in Zeitzonen östlich von UTC einen Tag zu viel an und
// noch am Abreisetag selbst "1 Tag bis zur Abreise" statt der tatsächlichen Reststunden.
describe('computeDepartureCountdown', () => {
  it('rundet mehrere volle Tage ab (nicht auf)', () => {
    // Abreise 2026-08-14, "jetzt" ist 2026-08-07 23:00 lokal - kalendarisch genau 7 Tage entfernt,
    // unabhängig von der Uhrzeit.
    const now = new Date(2026, 7, 7, 23, 0, 0);
    expect(computeDepartureCountdown('2026-08-14', now)).toEqual({ phase: 'days', days: 7 });
  });

  it('zeigt Stunden statt Tage, sobald weniger als 48h bis zum ENDE des Abreisetags verbleiben', () => {
    // Abreise 2026-08-14, "jetzt" ist 2026-08-13 23:30 lokal - bis Ende des 14. (=15. 00:00) sind es
    // 1 Tag + 30 Minuten = 24.5h, also < 48h.
    const now = new Date(2026, 7, 13, 23, 30, 0);
    const result = computeDepartureCountdown('2026-08-14', now);
    expect(result.phase).toBe('hours');
  });

  it('zeigt am Abreisetag selbst die verbleibenden Stunden statt "1 Tag"', () => {
    // Genau der gemeldete Bug: am Abreisetag (10 Uhr morgens) wurde zuvor "1 Tag bis zur Abreise"
    // angezeigt statt der tatsächlichen ~14 Reststunden bis Tagesende.
    const now = new Date(2026, 7, 14, 10, 0, 0);
    const result = computeDepartureCountdown('2026-08-14', now);
    expect(result).toEqual({ phase: 'hours', hours: 14 });
  });

  it('zeigt "departed", sobald der Abreisetag komplett vorbei ist', () => {
    const now = new Date(2026, 7, 15, 0, 0, 1);
    expect(computeDepartureCountdown('2026-08-14', now)).toEqual({ phase: 'departed' });
  });

  it('zeigt noch Stunden in der letzten Minute des Abreisetags, nicht schon "departed"', () => {
    const now = new Date(2026, 7, 14, 23, 59, 0);
    const result = computeDepartureCountdown('2026-08-14', now);
    expect(result.phase).toBe('hours');
    if (result.phase === 'hours') expect(result.hours).toBeGreaterThanOrEqual(1);
  });
});

// Regressionsnetz für den Dashboard-Hinweis nach dem Abreisetag (siehe DashboardView.vue): der
// vorherige, dauerhafte "Gute Reise!"-Text blieb bis lange nach Urlaubsende stehen. Diese Phasen
// lösen ihn ab, sobald computeDepartureCountdown() 'departed' liefert.
describe('computeVacationPhase', () => {
  const trip = { start_date: '2026-08-14', end_date: '2026-08-18' };

  it('liefert null, solange der Abreisetag selbst noch läuft', () => {
    expect(computeVacationPhase(trip, new Date(2026, 7, 14, 23, 59, 0))).toBeNull();
  });

  it('liefert null vor dem Abreisetag', () => {
    expect(computeVacationPhase(trip, new Date(2026, 7, 10, 12, 0, 0))).toBeNull();
  });

  it('zeigt "arrived" am ersten vollen Urlaubstag (Tag nach der Abreise)', () => {
    expect(computeVacationPhase(trip, new Date(2026, 7, 15, 9, 0, 0))).toEqual({ phase: 'arrived' });
  });

  it('zeigt "ongoing" mit den korrekten Resttagen an einem mittleren Urlaubstag', () => {
    // 2026-08-16, Urlaubsende 2026-08-18 -> noch 2 Kalendertage bis (und mit) dem letzten Tag.
    expect(computeVacationPhase(trip, new Date(2026, 7, 16, 15, 0, 0))).toEqual({ phase: 'ongoing', daysLeft: 2 });
  });

  it('zeigt "lastDay" am end_date', () => {
    expect(computeVacationPhase(trip, new Date(2026, 7, 18, 8, 0, 0))).toEqual({ phase: 'lastDay' });
  });

  it('zeigt "over" ab dem Tag nach end_date', () => {
    expect(computeVacationPhase(trip, new Date(2026, 7, 19, 0, 0, 1))).toEqual({ phase: 'over' });
    expect(computeVacationPhase(trip, new Date(2026, 9, 1, 12, 0, 0))).toEqual({ phase: 'over' });
  });

  it('bevorzugt "lastDay" vor "arrived" bei sehr kurzen Reisen (Tag nach Abreise == letzter Tag)', () => {
    const shortTrip = { start_date: '2026-08-14', end_date: '2026-08-15' };
    expect(computeVacationPhase(shortTrip, new Date(2026, 7, 15, 9, 0, 0))).toEqual({ phase: 'lastDay' });
  });
});
