// Sortiert erledigte/abgehakte Items ans Ende einer Liste, unabhängig vom Sekundär-Comparator -
// extrahiert aus TodoView.vues ursprünglich lokaler sortItems(), damit ShoppingListView.vue und
// PackingListView.vue dasselbe "abgehakt -> ans Ende, ausgegraut" Verhalten nutzen können, statt es
// je View neu zu bauen (siehe CLAUDE.md "Konsistenz-Check": ein zentrales Verhalten statt mehrerer
// Ad-hoc-Implementierungen, die später auseinanderdriften können).
export function sortWithDoneLast<T>(
  list: T[],
  isDone: (item: T) => boolean,
  compare?: (a: T, b: T) => number
): T[] {
  return [...list].sort((a, b) => {
    const doneA = isDone(a);
    const doneB = isDone(b);
    if (doneA !== doneB) return doneA ? 1 : -1;
    return compare ? compare(a, b) : 0;
  });
}
