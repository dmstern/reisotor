import { describe, it, expect } from 'vitest';
import { getBaseUrl, getScrollyFeatures, useLandingFeatures } from './useLandingFeatures';

describe('useLandingFeatures', () => {
  describe('getBaseUrl', () => {
    it('appends a trailing slash if missing', () => {
      expect(getBaseUrl('/reisotor')).toBe('/reisotor/');
      expect(getBaseUrl('')).toBe('/');
    });

    it('preserves existing trailing slash', () => {
      expect(getBaseUrl('/reisotor/')).toBe('/reisotor/');
      expect(getBaseUrl('/')).toBe('/');
    });
  });

  describe('getScrollyFeatures', () => {
    it('returns exactly 5 scrolly features', () => {
      const features = getScrollyFeatures('/base/');
      expect(features).toHaveLength(5);
      expect(features.map((f) => f.id)).toEqual([
        'dashboard',
        'spots',
        'budget',
        'packing',
        'diary',
      ]);
    });

    it('correctly prepends baseUrl to screenshot paths', () => {
      const features = getScrollyFeatures('/custom-base/');
      features.forEach((feature) => {
        expect(feature.screenshotLight).toMatch(/^\/custom-base\/landing\//);
        expect(feature.screenshotDark).toMatch(/^\/custom-base\/landing\//);
        expect(feature.screenshotMobileLight).toMatch(/^\/custom-base\/landing\//);
        expect(feature.screenshotMobileDark).toMatch(/^\/custom-base\/landing\//);
      });
    });

    it('each feature has required metadata, icon, highlights and routePill', () => {
      const features = getScrollyFeatures('/');
      features.forEach((feature) => {
        expect(feature.title).toBeTruthy();
        expect(feature.description).toBeTruthy();
        expect(feature.kicker).toBeTruthy();
        expect(feature.highlights.length).toBeGreaterThan(0);
        expect(feature.icon).toBeDefined();
        expect(feature.color).toBeTruthy();
        expect(feature.iconBg).toBeTruthy();
        expect(feature.alt).toBeTruthy();
        expect(feature.routePill).toBeTruthy();
      });
    });
  });

  describe('useLandingFeatures composable', () => {
    it('provides features and links with default options', () => {
      const { scrollyFeatures, baseUrl, repoUrl, demoUrl, storybookUrl } = useLandingFeatures();
      expect(scrollyFeatures).toHaveLength(5);
      expect(baseUrl.endsWith('/')).toBe(true);
      expect(repoUrl).toBeTruthy();
      expect(demoUrl).toBe('./demo/');
      expect(storybookUrl).toBe('./storybook/');
    });

    it('respects custom options', () => {
      const { baseUrl, repoUrl, demoUrl, storybookUrl } = useLandingFeatures({
        baseUrl: '/subpath',
        repoUrl: 'https://github.com/custom/repo',
        demoUrl: '/custom-demo/',
        storybookUrl: '/custom-storybook/',
      });

      expect(baseUrl).toBe('/subpath/');
      expect(repoUrl).toBe('https://github.com/custom/repo');
      expect(demoUrl).toBe('/custom-demo/');
      expect(storybookUrl).toBe('/custom-storybook/');
    });
  });
});
