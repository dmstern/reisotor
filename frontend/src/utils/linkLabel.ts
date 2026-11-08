/** Zeigt statt der vollen (oft langen, hässlich umbrechenden) URL nur die Domain an – ohne
 *  führendes "www." (spart Platz) und mit „…“, wenn danach noch Pfad/Query/Hash abgeschnitten
 *  wird, sonst ohne. Fällt bei kaputten URLs (z. B. mitten im Tippen abgeschnitten) auf den
 *  übergebenen Fallback-Text zurück. Zentral statt pro Komponente dupliziert, damit externe
 *  Link-Buttons app-weit gleich aussehen (Notizen-Auto-Links, Buchungs-Link bei Unterkunft/Reise, …). */
export function linkLabel(href: string, fallback: string = href): string {
  try {
    const normalized = /^[a-z]+:\/\//i.test(href) ? href : `https://${href}`;
    const url = new URL(normalized);
    const hostname = url.hostname.replace(/^www\./, '');
    const hasMore = (url.pathname && url.pathname !== '/') || url.search || url.hash;
    return hasMore ? `${hostname}…` : hostname;
  } catch {
    return fallback;
  }
}

/**
 * Sanfte Autokorrektur für Web- und Buchungs-Links:
 * Stellt fehlendes "https://" voran, falls kein Protokoll angegeben wurde.
 */
export function normalizeWebUrl(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  if (/^[a-z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}
