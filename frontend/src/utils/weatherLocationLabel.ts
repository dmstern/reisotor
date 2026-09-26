/**
 * Formatiert transparente Ortsbezeichnungen für die "Heute"-Wetterzeile im Dashboard,
 * damit Nutzer:innen (besonders nach Urlaubsende) eindeutig zwischen Heimatort und
 * Urlaubsort unterscheiden können.
 */

export function formatDestinationLocationLabel(
  destination?: string | null,
  tripName?: string | null
): string {
  const dest = destination?.trim();
  if (dest) return `in ${dest}`;
  const name = tripName?.trim();
  if (name) return `am Reiseziel (${name})`;
  return 'am Reiseziel';
}

export function formatHomeLocationLabel(homeTitle?: string | null): string {
  const title = homeTitle?.trim();
  if (!title || title.toLowerCase() === 'zuhause') return 'zuhause';
  return `in ${title}`;
}

export function formatOverDestinationLabel(
  destination?: string | null,
  tripName?: string | null
): string {
  const name = destination?.trim() || tripName?.trim();
  return name ? `am Reiseziel (${name})` : 'am Reiseziel';
}
