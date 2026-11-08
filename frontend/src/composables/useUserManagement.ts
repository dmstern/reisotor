import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { User, AdminResetPasswordResult } from '../api/types';
import { useAuthStore } from '../stores/auth';

export type UserRole = 'admin' | 'plus' | 'restricted';

export function getUserRole(user: User): UserRole {
  if (user.is_admin) {
    return 'admin';
  }

  if (user.is_restricted) {
    return 'restricted';
  }

  return 'plus';
}

export function getUserRoleLabel(userOrRole: User | UserRole): string {
  const role = typeof userOrRole === 'string' ? userOrRole : getUserRole(userOrRole);

  switch (role) {
    case 'admin':
      return 'Admin';
    case 'plus':
      return 'Plus';
    case 'restricted':
      return 'Basis-Konto';
  }
}

export function useUserManagement() {
  const auth = useAuthStore();
  const userList = ref<User[]>([]);
  const loadingUsers = ref(false);
  const userListError = ref('');
  const showCreateUserDialog = ref(false);

  const resetPasswordTarget = ref<User | null>(null);
  const resetPasswordResult = ref<AdminResetPasswordResult | null>(null);
  const resettingPassword = ref(false);
  const verifyingEmailId = ref<number | null>(null);
  const changingRoleId = ref<number | null>(null);
  const lockingUserId = ref<number | null>(null);

  async function loadUserList() {
    if (!auth.user?.is_admin) {
      return;
    }

    loadingUsers.value = true;
    userListError.value = '';

    try {
      userList.value = await api.get<User[]>('/users');
    } catch (err) {
      if (err instanceof ApiError) {
        userListError.value = err.message;
      } else {
        userListError.value = 'Fehler beim Laden der Nutzerliste.';
      }
    } finally {
      loadingUsers.value = false;
    }
  }

  async function changeUserRole(targetUser: User, role: UserRole) {
    changingRoleId.value = targetUser.id;

    try {
      const updated = await api.put<User>(`/users/${targetUser.id}/role`, { role });
      const idx = userList.value.findIndex((item) => item.id === targetUser.id);

      if (idx !== -1) {
        userList.value[idx] = updated;
      }

      if (auth.user && auth.user.id === targetUser.id) {
        auth.user.is_admin = updated.is_admin;
        auth.user.restricted = updated.restricted;
        auth.user.is_restricted = updated.is_restricted;
      }

      return updated;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern der Rolle');
    } finally {
      changingRoleId.value = null;
    }
  }

  async function toggleAdminRole(targetUser: User) {
    const nextIsAdmin = !targetUser.is_admin;

    try {
      const updated = await api.put<User>(`/users/${targetUser.id}/admin`, {
        is_admin: nextIsAdmin,
      });
      const idx = userList.value.findIndex((item) => item.id === targetUser.id);

      if (idx !== -1) {
        userList.value[idx] = updated;
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern der Admin-Rechte');
    }
  }

  async function toggleRestrictedRole(targetUser: User) {
    const nextIsRestricted = !targetUser.is_restricted;

    try {
      const updated = await api.put<User>(`/users/${targetUser.id}/restricted`, {
        is_restricted: nextIsRestricted,
      });
      const idx = userList.value.findIndex((item) => item.id === targetUser.id);

      if (idx !== -1) {
        userList.value[idx] = updated;
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern des Kontostatus');
    }
  }

  async function deleteUserAccount(targetUser: User) {
    if (targetUser.id === auth.user?.id) {
      return;
    }

    if (!confirm(`Möchtest du den Nutzer "${targetUser.username}" wirklich löschen?`)) {
      return;
    }

    try {
      await api.delete(`/users/${targetUser.id}`);
      userList.value = userList.value.filter((item) => item.id !== targetUser.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Löschen des Nutzers');
    }
  }

  function onUserCreated(newUser: User) {
    userList.value.push(newUser);
  }

  function openResetPasswordDialog(targetUser: User) {
    resetPasswordTarget.value = targetUser;
    resetPasswordResult.value = null;
  }

  function closeResetPasswordDialog() {
    resetPasswordTarget.value = null;
    resetPasswordResult.value = null;
  }

  async function performResetPassword(targetUser: User, temporaryPassword?: string) {
    resettingPassword.value = true;

    try {
      const res = await api.post<AdminResetPasswordResult>(
        `/users/${targetUser.id}/reset-password`,
        temporaryPassword ? { temporaryPassword } : {},
        { noQueue: true }
      );
      resetPasswordResult.value = res;
      // In der Nutzerliste must_change_password aktualisieren
      const idx = userList.value.findIndex((item) => item.id === targetUser.id);

      if (idx !== -1) {
        userList.value[idx] = { ...userList.value[idx], must_change_password: true };
      }

      return res;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Zurücksetzen des Passworts');
      throw err;
    } finally {
      resettingPassword.value = false;
    }
  }

  async function verifyUserEmail(targetUser: User) {
    verifyingEmailId.value = targetUser.id;

    try {
      await api.post(`/users/${targetUser.id}/verify-email`);
      const idx = userList.value.findIndex((item) => item.id === targetUser.id);

      if (idx !== -1) {
        userList.value[idx] = { ...userList.value[idx], is_email_verified: true };
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Verifizieren der E-Mail-Adresse');
    } finally {
      verifyingEmailId.value = null;
    }
  }

  async function toggleLockUser(targetUser: User) {
    if (targetUser.id === auth.user?.id) {
      return;
    }

    const nextLocked = !targetUser.is_locked;
    const actionText = nextLocked ? 'sperren' : 'entsperren';

    if (!confirm(`Möchtest du das Konto von "${targetUser.username}" wirklich ${actionText}?`)) {
      return;
    }

    lockingUserId.value = targetUser.id;

    try {
      const updated = await api.put<User>(`/users/${targetUser.id}/lock`, {
        is_locked: nextLocked,
      });
      const idx = userList.value.findIndex((item) => item.id === targetUser.id);

      if (idx !== -1) {
        userList.value[idx] = updated;
      }

      return updated;
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : `Fehler beim ${nextLocked ? 'Sperren' : 'Entsperren'} des Nutzers`
      );
    } finally {
      lockingUserId.value = null;
    }
  }

  return {
    userList,
    loadingUsers,
    userListError,
    showCreateUserDialog,
    resetPasswordTarget,
    resetPasswordResult,
    resettingPassword,
    verifyingEmailId,
    changingRoleId,
    lockingUserId,
    loadUserList,
    changeUserRole,
    getUserRole,
    getUserRoleLabel,
    toggleAdminRole,
    toggleRestrictedRole,
    toggleLockUser,
    deleteUserAccount,
    onUserCreated,
    openResetPasswordDialog,
    closeResetPasswordDialog,
    performResetPassword,
    verifyUserEmail,
  };
}
