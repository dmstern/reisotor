import { describe, expect, it } from 'vitest';
import { isVersionBelowMin, parseSemver } from '../../src/utils/clientVersion.js';

describe('clientVersion SemVer helpers', () => {
  it('parses standard versions and strips suffixes like -dev, -staging, (Demo), and v prefix', () => {
    expect(parseSemver('2.2.0')).toEqual({ major: 2, minor: 2, patch: 0 });
    expect(parseSemver('v2.1.5')).toEqual({ major: 2, minor: 1, patch: 5 });
    expect(parseSemver('2.2.0-dev')).toEqual({ major: 2, minor: 2, patch: 0 });
    expect(parseSemver('2.2.0-staging')).toEqual({ major: 2, minor: 2, patch: 0 });
    expect(parseSemver('2.2.0 (Demo)')).toEqual({ major: 2, minor: 2, patch: 0 });
  });

  it('returns null for invalid, empty, or unknown versions', () => {
    expect(parseSemver(null)).toBeNull();
    expect(parseSemver(undefined)).toBeNull();
    expect(parseSemver('')).toBeNull();
    expect(parseSemver('   ')).toBeNull();
    expect(parseSemver('unknown')).toBeNull();
    expect(parseSemver('2.2')).toBeNull();
  });

  it('compares major, minor, and patch versions accurately', () => {
    expect(isVersionBelowMin('1.9.9', '2.0.0')).toBe(true);
    expect(isVersionBelowMin('2.1.5', '2.2.0')).toBe(true);
    expect(isVersionBelowMin('2.2.0', '2.2.1')).toBe(true);

    expect(isVersionBelowMin('2.2.0', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.2.0-dev', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.2.0-staging', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.2.0 (Demo)', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('v2.3.0', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('3.0.0', '2.9.9')).toBe(false);
  });

  it('returns false defensively when either version cannot be parsed', () => {
    expect(isVersionBelowMin('unknown', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.0.0', null)).toBe(false);
    expect(isVersionBelowMin('2.0.0', 'invalid')).toBe(false);
    expect(isVersionBelowMin(undefined, '2.0.0')).toBe(false);
  });
});
