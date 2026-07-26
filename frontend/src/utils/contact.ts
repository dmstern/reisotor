export type ContactKind = 'phone' | 'email' | 'text';

export interface ParsedContact {
  kind: ContactKind;
  href?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Erlaubt +, Ziffern, Leerzeichen, Klammern, Bindestriche, Slash. Mindestens 6 Ziffern insgesamt,
// damit kurze Zahlenfolgen (z. B. eine Zimmernummer "12") nicht fälschlich als Telefonnummer gelten.
const PHONE_CHARS_PATTERN = /^[+\d][\d\s()\-/]*$/;

/** Erkennt, ob ein frei eingegebener Kontakt-Text eine reine Telefonnummer oder E-Mail-Adresse
 *  ist, um ihn als tel:/mailto:-Link darzustellen. Alles andere (auch ein Text MIT eingebettetem
 *  Link, z. B. "Rosa (über AirBnB) https://...") fällt auf 'text' zurück – dort übernimmt
 *  renderRichText/formatInline die automatische Link-Erkennung innerhalb des Fließtexts. */
export function parseContact(raw: string): ParsedContact {
  const trimmed = raw.trim();

  if (EMAIL_PATTERN.test(trimmed)) {
    return { kind: 'email', href: `mailto:${trimmed}` };
  }

  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount >= 6 && PHONE_CHARS_PATTERN.test(trimmed)) {
    return { kind: 'phone', href: `tel:${trimmed.replace(/[\s()\-/]/g, '')}` };
  }

  return { kind: 'text' };
}
