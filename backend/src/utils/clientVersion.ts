export interface SemverVersion {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)/;
const MAJOR_GROUP_INDEX = 1;
const MINOR_GROUP_INDEX = 2;
const PATCH_GROUP_INDEX = 3;
const DECIMAL_RADIX = 10;

export function parseSemver(version: string | null | undefined): SemverVersion | null {
  if (typeof version !== 'string') {
    return null;
  }

  const trimmed = version.trim();

  if (!trimmed) {
    return null;
  }

  const match = SEMVER_REGEX.exec(trimmed);

  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[MAJOR_GROUP_INDEX], DECIMAL_RADIX),
    minor: Number.parseInt(match[MINOR_GROUP_INDEX], DECIMAL_RADIX),
    patch: Number.parseInt(match[PATCH_GROUP_INDEX], DECIMAL_RADIX),
  };
}

export function isVersionBelowMin(
  clientVersion: string | null | undefined,
  minClientVersion: string | null | undefined
): boolean {
  const client = parseSemver(clientVersion);
  const min = parseSemver(minClientVersion);

  if (!client || !min) {
    return false;
  }

  if (client.major !== min.major) {
    return client.major < min.major;
  }

  if (client.minor !== min.minor) {
    return client.minor < min.minor;
  }

  return client.patch < min.patch;
}
