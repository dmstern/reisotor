import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';

export interface EmojiCategory {
  label: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: 'Menschen',
    emojis: [
      '🙂',
      '😎',
      '🥳',
      '😄',
      '🤓',
      '🥸',
      '🧑',
      '👩',
      '👨',
      '🧑‍🦱',
      '👩‍🦰',
      '🧑‍🦳',
      '🧔',
      '👵',
      '👴',
      '🧑‍🚀',
      '🧑‍🎤',
      '🧑‍🍳',
      '🥷',
      '🧙',
    ],
  },
  {
    label: 'Tiere',
    emojis: [
      '🐨',
      '🦊',
      '🐢',
      '🦁',
      '🐸',
      '🐧',
      '🐶',
      '🐱',
      '🐼',
      '🐰',
      '🦄',
      '🐙',
      '🦉',
      '🐝',
      '🦋',
      '🐳',
      '🐬',
      '🦖',
      '🐺',
      '🦔',
      '🐷',
      '🐮',
      '🐵',
      '🦒',
      '🐘',
      '🦓',
      '🦩',
      '🐌',
      '🐊',
      '🦈',
      '🦥',
      '🦦',
      '🦡',
      '🐿️',
      '🦫',
      '🦭',
      '🐡',
      '🦑',
      '🦜',
      '🦚',
      '🐴',
      '🦌',
      '🐯',
      '🦍',
      '🐔',
    ],
  },
  {
    label: 'Fabelwesen & Berufe',
    emojis: [
      '🧙‍♀️',
      '🧙‍♂️',
      '🧚',
      '🧝',
      '🧞',
      '🧜',
      '🧛',
      '🧟',
      '🦸',
      '🦹',
      '🐉',
      '🧑‍⚕️',
      '🧑‍🚒',
      '👮',
      '🧑‍🌾',
      '🧑‍🏫',
      '🧑‍💻',
      '🧑‍🎨',
      '🧑‍✈️',
      '🧑‍🔧',
      '🧑‍⚖️',
    ],
  },
];

export function useAccountSettings() {
  const auth = useAuthStore();
  const router = useRouter();

  const avatarSaving = ref(false);
  const avatarSaved = ref(false);

  const usernameForm = ref({ username: auth.user?.username ?? '' });
  const usernameError = ref('');
  const usernameSaved = ref(false);
  const usernameSaving = ref(false);

  const emailForm = ref({ email: auth.user?.email ?? '' });
  const emailError = ref('');
  const emailSuccess = ref('');
  const emailSaved = ref(false);
  const emailSaving = ref(false);
  const emailCancelling = ref(false);
  const emailResending = ref(false);

  const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const passwordError = ref('');
  const passwordSaved = ref(false);
  const passwordSaving = ref(false);

  function initUsername() {
    usernameForm.value.username = auth.user?.username ?? '';
  }

  function initEmail() {
    emailForm.value.email = auth.user?.email ?? '';
    emailError.value = '';
    emailSuccess.value = '';
    emailSaved.value = false;
  }

  async function changeUsername() {
    usernameError.value = '';
    usernameSaved.value = false;
    if (!usernameForm.value.username.trim()) return;
    usernameSaving.value = true;
    try {
      const updated = await api.put<User>('/users/me/username', {
        username: usernameForm.value.username.trim(),
      });
      if (auth.user) auth.user.username = updated.username;
      usernameSaved.value = true;
    } catch (err) {
      usernameError.value =
        err instanceof ApiError ? err.message : 'Benutzername konnte nicht geändert werden';
    } finally {
      usernameSaving.value = false;
    }
  }

  async function changeEmail() {
    emailError.value = '';
    emailSuccess.value = '';
    emailSaved.value = false;
    const trimmed = emailForm.value.email.trim();
    if (!trimmed) {
      emailError.value = 'Bitte gib eine E-Mail-Adresse ein';
      return;
    }
    emailSaving.value = true;
    try {
      const res = await api.put<{
        requiresVerification?: boolean;
        pendingEmail?: string;
        email?: string | null;
        message?: string;
      }>('/users/me/email', { email: trimmed });

      if (auth.user) {
        if (res.requiresVerification) {
          auth.user.pending_email = res.pendingEmail ?? trimmed;
          emailSuccess.value =
            res.message ||
            'Bestätigungslink wurde an deine neue Adresse gesendet. Bitte prüfe dein Postfach.';
        } else {
          auth.user.email = res.email ?? trimmed;
          auth.user.pending_email = null;
          auth.user.is_email_verified = true;
          emailSaved.value = true;
          emailSuccess.value = res.message || 'E-Mail-Adresse erfolgreich gespeichert.';
        }
      }
    } catch (err) {
      emailError.value =
        err instanceof ApiError ? err.message : 'E-Mail-Adresse konnte nicht geändert werden';
    } finally {
      emailSaving.value = false;
    }
  }

  async function cancelPendingEmail() {
    emailError.value = '';
    emailCancelling.value = true;
    try {
      await api.delete('/users/me/email-pending');
      if (auth.user) {
        auth.user.pending_email = null;
      }
      emailSuccess.value = 'Ausstehende E-Mail-Änderung abgebrochen.';
    } catch (err) {
      emailError.value = err instanceof ApiError ? err.message : 'Konnte nicht abgebrochen werden';
    } finally {
      emailCancelling.value = false;
    }
  }

  async function resendVerificationEmail() {
    emailError.value = '';
    emailResending.value = true;
    try {
      const res = await api.post<{ message?: string }>('/users/me/resend-verification-email');
      emailSuccess.value = res.message || 'Neuer Bestätigungslink wurde versendet.';
    } catch (err) {
      emailError.value =
        err instanceof ApiError ? err.message : 'Bestätigungs-E-Mail konnte nicht gesendet werden';
    } finally {
      emailResending.value = false;
    }
  }

  async function selectAvatar(avatar: string) {
    avatarSaving.value = true;
    avatarSaved.value = false;
    try {
      const updated = await api.put<User>('/users/me/avatar', { avatar });
      if (auth.user) auth.user.avatar = updated.avatar;
      avatarSaved.value = true;
    } finally {
      avatarSaving.value = false;
    }
  }

  async function changePassword() {
    passwordError.value = '';
    passwordSaved.value = false;
    if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
      passwordError.value = 'Neue Passwörter stimmen nicht überein';
      return;
    }
    passwordSaving.value = true;
    try {
      await api.put('/users/me/password', {
        currentPassword: passwordForm.value.currentPassword,
        newPassword: passwordForm.value.newPassword,
      });
      passwordSaved.value = true;
      passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    } catch (err) {
      passwordError.value =
        err instanceof ApiError ? err.message : 'Passwort konnte nicht geändert werden';
    } finally {
      passwordSaving.value = false;
    }
  }

  async function logout() {
    await auth.logout();
    router.push('/login');
  }

  return {
    avatarSaving,
    avatarSaved,
    usernameForm,
    usernameError,
    usernameSaved,
    usernameSaving,
    emailForm,
    emailError,
    emailSuccess,
    emailSaved,
    emailSaving,
    emailCancelling,
    emailResending,
    passwordForm,
    passwordError,
    passwordSaved,
    passwordSaving,
    EMOJI_CATEGORIES,
    initUsername,
    initEmail,
    changeUsername,
    changeEmail,
    cancelPendingEmail,
    resendVerificationEmail,
    selectAvatar,
    changePassword,
    logout,
  };
}
