import type { FastifyPluginAsync } from 'fastify';

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
  pushConfigured: boolean;
}

export interface LegalConfig {
  operator: LegalOperator;
  hasOperatorInfo: boolean;
  services: LegalServicesConfig;
  hostingLocation: string;
}

export function getLegalConfig(): LegalConfig {
  const name = process.env.LEGAL_OPERATOR_NAME?.trim() || null;
  const address = process.env.LEGAL_OPERATOR_ADDRESS?.trim() || null;
  const email = process.env.LEGAL_CONTACT_EMAIL?.trim() || null;
  const phone = process.env.LEGAL_CONTACT_PHONE?.trim() || null;

  const hasOperatorInfo = Boolean(name && address && email);

  const photonUrl = process.env.PHOTON_API_URL?.trim() || 'https://photon.komoot.io/api/';
  const isCustomPhoton = Boolean(process.env.PHOTON_API_URL?.trim());
  const nominatimEnabled = process.env.NOMINATIM_ENABLED !== 'false';
  const nominatimUrl =
    process.env.NOMINATIM_API_URL?.trim() || 'https://nominatim.openstreetmap.org/search';
  const isCustomNominatim = Boolean(process.env.NOMINATIM_API_URL?.trim());
  const orsConfigured = Boolean(process.env.ORS_API_KEY?.trim());
  const githubFeedbackConfigured = Boolean(process.env.GITHUB_TOKEN?.trim());
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY?.trim());
  const hostingLocation = process.env.HOSTING_LOCATION?.trim() || 'Berlin';

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
