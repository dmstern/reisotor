export function getCssVar(name: string): string {
  if (typeof window === 'undefined' || !window.getComputedStyle) return '';
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(name);
    return val ? val.trim() : '';
  } catch (e) {
    return '';
  }
}
