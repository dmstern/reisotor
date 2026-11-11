import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findBaseRelease,
  parseChangelogSection,
  readPendingReleaseNotes,
} from '../../scripts/generate-build-info.mjs';

describe('generate-build-info changelog helpers', () => {
  it('parses a changelog section with groups and notes correctly', () => {
    const section = `## [2.0.0] - 2026-11-01

### Highlights

- 🎨 **Neues Design**: Modernes Layout
- ✉️ **Registrierung**: E-Mail Bestätigung

### Karte und Navigation

- 🗺️ **Kartenmenü**: Schnellzugriff
`;

    const parsed = parseChangelogSection(section);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe('2.0.0');
    expect(parsed?.date).toBe('2026-11-01');
    expect(parsed?.groups).toHaveLength(2);
    expect(parsed?.groups?.[0].title).toBe('Highlights');
    expect(parsed?.groups?.[0].notes).toHaveLength(2);
    expect(parsed?.notes).toHaveLength(3);
  });

  it('clusters multiple pending fragment files with identical headings and sorts by GROUP_PRIORITY', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-rn-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'z-design-feature.md'),
        '### Design und Bedienung\n\n- 🖐️ **3D-Effekte**: Taktile Karten.\n'
      );
      fs.writeFileSync(
        path.join(tempDir, 'a-spot-feature-1.md'),
        '### Spots, Touren und Unterkünfte\n\n- 📍 **Spot-Suche**: Schneller finden.\n'
      );
      fs.writeFileSync(
        path.join(tempDir, 'b-spot-feature-2.md'),
        [
          '### Spots, Touren und Unterkünfte',
          '',
          '- ✏️ **Direkt bearbeiten**: Stift-Icon auf Karten.',
          '',
          '### Highlights',
          '',
          '- ✨ **Buchungs-Links**: Automatisch erkennen.',
        ].join('\n')
      );

      const pending = readPendingReleaseNotes(tempDir);

      expect(pending.groups).toHaveLength(3);
      expect(pending.groups.map((group) => group.title)).toEqual([
        'Highlights',
        'Spots, Touren und Unterkünfte',
        'Design und Bedienung',
      ]);
      expect(pending.groups[0].notes).toEqual(['✨ **Buchungs-Links**: Automatisch erkennen.']);
      expect(pending.groups[1].notes).toEqual([
        '📍 **Spot-Suche**: Schneller finden.',
        '✏️ **Direkt bearbeiten**: Stift-Icon auf Karten.',
      ]);
      expect(pending.groups[2].notes).toEqual(['🖐️ **3D-Effekte**: Taktile Karten.']);
      expect(pending.notes).toHaveLength(4);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null for findBaseRelease when version is a major or minor release (patch === 0)', () => {
    const entries = [
      { version: '2.0.0', date: '2026-11-01', notes: [] },
      { version: '1.3.0', date: '2026-08-22', notes: [] },
    ];

    expect(findBaseRelease('2.0.0', entries)).toBeNull();
    expect(findBaseRelease('2.0.0-dev', entries)).toBeNull();
    expect(findBaseRelease('2.1.0-staging', entries)).toBeNull();
  });

  it('finds exact base release X.Y.0 when current version is a patch release (patch > 0)', () => {
    const base200 = {
      version: '2.0.0',
      date: '2026-11-01',
      notes: ['Highlight 1'],
      groups: [{ title: 'Highlights', notes: ['Highlight 1'] }],
    };
    const entries = [
      { version: '2.0.1', date: '2026-11-03', notes: ['Bugfix'] },
      base200,
      { version: '1.3.0', date: '2026-08-22', notes: [] },
    ];

    const found = findBaseRelease('2.0.1', entries);
    expect(found).toEqual(base200);

    const foundDev = findBaseRelease('2.0.1-dev', entries);
    expect(foundDev).toEqual(base200);
  });

  it('falls back to earlier base release when exact X.Y.0 does not exist', () => {
    const base100 = {
      version: '1.0.0',
      date: '2026-05-01',
      notes: ['Base 1.0'],
    };
    const entries = [{ version: '1.0.2', date: '2026-05-10', notes: ['Patch 2'] }, base100];

    const found = findBaseRelease('1.0.2', entries);
    expect(found).toEqual(base100);
  });
});
