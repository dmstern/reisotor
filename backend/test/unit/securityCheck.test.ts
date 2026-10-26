import { describe, expect, it } from 'vitest';
import {
  classifyAuditReport,
  computeCooldownDate,
  formatSecurityMarkdown,
  parseArgs,
  validatePackageJsonPolicies,
} from '../../../scripts/security-check.mjs';

describe('scripts/security-check.mjs unit tests', () => {
  describe('computeCooldownDate', () => {
    it('calculates the date exactly N days in the past', () => {
      const fixedNow = new Date('2026-10-26T12:00:00.000Z');
      const result7 = computeCooldownDate(7, fixedNow);
      expect(result7).toBe('2026-10-19T12:00:00.000Z');

      const result3 = computeCooldownDate(3, fixedNow);
      expect(result3).toBe('2026-10-23T12:00:00.000Z');
    });

    it('throws RangeError for invalid or non-positive days', () => {
      expect(() => computeCooldownDate(0)).toThrow(RangeError);
      expect(() => computeCooldownDate(-5)).toThrow(RangeError);
      expect(() => computeCooldownDate(NaN)).toThrow(RangeError);
    });
  });

  describe('validatePackageJsonPolicies', () => {
    it('detects violations for floating tags, wildcards, unbounded ranges, and insecure protocols', () => {
      const samplePkg = {
        dependencies: {
          vite: 'npm:rolldown-vite@latest',
          insecure: 'http://example.com/pkg.tar.gz',
          gitInsecure: 'git://github.com/foo/bar.git',
          gitHttp: 'git+http://github.com/foo/bar.git',
          unboundedRange: '>=2.0.0',
          valid1: '^1.2.3',
        },
        devDependencies: {
          wildcard: '*',
          nextTag: 'next',
          aliasedNext: 'npm:pkg@next',
          valid2: '~2.0.0',
        },
      };

      const violations = validatePackageJsonPolicies(samplePkg, 'frontend/package.json');
      expect(violations).toHaveLength(8);

      const deps = violations.map((v) => v.dependency);
      expect(deps).toContain('vite');
      expect(deps).toContain('insecure');
      expect(deps).toContain('gitInsecure');
      expect(deps).toContain('gitHttp');
      expect(deps).toContain('unboundedRange');
      expect(deps).toContain('wildcard');
      expect(deps).toContain('nextTag');
      expect(deps).toContain('aliasedNext');
    });

    it('returns empty array when all dependencies use pinned or valid SemVer specifiers', () => {
      const validPkg = {
        dependencies: {
          fastify: '^4.28.1',
          sqlite: '5.1.1',
        },
        devDependencies: {
          vitest: '^2.1.0',
          typescript: '~5.6.0',
        },
      };

      const violations = validatePackageJsonPolicies(validPkg);
      expect(violations).toEqual([]);
    });
  });

  describe('parseArgs', () => {
    it('parses valid args and applies defaults', () => {
      expect(parseArgs(['--check'])).toEqual({
        mode: 'check',
        cooldownDays: 3,
        summaryFile: null,
        strictAll: false,
      });

      expect(parseArgs(['--update', '--cooldown-days=10', '--strict-all'])).toEqual({
        mode: 'update',
        cooldownDays: 10,
        summaryFile: null,
        strictAll: true,
      });
    });

    it('throws RangeError for invalid cooldown-days in parseArgs', () => {
      expect(() => parseArgs(['--cooldown-days=0'])).toThrow(RangeError);
      expect(() => parseArgs(['--cooldown-days=-3'])).toThrow(RangeError);
      expect(() => parseArgs(['--cooldown-days=invalid'])).toThrow(RangeError);
    });
  });

  describe('classifyAuditReport', () => {
    it('classifies autoFixable and manualBreaking vulnerabilities correctly', () => {
      const auditJson = {
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 1,
            high: 2,
            critical: 0,
            total: 3,
          },
        },
        vulnerabilities: {
          'brace-expansion': {
            name: 'brace-expansion',
            severity: 'high',
            isDirect: false,
            fixAvailable: true,
          },
          vite: {
            name: 'vite',
            severity: 'high',
            isDirect: false,
            fixAvailable: {
              name: 'vite',
              version: '8.3.5',
              isSemVerMajor: false,
            },
          },
          fastify: {
            name: 'fastify',
            severity: 'high',
            isDirect: true,
            fixAvailable: {
              name: 'fastify',
              version: '5.0.0',
              isSemVerMajor: true,
            },
          },
          unfixable: {
            name: 'unfixable',
            severity: 'moderate',
            isDirect: false,
            fixAvailable: false,
          },
        },
      };

      const classified = classifyAuditReport(auditJson, 'backend');
      expect(classified.dir).toBe('backend');
      expect(classified.counts.total).toBe(3);

      expect(classified.autoFixable).toHaveLength(2);
      expect(classified.autoFixable.map((v) => v.name)).toEqual(['brace-expansion', 'vite']);

      expect(classified.manualBreaking).toHaveLength(2);
      expect(classified.manualBreaking.map((v) => v.name)).toEqual(['fastify', 'unfixable']);
      expect(classified.manualBreaking[0].targetPkg).toBe('fastify');
      expect(classified.manualBreaking[0].reason).toContain('Major version upgrade');
    });
  });

  describe('formatSecurityMarkdown', () => {
    it('produces formatted markdown table and alert sections', () => {
      const results = [
        {
          dir: '.',
          counts: { total: 0, low: 0, moderate: 0, high: 0, critical: 0 },
          autoFixable: [],
          manualBreaking: [],
        },
        {
          dir: 'backend',
          counts: { total: 1, low: 0, moderate: 0, high: 1, critical: 0 },
          autoFixable: [],
          manualBreaking: [
            {
              name: 'fastify',
              severity: 'high',
              isDirect: true,
              reason: 'Major version upgrade required (fastify@5.0.0)',
            },
          ],
        },
      ];

      const markdown = formatSecurityMarkdown(results, [], 'check');
      expect(markdown).toContain('## 🛡️ Security Audit Report');
      expect(markdown).toContain('✅ **Dependency-Policy:**');
      expect(markdown).toContain('| `backend` | 1 | 0 | 0 | 1 | 0 | 0 | ℹ️ 1 |');
      expect(markdown).toContain('Manuelle Major-Upgrades erforderlich (Breaking Changes)');
      expect(markdown).toContain('fastify');
    });
  });
});
