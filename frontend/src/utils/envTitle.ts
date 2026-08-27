import { DEMO_MODE } from '../demo/isDemoMode';

/**
 * Ermittelt den HTML-Dokument-Titel mit Umgebungs-Suffix für Dev, Demo und Staging.
 * Produktion bleibt unverändert ("Reisotor").
 */
export function getAppTitle(env?: string | null, isDemo = DEMO_MODE): string {
  if (isDemo) {
    return 'Reisotor (Demo)';
  }
  const targetEnv = env ?? (import.meta.env.DEV ? 'development' : 'production');
  if (targetEnv === 'staging') {
    return 'Reisotor (Staging)';
  }
  if (targetEnv === 'development') {
    return 'Reisotor (Local Dev)';
  }
  return 'Reisotor';
}
