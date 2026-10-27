import { db } from './db/index.js';
import webpush from 'web-push';

export interface AdminSettingsDto {
  registration: {
    registrationMode: 'off' | 'full' | 'restricted';
    requireEmailVerification: boolean;
  };
  legal: {
    operatorName: string;
    operatorAddress: string;
    contactEmail: string;
    contactPhone: string;
    hostingLocation: string;
  };
  geo: {
    isOrsApiKeySet: boolean;
    photonApiUrl: string;
    nominatimApiUrl: string;
    nominatimEnabled: boolean;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    isSmtpPassSet: boolean;
    smtpFrom: string;
    appUrl: string;
  };
  feedback: {
    githubRepo: string;
    isGithubTokenSet: boolean;
    feedbackRelayForwarding: boolean;
    feedbackRelayUrl: string;
  };
  push: {
    vapidPublicKey: string;
    isVapidPrivateKeySet: boolean;
    vapidSubject: string;
  };
}

export interface UpdateAdminSettingsPayload {
  registration?: {
    registrationMode?: 'off' | 'full' | 'restricted';
    requireEmailVerification?: boolean;
  };
  legal?: {
    operatorName?: string;
    operatorAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
    hostingLocation?: string;
  };
  geo?: {
    orsApiKey?: string;
    clearOrsApiKey?: boolean;
    photonApiUrl?: string;
    nominatimApiUrl?: string;
    nominatimEnabled?: boolean;
  };
  email?: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPass?: string;
    clearSmtpPass?: boolean;
    smtpFrom?: string;
    appUrl?: string;
  };
  feedback?: {
    githubRepo?: string;
    githubToken?: string;
    clearGithubToken?: boolean;
    feedbackRelayForwarding?: boolean;
    feedbackRelayUrl?: string;
  };
  push?: {
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
    clearVapidKeys?: boolean;
    vapidSubject?: string;
  };
}

/**
 * Liest einen Wert aus instance_settings.
 * Gibt null zurück, wenn in der Datenbank kein Eintrag existiert.
 */
export function getInstanceSetting(key: string): string | null {
  try {
    const row = db.prepare('SELECT value FROM instance_settings WHERE key = ?').get(key) as
      { value: string } | undefined;
    if (row && typeof row.value === 'string') {
      return row.value;
    }
  } catch {
    // Falls Tabelle noch nicht existiert (z. B. vor der Initialisierung)
  }
  return null;
}

/**
 * Schreibt oder löscht einen Wert in instance_settings.
 * Bei null wird der Eintrag gelöscht (fällt auf Env-Var-Default zurück).
 */
