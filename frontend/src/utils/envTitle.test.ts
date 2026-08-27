import { describe, expect, it } from 'vitest';
import { getAppTitle } from './envTitle';

describe('getAppTitle', () => {
  it('returns Reisotor (Demo) when isDemo is true', () => {
    expect(getAppTitle('production', true)).toBe('Reisotor (Demo)');
    expect(getAppTitle('development', true)).toBe('Reisotor (Demo)');
    expect(getAppTitle('staging', true)).toBe('Reisotor (Demo)');
  });

  it('returns Reisotor (Staging) when env is staging', () => {
    expect(getAppTitle('staging', false)).toBe('Reisotor (Staging)');
  });

  it('returns Reisotor (Local Dev) when env is development', () => {
    expect(getAppTitle('development', false)).toBe('Reisotor (Local Dev)');
  });

  it('returns Reisotor when env is production', () => {
    expect(getAppTitle('production', false)).toBe('Reisotor');
  });

  it('falls back to development/production when env is not provided', () => {
    const title = getAppTitle(null, false);
    expect(['Reisotor (Local Dev)', 'Reisotor']).toContain(title);
  });
});
