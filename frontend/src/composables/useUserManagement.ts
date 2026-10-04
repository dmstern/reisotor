import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';

export function useUserManagement() {
  const auth = useAuthStore();
  const userList = ref<User[]>([]);
  const loadingUsers = ref(false);
  const userListError = ref('');
  const showCreateUserDialog = ref(false);

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

  return {
    userList,
    loadingUsers,
    userListError,
    showCreateUserDialog,
    loadUserList,
    toggleAdminRole,
    deleteUserAccount,
    onUserCreated,
  };
}
