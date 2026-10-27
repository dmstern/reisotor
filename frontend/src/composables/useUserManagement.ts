import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { User, AdminResetPasswordResult } from '../api/types';
import { useAuthStore } from '../stores/auth';

export function useUserManagement() {
  const auth = useAuthStore();
  const userList = ref<User[]>([]);
  const loadingUsers = ref(false);
  const userListError = ref('');
  const showCreateUserDialog = ref(false);
  const registrationMode = ref<'off' | 'full' | 'restricted'>('restricted');
  const loadingRegistrationMode = ref(false);
  const savingRegistrationMode = ref(false);

  const resetPasswordTarget = ref<User | null>(null);
  const resetPasswordResult = ref<AdminResetPasswordResult | null>(null);
  const resettingPassword = ref(false);
  const verifyingEmailId = ref<number | null>(null);

  async function loadRegistrationMode() {
    if (!auth.user?.is_admin) return;
    loadingRegistrationMode.value = true;
    try {
      const res = await api.get<{ registrationMode: 'off' | 'full' | 'restricted' }>(
        '/users/registration-mode'
      );
      registrationMode.value = res.registrationMode;
    } catch {
      // Ignoriert, Fallback bleibt erhalten
    } finally {
      loadingRegistrationMode.value = false;
    }
  }

  async function updateRegistrationMode(mode: 'off' | 'full' | 'restricted') {
    if (!auth.user?.is_admin || savingRegistrationMode.value) return;
    savingRegistrationMode.value = true;
    try {
      const res = await api.put<{ registrationMode: 'off' | 'full' | 'restricted' }>(
        '/users/registration-mode',
        { registrationMode: mode }
      );
      registrationMode.value = res.registrationMode;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern des Registrierungsmodus');
    } finally {
      savingRegistrationMode.value = false;
    }
  }

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
        temporaryPassword ? { temporaryPassword } : {}
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

  return {
    userList,
    loadingUsers,
    userListError,
    showCreateUserDialog,
    registrationMode,
    loadingRegistrationMode,
    savingRegistrationMode,
    resetPasswordTarget,
    resetPasswordResult,
    resettingPassword,
    verifyingEmailId,
    loadRegistrationMode,
    updateRegistrationMode,
    loadUserList,
    toggleAdminRole,
    toggleRestrictedRole,
    deleteUserAccount,
    onUserCreated,
    openResetPasswordDialog,
    closeResetPasswordDialog,
    performResetPassword,
    verifyUserEmail,
  };
}
