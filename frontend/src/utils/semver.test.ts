import { describe, expect, it } from 'vitest';
import { isVersionBelowMin, parseSemver } from './semver';

describe('semver utility', () => {
  it('parses SemVer strings with optional v prefix and environment suffixes', () => {
    expect(parseSemver('2.2.0')).toEqual({ major: 2, minor: 2, patch: 0 });
    expect(parseSemver('v2.2.1')).toEqual({ major: 2, minor: 2, patch: 1 });
    expect(parseSemver('2.2.0-dev')).toEqual({ major: 2, minor: 2, patch: 0 });
    expect(parseSemver('2.2.0-staging')).toEqual({ major: 2, minor: 2, patch: 0 });
    expect(parseSemver('2.2.0 (Demo)')).toEqual({ major: 2, minor: 2, patch: 0 });
  });

  it('returns null for invalid or empty inputs', () => {
    expect(parseSemver(null)).toBeNull();
    expect(parseSemver(undefined)).toBeNull();
    expect(parseSemver('')).toBeNull();
    expect(parseSemver('unknown')).toBeNull();
    expect(parseSemver('not-a-version')).toBeNull();
  });

  it('detects when client version is strictly lower than minClientVersion', () => {
    expect(isVersionBelowMin('1.9.0', '2.0.0')).toBe(true);
    expect(isVersionBelowMin('2.1.9', '2.2.0')).toBe(true);
    expect(isVersionBelowMin('2.2.0', '2.2.1')).toBe(true);

    expect(isVersionBelowMin('2.2.0-dev', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.2.0', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.3.0', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('unknown', '2.2.0')).toBe(false);
    expect(isVersionBelowMin('2.0.0', null)).toBe(false);
  });
});
