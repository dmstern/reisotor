import { describe, it, expect } from 'vitest';
import { linkLabel, normalizeWebUrl } from './linkLabel';

describe('linkLabel', () => {
  it('strips www. and shows ellipsis when path or query follows', () => {
    expect(linkLabel('https://www.booking.com/hotel/de/ferienpark.html')).toBe('booking.com…');
    expect(linkLabel('https://www.airbnb.de/rooms/12345')).toBe('airbnb.de…');
  });

  it('shows hostname without ellipsis for root URLs', () => {
    expect(linkLabel('https://www.booking.com')).toBe('booking.com');
    expect(linkLabel('https://booking.com/')).toBe('booking.com');
  });

  it('handles schemeless URLs gracefully', () => {
    expect(linkLabel('booking.com/hotel/at/sacher.html')).toBe('booking.com…');
  });

  it('returns fallback for completely invalid URLs', () => {
    expect(linkLabel('not a url %%%', 'Fallback')).toBe('Fallback');
  });
});

describe('normalizeWebUrl', () => {
  it('adds https:// if missing', () => {
    expect(normalizeWebUrl('booking.com')).toBe('https://booking.com');
    expect(normalizeWebUrl('www.airbnb.de/rooms/123')).toBe('https://www.airbnb.de/rooms/123');
  });

  it('preserves existing http:// or https://', () => {
    expect(normalizeWebUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeWebUrl('https://example.com/test')).toBe('https://example.com/test');
  });

  it('handles empty or whitespace input', () => {
    expect(normalizeWebUrl('')).toBe('');
    expect(normalizeWebUrl('   ')).toBe('');
    expect(normalizeWebUrl(null)).toBe('');
    expect(normalizeWebUrl(undefined)).toBe('');
  });
});
