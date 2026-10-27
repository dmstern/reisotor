// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAccountSettings } from './useAccountSettings';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('useAccountSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes email from auth user', () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'user1',
      avatar: '🙂',
      email: 'current@example.com',
      is_email_verified: true,
    };

    const { emailForm, initEmail } = useAccountSettings();
    initEmail();
    expect(emailForm.value.email).toBe('current@example.com');
  });

  it('rejects empty email submission', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'user1',
      avatar: '🙂',
      email: '',
    };

    const { emailForm, emailError, changeEmail } = useAccountSettings();
    emailForm.value.email = '   ';
    await changeEmail();

    expect(emailError.value).toContain('Bitte gib eine E-Mail-Adresse ein');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('handles direct email update without verification required', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'user1',
      avatar: '🙂',
      email: 'old@example.com',
      is_email_verified: true,
    };

    vi.mocked(api.put).mockResolvedValueOnce({
      requiresVerification: false,
      email: 'new@example.com',
      is_email_verified: true,
      message: 'E-Mail-Adresse erfolgreich gespeichert.',
    });

    const { emailForm, emailSaved, emailSuccess, changeEmail } = useAccountSettings();
    emailForm.value.email = 'new@example.com';
    await changeEmail();

    expect(api.put).toHaveBeenCalledWith('/users/me/email', { email: 'new@example.com' });
    expect(auth.user.email).toBe('new@example.com');
    expect(auth.user.pending_email).toBeNull();
    expect(auth.user.is_email_verified).toBe(true);
    expect(emailSaved.value).toBe(true);
    expect(emailSuccess.value).toContain('erfolgreich gespeichert');
  });

  it('handles email update with verification required', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'user1',
      avatar: '🙂',
      email: 'old@example.com',
      is_email_verified: true,
    };

    vi.mocked(api.put).mockResolvedValueOnce({
      requiresVerification: true,
      pendingEmail: 'pending@example.com',
      email: 'old@example.com',
      message: 'Bestätigungslink wurde gesendet.',
    });

    const { emailForm, emailSaved, emailSuccess, changeEmail } = useAccountSettings();
    emailForm.value.email = 'pending@example.com';
    await changeEmail();

    expect(api.put).toHaveBeenCalledWith('/users/me/email', { email: 'pending@example.com' });
    expect(auth.user.email).toBe('old@example.com');
    expect(auth.user.pending_email).toBe('pending@example.com');
    expect(emailSaved.value).toBe(false);
    expect(emailSuccess.value).toContain('Bestätigungslink');
  });

  it('cancels pending email verification', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'user1',
      avatar: '🙂',
      email: 'old@example.com',
      pending_email: 'pending@example.com',
    };

    vi.mocked(api.delete).mockResolvedValueOnce(undefined);

    const { emailSuccess, cancelPendingEmail } = useAccountSettings();
    await cancelPendingEmail();

    expect(api.delete).toHaveBeenCalledWith('/users/me/email-pending');
    expect(auth.user.pending_email).toBeNull();
    expect(emailSuccess.value).toContain('abgebrochen');
  });

  it('resends verification email', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'user1',
      avatar: '🙂',
      email: 'old@example.com',
      pending_email: 'pending@example.com',
    };

    vi.mocked(api.post).mockResolvedValueOnce({
      message: 'Neuer Bestätigungslink gesendet.',
    });

    const { emailSuccess, resendVerificationEmail } = useAccountSettings();
    await resendVerificationEmail();

    expect(api.post).toHaveBeenCalledWith('/users/me/resend-verification-email');
    expect(emailSuccess.value).toContain('Neuer Bestätigungslink');
  });
});
