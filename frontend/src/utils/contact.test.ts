import { describe, expect, it } from 'vitest';
import { parseContact } from './contact';

describe('parseContact', () => {
  it('recognizes a plain email address', () => {
    expect(parseContact('reservas@hotel.example')).toEqual({ kind: 'email', href: 'mailto:reservas@hotel.example' });
  });

  it('recognizes a formatted phone number (spaces, parens, dashes) with >=6 digits', () => {
    const result = parseContact('+49 (0)30 123-4567');
    expect(result).toEqual({ kind: 'phone', href: 'tel:+490301234567' });
  });

  it('does not misclassify a short digit sequence (e.g. a room number) as a phone number', () => {
    expect(parseContact('12').kind).toBe('text');
    expect(parseContact('Zimmer 12').kind).toBe('text');
  });

  it('falls back to text for free text with an embedded URL (deferred to renderRichText)', () => {
    expect(parseContact('Rosa (über AirBnB) https://airbnb.com/xyz').kind).toBe('text');
  });

  it('falls back to text for an empty/whitespace-only string', () => {
    expect(parseContact('').kind).toBe('text');
    expect(parseContact('   ').kind).toBe('text');
  });
});
