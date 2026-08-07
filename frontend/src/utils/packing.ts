import type { PackingItem } from '../api/types';

// Gemeinsame Definition von "vollständig eingepackt", genutzt sowohl für die Anzeige (PackingItem.vue)
// als auch für die Sortierung abgehakter Einträge ans Listenende (PackingListView.vue) - eine Stelle
// statt zweier Kopien, die sonst leicht auseinanderdriften könnten.
export function isFullyPacked(item: Pick<PackingItem, 'packed_count' | 'quantity'>): boolean {
  return item.packed_count >= item.quantity;
}
