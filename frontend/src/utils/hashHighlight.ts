/** Liest einen Querverweis-Hash wie "#todo-123" (der Router scrollt über scrollBehavior/
 *  waitForElement bereits automatisch zu einem Element mit dieser id, siehe router/index.ts) und
 *  liefert dessen numerische id, falls der Hash zur übergebenen Domäne passt – sonst null. Views
 *  rufen das einmalig in onMounted auf, um die referenzierte id zusätzlich zu den bereits über
 *  liveSync.markSeen() ermittelten "neu seit letztem Besuch"-ids in dieselbe highlightedIds-Menge
 *  (new-highlight-Klasse) aufzunehmen – kein zweites, paralleles Hervorhebungs-System. */
export function hashHighlightId(hash: string, domain: string): number | null {
  const match = new RegExp(`^#${domain}-(\\d+)$`).exec(hash);
  return match ? Number(match[1]) : null;
}
