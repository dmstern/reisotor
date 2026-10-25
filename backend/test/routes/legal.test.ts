import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

const LEGAL_ENV_KEYS = [
  'LEGAL_OPERATOR_NAME',
  'LEGAL_OPERATOR_ADDRESS',
  'LEGAL_CONTACT_EMAIL',
  'LEGAL_CONTACT_PHONE',
  'PHOTON_API_URL',
  'NOMINATIM_ENABLED',
  'NOMINATIM_API_URL',
  'ORS_API_KEY',
  'GITHUB_TOKEN',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'HOSTING_LOCATION',
] as const;

describe('legal routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  function clearLegalEnv() {
    for (const key of LEGAL_ENV_KEYS) {
      delete process.env[key];
    }
  }

  beforeEach(clearLegalEnv);
  afterEach(clearLegalEnv);

  it('is accessible without authentication and returns default configuration', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/legal',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('operator');
    expect(body).toHaveProperty('hasOperatorInfo');
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('hostingLocation');

    expect(body.hasOperatorInfo).toBe(false);
    expect(body.operator.name).toBeNull();
    expect(body.operator.address).toBeNull();
    expect(body.operator.email).toBeNull();
    expect(body.services.isCustomPhoton).toBe(false);
    expect(body.services.photonUrl).toBe('https://photon.komoot.io/api/');
    expect(body.services.nominatimEnabled).toBe(true);
    expect(body.services.isCustomNominatim).toBe(false);
    expect(body.services.pushConfigured).toBe(false);
    expect(body.services.githubFeedbackConfigured).toBe(false);
  });

  it('returns operator details and hasOperatorInfo=true when configured', async () => {
    process.env.LEGAL_OPERATOR_NAME = 'Daniel Morgenstern';
    process.env.LEGAL_OPERATOR_ADDRESS = 'Musterstraße 12\n12345 Berlin';
    process.env.LEGAL_CONTACT_EMAIL = 'reisotor@ruebenherz.de';
    process.env.LEGAL_CONTACT_PHONE = '+49 30 123456';

    const res = await app.inject({
      method: 'GET',
      url: '/api/legal',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasOperatorInfo).toBe(true);
    expect(body.operator.name).toBe('Daniel Morgenstern');
    expect(body.operator.address).toBe('Musterstraße 12\n12345 Berlin');
    expect(body.operator.email).toBe('reisotor@ruebenherz.de');
    expect(body.operator.phone).toBe('+49 30 123456');
  });

  it('reflects custom service settings (custom Photon/Nominatim, ORS, Push requires both VAPID keys)', async () => {
    process.env.PHOTON_API_URL = 'https://my-photon.local/api/';
    process.env.NOMINATIM_API_URL = 'https://my-nominatim.local/search';
    process.env.NOMINATIM_ENABLED = 'false';
    process.env.ORS_API_KEY = 'secret-ors-key';
    process.env.VAPID_PUBLIC_KEY = 'pub-only';

    let res = await app.inject({
      method: 'GET',
      url: '/api/legal',
    });

    expect(res.statusCode).toBe(200);
    let body = res.json();
    expect(body.services.isCustomPhoton).toBe(true);
    expect(body.services.photonUrl).toBe('https://my-photon.local/api/');
    expect(body.services.isCustomNominatim).toBe(true);
    expect(body.services.nominatimUrl).toBe('https://my-nominatim.local/search');
    expect(body.services.nominatimEnabled).toBe(false);
    expect(body.services.orsConfigured).toBe(true);
    expect(body.services.pushConfigured).toBe(false);

    process.env.VAPID_PRIVATE_KEY = 'priv-key';
    res = await app.inject({
      method: 'GET',
      url: '/api/legal',
    });
    body = res.json();
    expect(body.services.pushConfigured).toBe(true);
  });
});
