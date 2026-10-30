import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { User, AdminResetPasswordResult } from '../api/types';
import { useAuthStore } from '../stores/auth';

export type UserRole = 'admin' | 'plus' | 'restricted';

export function getUserRole(u: User): UserRole {
  if (u.is_admin) return 'admin';
  if (u.is_restricted) return 'restricted';
  return 'plus';
}

export function getUserRoleLabel(u: User | UserRole): string {
  const role = typeof u === 'string' ? u : getUserRole(u);
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
    if (!auth.user?.is_admin) return;
    loadingUsers.value = true;
    userListError.value = '';
    try {
      userList.value = await api.get<User[]>('/users');
    } catch (err) {
      if (err instanceof ApiError) userListError.value = err.message;
      else userListError.value = 'Fehler beim Laden der Nutzerliste.';
    } finally {
      loadingUsers.value = false;
    }
  }

  async function changeUserRole(u: User, role: UserRole) {
    changingRoleId.value = u.id;
    try {
      const updated = await api.put<User>(`/users/${u.id}/role`, { role });
      const idx = userList.value.findIndex((item) => item.id === u.id);
      if (idx !== -1) userList.value[idx] = updated;
      if (auth.user && auth.user.id === u.id) {
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

  async function toggleAdminRole(u: User) {
    const nextIsAdmin = !u.is_admin;
    try {
      const updated = await api.put<User>(`/users/${u.id}/admin`, { is_admin: nextIsAdmin });
      const idx = userList.value.findIndex((item) => item.id === u.id);
      if (idx !== -1) userList.value[idx] = updated;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern der Admin-Rechte');
    }
  }

  async function toggleRestrictedRole(u: User) {
    const nextIsRestricted = !u.is_restricted;
    try {
      const updated = await api.put<User>(`/users/${u.id}/restricted`, {
        is_restricted: nextIsRestricted,
      });
      const idx = userList.value.findIndex((item) => item.id === u.id);
      if (idx !== -1) userList.value[idx] = updated;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern des Kontostatus');
    }
  }

  async function deleteUserAccount(u: User) {
    if (u.id === auth.user?.id) return;
    if (!confirm(`Möchtest du den Nutzer "${u.username}" wirklich löschen?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      userList.value = userList.value.filter((item) => item.id !== u.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Löschen des Nutzers');
    }
  }

  function onUserCreated(newUser: User) {
    userList.value.push(newUser);
  }

  function openResetPasswordDialog(u: User) {
    resetPasswordTarget.value = u;
    resetPasswordResult.value = null;
  }

  function closeResetPasswordDialog() {
    resetPasswordTarget.value = null;
    resetPasswordResult.value = null;
  }

  async function performResetPassword(u: User, temporaryPassword?: string) {
    resettingPassword.value = true;
    try {
      const res = await api.post<AdminResetPasswordResult>(
        `/users/${u.id}/reset-password`,
        temporaryPassword ? { temporaryPassword } : {},
        { noQueue: true }
      );
      resetPasswordResult.value = res;
      // In der Nutzerliste must_change_password aktualisieren
      const idx = userList.value.findIndex((item) => item.id === u.id);
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

  async function verifyUserEmail(u: User) {
    verifyingEmailId.value = u.id;
    try {
      await api.post(`/users/${u.id}/verify-email`);
      const idx = userList.value.findIndex((item) => item.id === u.id);
      if (idx !== -1) {
        userList.value[idx] = { ...userList.value[idx], is_email_verified: true };
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Verifizieren der E-Mail-Adresse');
    } finally {
      verifyingEmailId.value = null;
    }
  }

  async function toggleLockUser(u: User) {
    if (u.id === auth.user?.id) return;
    const nextLocked = !u.is_locked;
    const actionText = nextLocked ? 'sperren' : 'entsperren';
    if (!confirm(`Möchtest du das Konto von "${u.username}" wirklich ${actionText}?`)) return;
    lockingUserId.value = u.id;
    try {
      const updated = await api.put<User>(`/users/${u.id}/lock`, { is_locked: nextLocked });
      const idx = userList.value.findIndex((item) => item.id === u.id);
      if (idx !== -1) userList.value[idx] = updated;
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
