import type { FastifyPluginAsync } from 'fastify';
import { getEffectiveSetting } from '../instanceSettings.js';

export interface LegalOperator {
  name: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
}

export interface LegalServicesConfig {
  photonUrl: string;
  isCustomPhoton: boolean;
  nominatimEnabled: boolean;
  nominatimUrl: string;
  isCustomNominatim: boolean;
  orsConfigured: boolean;
  githubFeedbackConfigured: boolean;
  feedbackRelayEnabled: boolean;
  pushConfigured: boolean;
}

export interface LegalConfig {
  operator: LegalOperator;
  hasOperatorInfo: boolean;
  services: LegalServicesConfig;
  hostingLocation: string;
}

export function getLegalConfig(): LegalConfig {
  const name = getEffectiveSetting('legal_operator_name', 'LEGAL_OPERATOR_NAME').trim() || null;
  const address =
    getEffectiveSetting('legal_operator_address', 'LEGAL_OPERATOR_ADDRESS').trim() || null;
  const email = getEffectiveSetting('legal_contact_email', 'LEGAL_CONTACT_EMAIL').trim() || null;
  const phone = getEffectiveSetting('legal_contact_phone', 'LEGAL_CONTACT_PHONE').trim() || null;

  const hasOperatorInfo = Boolean(name && address && email);

  const photonUrl =
    getEffectiveSetting(
      'photon_api_url',
      'PHOTON_API_URL',
      'https://photon.komoot.io/api/'
    ).trim() || 'https://photon.komoot.io/api/';
  const isCustomPhoton = Boolean(getEffectiveSetting('photon_api_url', 'PHOTON_API_URL').trim());
  const nominatimEnabled =
    getEffectiveSetting('nominatim_enabled', 'NOMINATIM_ENABLED', 'true') !== 'false';
  const nominatimUrl =
    getEffectiveSetting(
      'nominatim_api_url',
      'NOMINATIM_API_URL',
      'https://nominatim.openstreetmap.org/search'
    ).trim() || 'https://nominatim.openstreetmap.org/search';
  const isCustomNominatim = Boolean(
    getEffectiveSetting('nominatim_api_url', 'NOMINATIM_API_URL').trim()
  );
  const orsConfigured = Boolean(getEffectiveSetting('ors_api_key', 'ORS_API_KEY').trim());
  const githubFeedbackConfigured = Boolean(
    getEffectiveSetting('github_token', 'GITHUB_TOKEN').trim()
  );
  const relayForwarding =
    getEffectiveSetting('feedback_relay_forwarding', 'FEEDBACK_RELAY_FORWARDING', 'true') !==
    'false';
  const relayUrl = getEffectiveSetting('feedback_relay_url', 'FEEDBACK_RELAY_URL');
  const feedbackRelayEnabled = relayForwarding && (relayUrl === '' || Boolean(relayUrl.trim()));
  const pushConfigured = Boolean(
    getEffectiveSetting('vapid_public_key', 'VAPID_PUBLIC_KEY').trim() &&
    getEffectiveSetting('vapid_private_key', 'VAPID_PRIVATE_KEY').trim()
  );
  const hostingLocation =
    getEffectiveSetting('hosting_location', 'HOSTING_LOCATION', 'Berlin').trim() || 'Berlin';

  return {
    operator: { name, address, email, phone },
    hasOperatorInfo,
    services: {
      photonUrl,
      isCustomPhoton,
      nominatimEnabled,
      nominatimUrl,
      isCustomNominatim,
      orsConfigured,
      githubFeedbackConfigured,
      feedbackRelayEnabled,
      pushConfigured,
    },
    hostingLocation,
  };
}

export const legalRoutes: FastifyPluginAsync = async (app) => {
  // Öffentlicher Endpunkt für Impressum & Datenschutzerklärung (auch ohne Login erreichbar)
  app.get('/legal', async () => {
    return getLegalConfig();
  });
};
