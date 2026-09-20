/** Liest einen Querverweis-Hash wie "#todo-123" (der Router scrollt über scrollBehavior/
 *  waitForElement bereits automatisch zu einem Element mit dieser id, siehe router/index.ts) und
 *  liefert dessen numerische id, falls der Hash zur übergebenen Domäne passt – sonst null. Views
 *  nutzen diese id, um das Element gezielt im Brand-Fokusrahmen hervorzuheben (entkoppelt von
 *  den grünen LiveSync-Hervorhebungen neu erstellter Elemente). */
export function hashHighlightId(hash: string, domain: string): number | null {
  const match = new RegExp(`^#${domain}-(\\d+)$`).exec(hash);
  return match ? Number(match[1]) : null;
}
