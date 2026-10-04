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

  const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const passwordError = ref('');
  const passwordSaved = ref(false);
  const passwordSaving = ref(false);

  function initUsername() {
    usernameForm.value.username = auth.user?.username ?? '';
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
    passwordForm,
    passwordError,
    passwordSaved,
    passwordSaving,
    EMOJI_CATEGORIES,
    initUsername,
    changeUsername,
    selectAvatar,
    changePassword,
    logout,
  };
}