export function setInstanceSetting(key: string, value: string | null): void {
  if (value === null) {
    db.prepare('DELETE FROM instance_settings WHERE key = ?').run(key);
  } else {
    db.prepare(
      `INSERT INTO instance_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value, new Date().toISOString());
  }
}

/**
 * Ermittelt den effektiven Wert:
 * 1. DB (instance_settings), falls vorhanden
 * 2. process.env, falls vorhanden
 * 3. fallbackDefault
 */
export function getEffectiveSetting(key: string, envVar?: string, fallbackDefault = ''): string {
  const dbVal = getInstanceSetting(key);
  if (dbVal !== null) {
    return dbVal;
  }
  if (envVar && process.env[envVar] !== undefined) {
    return process.env[envVar]!;
  }
  return fallbackDefault;
}

/**
 * Prüft, ob ein Wert (in DB oder Env) konfiguriert und nicht leer ist.
 */
export function isSettingConfigured(key: string, envVar?: string): boolean {
  const val = getEffectiveSetting(key, envVar);
  return Boolean(val && val.trim().length > 0);
}

/**
 * Gibt alle administrativen Einstellungen mit maskierten Geheimnissen zurück.
 */
export function getAllAdminSettings(): AdminSettingsDto {
  const regModeRaw = getEffectiveSetting('registration_mode', 'REGISTRATION_MODE', 'full')
    .trim()
    .toLowerCase();
  const registrationMode =
    regModeRaw === 'off' || regModeRaw === 'restricted' ? regModeRaw : 'full';

  const requireEmailVerification =
    getEffectiveSetting('require_email_verification', 'REQUIRE_EMAIL_VERIFICATION', 'false') ===
    'true';

  const nominatimEnabled =
    getEffectiveSetting('nominatim_enabled', 'NOMINATIM_ENABLED', 'true') !== 'false';

  const smtpPortRaw = Number(getEffectiveSetting('smtp_port', 'SMTP_PORT', '587'));
  const smtpPort = Number.isFinite(smtpPortRaw) && smtpPortRaw > 0 ? smtpPortRaw : 587;

  const smtpSecure =
    getEffectiveSetting('smtp_secure', 'SMTP_SECURE', 'false') === 'true' || smtpPort === 465;

  const feedbackRelayForwarding =
    getEffectiveSetting('feedback_relay_forwarding', 'FEEDBACK_RELAY_FORWARDING', 'true') !==
    'false';

  return {
    registration: {
      registrationMode,
      requireEmailVerification,
    },
    legal: {
      operatorName: getEffectiveSetting('legal_operator_name', 'LEGAL_OPERATOR_NAME', ''),
      operatorAddress: getEffectiveSetting('legal_operator_address', 'LEGAL_OPERATOR_ADDRESS', ''),
      contactEmail: getEffectiveSetting('legal_contact_email', 'LEGAL_CONTACT_EMAIL', ''),
      contactPhone: getEffectiveSetting('legal_contact_phone', 'LEGAL_CONTACT_PHONE', ''),
      hostingLocation: getEffectiveSetting('hosting_location', 'HOSTING_LOCATION', 'Berlin'),
    },
    geo: {
      isOrsApiKeySet: isSettingConfigured('ors_api_key', 'ORS_API_KEY'),
      photonApiUrl: getEffectiveSetting(
        'photon_api_url',
        'PHOTON_API_URL',
        'https://photon.komoot.io/api/'
      ),
      nominatimApiUrl: getEffectiveSetting(
        'nominatim_api_url',
        'NOMINATIM_API_URL',
        'https://nominatim.openstreetmap.org/search'
      ),
      nominatimEnabled,
    },
    email: {
      smtpHost: getEffectiveSetting('smtp_host', 'SMTP_HOST', ''),
      smtpPort,
      smtpSecure,
      smtpUser: getEffectiveSetting('smtp_user', 'SMTP_USER', ''),
      isSmtpPassSet: isSettingConfigured('smtp_pass', 'SMTP_PASS'),
      smtpFrom: getEffectiveSetting('smtp_from', 'SMTP_FROM', ''),
      appUrl:
        getEffectiveSetting('app_url', 'APP_URL') ||
        (process.env.BASE_URL && process.env.BASE_URL.startsWith('http')
          ? process.env.BASE_URL
          : '') ||
        'http://localhost:5173',
    },
    feedback: {
      githubRepo: getEffectiveSetting('github_repo', 'GITHUB_REPO', 'dmstern/reisotor'),
      isGithubTokenSet: isSettingConfigured('github_token', 'GITHUB_TOKEN'),
      feedbackRelayForwarding,
      feedbackRelayUrl: getEffectiveSetting(
        'feedback_relay_url',
        'FEEDBACK_RELAY_URL',
        'https://reise.ruebenherz.de/api/feedback/relay'
      ),
    },
    push: {
      vapidPublicKey: getEffectiveSetting('vapid_public_key', 'VAPID_PUBLIC_KEY', ''),
      isVapidPrivateKeySet: isSettingConfigured('vapid_private_key', 'VAPID_PRIVATE_KEY'),
      vapidSubject: getEffectiveSetting(
        'vapid_subject',
        'VAPID_SUBJECT',
        'mailto:admin@example.com'
      ),
    },
  };
}

/**
 * Aktualisiert Einstellungen in instance_settings anhand des empfangenen Payloads.
 */
export function updateAdminSettings(payload: UpdateAdminSettingsPayload): AdminSettingsDto {
  const setOrDelete = (key: string, val: string | undefined) => {
    if (val !== undefined) {
      const t = val.trim();
      setInstanceSetting(key, t === '' ? null : t);
    }
  };

  if (payload.registration) {
    if (payload.registration.registrationMode !== undefined) {
      const mode = payload.registration.registrationMode;
      if (mode === 'off' || mode === 'full' || mode === 'restricted') {
        setInstanceSetting('registration_mode', mode);
      }
    }
    if (payload.registration.requireEmailVerification !== undefined) {
      setInstanceSetting(
        'require_email_verification',
        payload.registration.requireEmailVerification ? 'true' : 'false'
      );
    }
  }

  if (payload.legal) {
    setOrDelete('legal_operator_name', payload.legal.operatorName);
    setOrDelete('legal_operator_address', payload.legal.operatorAddress);
    setOrDelete('legal_contact_email', payload.legal.contactEmail);
    setOrDelete('legal_contact_phone', payload.legal.contactPhone);
    setOrDelete('hosting_location', payload.legal.hostingLocation);
  }

  if (payload.geo) {
    if (payload.geo.clearOrsApiKey) {
      setInstanceSetting('ors_api_key', null);
    } else if (payload.geo.orsApiKey !== undefined && payload.geo.orsApiKey.trim() !== '') {
      setInstanceSetting('ors_api_key', payload.geo.orsApiKey.trim());
    }
    setOrDelete('photon_api_url', payload.geo.photonApiUrl);
    setOrDelete('nominatim_api_url', payload.geo.nominatimApiUrl);
    if (payload.geo.nominatimEnabled !== undefined) {
      setInstanceSetting('nominatim_enabled', payload.geo.nominatimEnabled ? 'true' : 'false');
    }
  }

  if (payload.email) {
    setOrDelete('smtp_host', payload.email.smtpHost);
    if (payload.email.smtpPort !== undefined) {
      setInstanceSetting('smtp_port', String(payload.email.smtpPort));
    }
    if (payload.email.smtpSecure !== undefined) {
      setInstanceSetting('smtp_secure', payload.email.smtpSecure ? 'true' : 'false');
    }
    setOrDelete('smtp_user', payload.email.smtpUser);
    if (payload.email.clearSmtpPass) {
      setInstanceSetting('smtp_pass', null);
    } else if (payload.email.smtpPass !== undefined && payload.email.smtpPass.trim() !== '') {
      setInstanceSetting('smtp_pass', payload.email.smtpPass.trim());
    }
    setOrDelete('smtp_from', payload.email.smtpFrom);
    setOrDelete('app_url', payload.email.appUrl);
  }

  if (payload.feedback) {
    setOrDelete('github_repo', payload.feedback.githubRepo);
    if (payload.feedback.clearGithubToken) {
      setInstanceSetting('github_token', null);
    } else if (
      payload.feedback.githubToken !== undefined &&
      payload.feedback.githubToken.trim() !== ''
    ) {
      setInstanceSetting('github_token', payload.feedback.githubToken.trim());
    }
    if (payload.feedback.feedbackRelayForwarding !== undefined) {
      setInstanceSetting(
        'feedback_relay_forwarding',
        payload.feedback.feedbackRelayForwarding ? 'true' : 'false'
      );
    }
    setOrDelete('feedback_relay_url', payload.feedback.feedbackRelayUrl);
  }

  if (payload.push) {
    if (payload.push.clearVapidKeys) {
      setInstanceSetting('vapid_public_key', null);
      setInstanceSetting('vapid_private_key', null);
    } else {
      if (payload.push.vapidPublicKey !== undefined && payload.push.vapidPublicKey.trim() !== '') {
        setInstanceSetting('vapid_public_key', payload.push.vapidPublicKey.trim());
      }
      if (
        payload.push.vapidPrivateKey !== undefined &&
        payload.push.vapidPrivateKey.trim() !== ''
      ) {
        setInstanceSetting('vapid_private_key', payload.push.vapidPrivateKey.trim());
      }
    }
    setOrDelete('vapid_subject', payload.push.vapidSubject);
  }

  return getAllAdminSettings();
}

/**
 * Generiert neue VAPID-Schlüssel, speichert sie in instance_settings und gibt sie zurück.
 */
export function generateAndSaveVapidKeys(subject?: string): {
  publicKey: string;
  isPrivateKeySet: boolean;
} {
  const keys = webpush.generateVAPIDKeys();
  setInstanceSetting('vapid_public_key', keys.publicKey);
  setInstanceSetting('vapid_private_key', keys.privateKey);
  if (subject && subject.trim()) {
    setInstanceSetting('vapid_subject', subject.trim());
  }
  return {
    publicKey: keys.publicKey,
    isPrivateKeySet: true,
  };
}
