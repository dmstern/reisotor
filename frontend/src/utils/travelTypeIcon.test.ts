import { describe, expect, it } from 'vitest';
import { travelTypeIcon, travelTypeIconDef } from './travelTypeIcon';

describe('travelTypeIcon', () => {
  it('returns appropriate emojis for all standard transport types', () => {
    expect(travelTypeIcon('Flug')).toBe('✈️');
    expect(travelTypeIcon('Flugzeug')).toBe('✈️');
    expect(travelTypeIcon('Zug')).toBe('🚆');
    expect(travelTypeIcon('Bus')).toBe('🚌');
    expect(travelTypeIcon('Auto')).toBe('🚗');
    expect(travelTypeIcon('Fähre')).toBe('⛴️');
    expect(travelTypeIcon('Fahrrad')).toBe('🚲');
    expect(travelTypeIcon('zu Fuß')).toBe('🚶');
  });

  it('handles case-insensitivity for bicycle and walking types', () => {
    expect(travelTypeIcon('fahrrad')).toBe('🚲');
    expect(travelTypeIcon('Zu Fuß')).toBe('🚶');
    expect(travelTypeIcon('zu fuß')).toBe('🚶');
    expect(travelTypeIcon('zu fuss')).toBe('🚶');
  });

  it('falls back to ticket emoji or custom fallback for unknown or null types', () => {
    expect(travelTypeIcon(null)).toBe('🎫');
    expect(travelTypeIcon(undefined as unknown as string)).toBe('🎫');
    expect(travelTypeIcon('Sonstiges')).toBe('🎫');
    expect(travelTypeIcon('Unbekannt')).toBe('🎫');
    expect(travelTypeIcon(null, '📍')).toBe('📍');
  });
});

describe('travelTypeIconDef', () => {
  it('returns matching IconDef with outline/filled for bike and walk', () => {
    const bikeDef = travelTypeIconDef('Fahrrad');
    expect(bikeDef.id).toBe('bike');
    expect(bikeDef.emoji).toBe('🚲');
    expect(bikeDef.outline).toBeDefined();
    expect(bikeDef.filled).toBeDefined();

    const walkDef = travelTypeIconDef('zu Fuß');
    expect(walkDef.id).toBe('walk');
    expect(walkDef.emoji).toBe('🚶');
    expect(walkDef.outline).toBeDefined();
    // IconWalk has no filled variant in Tabler, which is valid and expected
    expect(walkDef.filled).toBeUndefined();
  });

  it('handles case-insensitivity in travelTypeIconDef', () => {
    expect(travelTypeIconDef('fahrrad').id).toBe('bike');
    expect(travelTypeIconDef('Zu Fuß').id).toBe('walk');
  });

  it('returns ticket fallback for null or unknown types', () => {
    const fallback = travelTypeIconDef(null);
    expect(fallback.id).toBe('ticket');
    expect(fallback.emoji).toBe('🎫');
  });
});
