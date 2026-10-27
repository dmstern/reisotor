import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAdminSettings } from './useAdminSettings';
import { api } from '../api/client';
import type { AdminSettings } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe('useAdminSettings', () => {
  const mockSettings: AdminSettings = {
    registration: { registrationMode: 'restricted', requireEmailVerification: true },
    legal: {
      operatorName: 'Muster Org',
      operatorAddress: 'Musterstr. 1',
      contactEmail: 'admin@muster.de',
      contactPhone: '12345',
      hostingLocation: 'München',
    },
    geo: {
      isOrsApiKeySet: true,
      photonApiUrl: 'https://photon.komoot.io/api/',
      nominatimApiUrl: 'https://nominatim.openstreetmap.org/search',
      nominatimEnabled: true,
    },
    email: {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'mailer',
      isSmtpPassSet: true,
      smtpFrom: 'test@example.com',
      appUrl: 'http://localhost:5173',
    },
    feedback: {
      githubRepo: 'dmstern/reisotor',
      isGithubTokenSet: false,
      feedbackRelayForwarding: true,
      feedbackRelayUrl: 'https://relay.url',
    },
    push: {
      vapidPublicKey: 'PUBKEY123',
      isVapidPrivateKeySet: true,
      vapidSubject: 'mailto:admin@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads admin settings via GET /admin/settings', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ settings: mockSettings });
    const { settings, loading, loadSettings } = useAdminSettings();

    expect(loading.value).toBe(false);
    const loadPromise = loadSettings();
    expect(loading.value).toBe(true);
    await loadPromise;
    expect(loading.value).toBe(false);

    expect(api.get).toHaveBeenCalledWith('/admin/settings');
    expect(settings.value).toEqual(mockSettings);
  });

  it('saves a section via PUT /admin/settings and marks section as saved', async () => {
    const updatedSettings = {
      ...mockSettings,
      legal: { ...mockSettings.legal, operatorName: 'Neue Org' },
    };
    vi.mocked(api.put).mockResolvedValueOnce({ settings: updatedSettings });
    const { settings, saveSection, saveSuccess } = useAdminSettings();

    const ok = await saveSection('legal', { legal: { operatorName: 'Neue Org' } });
    expect(ok).toBe(true);
    expect(api.put).toHaveBeenCalledWith('/admin/settings', {
      legal: { operatorName: 'Neue Org' },
    });
    expect(settings.value?.legal.operatorName).toBe('Neue Org');
    expect(saveSuccess.value['legal']).toBe(true);
  });

  it('generates VAPID keys via POST /admin/settings/vapid-generate', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      publicKey: 'NEW_PUBKEY_XYZ',
      isPrivateKeySet: true,
    });
    const { settings, generateVapidKeys, saveSuccess } = useAdminSettings();
    settings.value = { ...mockSettings };

    const ok = await generateVapidKeys('mailto:new@admin.com');
    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/admin/settings/vapid-generate', {
      subject: 'mailto:new@admin.com',
    });
    expect(settings.value.push.vapidPublicKey).toBe('NEW_PUBKEY_XYZ');
    expect(settings.value.push.vapidSubject).toBe('mailto:new@admin.com');
    expect(saveSuccess.value['push']).toBe(true);
  });
});
