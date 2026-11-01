import { describe, expect, it } from 'vitest';
import {
  matchingLevel,
  NOTIFICATION_DOMAINS,
  NOTIFICATION_LEVEL_PRESETS,
  type NotificationPreferences,
} from './notificationPreferences';

describe('notificationPreferences utils', () => {
  it('includes version in NOTIFICATION_DOMAINS', () => {
    expect(NOTIFICATION_DOMAINS).toContain('version');
  });

  it('matches presets correctly when activity_updates is true or omitted', () => {
    const balanced = NOTIFICATION_LEVEL_PRESETS.balanced;
    expect(matchingLevel(balanced)).toBe('balanced');

    const essential = NOTIFICATION_LEVEL_PRESETS.essential;
    expect(matchingLevel(essential)).toBe('essential');

    const all = NOTIFICATION_LEVEL_PRESETS.all;
    expect(matchingLevel(all)).toBe('all');
  });

  it('treats activity_updates: false as custom (not matching any standard preset)', () => {
    const custom: NotificationPreferences = {
      ...NOTIFICATION_LEVEL_PRESETS.balanced,
      activity_updates: false,
    };
    expect(matchingLevel(custom)).toBeNull();
  });

  it('treats toggling a domain off as custom', () => {
    const custom: NotificationPreferences = {
      ...NOTIFICATION_LEVEL_PRESETS.all,
      version: false,
    };
    expect(matchingLevel(custom)).toBeNull();
  });
});
