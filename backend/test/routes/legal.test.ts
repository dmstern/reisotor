import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('legal routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  afterEach(() => {
    delete process.env.LEGAL_OPERATOR_NAME;
    delete process.env.LEGAL_OPERATOR_ADDRESS;
    delete process.env.LEGAL_CONTACT_EMAIL;
    delete process.env.LEGAL_CONTACT_PHONE;
    delete process.env.PHOTON_API_URL;
    delete process.env.NOMINATIM_ENABLED;
    delete process.env.NOMINATIM_API_URL;
    delete process.env.ORS_API_KEY;
  });

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

  it('reflects custom service settings (custom Photon, Nominatim disabled, ORS configured)', async () => {
    process.env.PHOTON_API_URL = 'https://my-photon.local/api/';
    process.env.NOMINATIM_ENABLED = 'false';
    process.env.ORS_API_KEY = 'secret-ors-key';

    const res = await app.inject({
      method: 'GET',
      url: '/api/legal',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.services.isCustomPhoton).toBe(true);
    expect(body.services.photonUrl).toBe('https://my-photon.local/api/');
    expect(body.services.nominatimEnabled).toBe(false);
    expect(body.services.orsConfigured).toBe(true);
  });
});
