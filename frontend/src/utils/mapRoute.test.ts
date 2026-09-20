// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { imagePin, cachedImagePin } from './mapRoute';

describe('mapRoute - imagePin and cachedImagePin', () => {
  it('creates an L.DivIcon with thumbnail image and fallback', () => {
    const icon = imagePin('https://example.com/test.jpg', '#9141ac', false);
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('photo-marker-pin');
    expect(icon.options.iconSize).toEqual([42, 42]);
    expect(icon.options.iconAnchor).toEqual([21, 42]);

    const html = icon.options.html as string;
    expect(html).toContain('src="https://example.com/test.jpg"');
    expect(html).toContain('🖼️');
    expect(html).toContain('background:#9141ac');
    expect(html).not.toContain('photo-map-pin--large');
  });

  it('creates large variant when large=true', () => {
    const icon = imagePin('https://example.com/test.jpg', '#9141ac', true);
    expect(icon.options.iconSize).toEqual([56, 56]);
    expect(icon.options.iconAnchor).toEqual([28, 56]);

    const html = icon.options.html as string;
    expect(html).toContain('photo-map-pin--large');
  });

  it('escapes special characters in image URL', () => {
    const unsafeUrl = 'https://example.com/photo"with<quotes>&amp.jpg';
    const icon = imagePin(unsafeUrl, '#9141ac', false);
    const html = icon.options.html as string;
    expect(html).toContain('src="https://example.com/photo&quot;with&lt;quotes&gt;&amp;amp.jpg"');
    expect(html).not.toContain('photo"with');
  });

  it('renders dateBadge when provided', () => {
    const iconWithBadge = imagePin('https://example.com/pic.jpg', '#9141ac', false, '15.07.');
    const html = iconWithBadge.options.html as string;
    expect(html).toContain('<span class="photo-pin-date-badge">15.07.</span>');

    const iconWithoutBadge = imagePin('https://example.com/pic.jpg', '#9141ac', false);
    const htmlWithout = iconWithoutBadge.options.html as string;
    expect(htmlWithout).not.toContain('photo-pin-date-badge');
  });

  it('caches icons correctly in cachedImagePin including dateBadge', () => {
    const icon1 = cachedImagePin('https://example.com/pic.jpg', '#9141ac', false);
    const icon2 = cachedImagePin('https://example.com/pic.jpg', '#9141ac', false);
    expect(icon1).toBe(icon2);

    const iconLarge = cachedImagePin('https://example.com/pic.jpg', '#9141ac', true);
    expect(iconLarge).not.toBe(icon1);

    const iconWithBadge = cachedImagePin('https://example.com/pic.jpg', '#9141ac', false, '15.07.');
    expect(iconWithBadge).not.toBe(icon1);

    const iconWithBadge2 = cachedImagePin(
      'https://example.com/pic.jpg',
      '#9141ac',
      false,
      '15.07.'
    );
    expect(iconWithBadge2).toBe(iconWithBadge);

    const iconOtherUrl = cachedImagePin('https://example.com/other.jpg', '#9141ac', false);
    expect(iconOtherUrl).not.toBe(icon1);
  });
});
