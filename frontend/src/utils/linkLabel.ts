/** Zeigt statt der vollen (oft langen, hässlich umbrechenden) URL nur die Domain an – ohne
 *  führendes "www." (spart Platz) und mit „…“, wenn danach noch Pfad/Query/Hash abgeschnitten
 *  wird, sonst ohne. Fällt bei kaputten URLs (z. B. mitten im Tippen abgeschnitten) auf den
 *  übergebenen Fallback-Text zurück. Zentral statt pro Komponente dupliziert, damit externe
 *  Link-Buttons app-weit gleich aussehen (Notizen-Auto-Links, Buchungs-Link bei Unterkunft/Reise, …). */
export function linkLabel(href: string, fallback: string = href): string {
  try {
    const url = new URL(href);
    const hostname = url.hostname.replace(/^www\./, '');
    const hasMore = (url.pathname && url.pathname !== '/') || url.search || url.hash;
    return hasMore ? `${hostname}…` : hostname;
  } catch {
    return fallback;
  }
}
