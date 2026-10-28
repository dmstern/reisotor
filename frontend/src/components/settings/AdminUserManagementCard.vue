<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import AppIcon from '../AppIcon.vue';
import ViewLoadingState from '../ViewLoadingState.vue';
import CreateUserDialog from '../CreateUserDialog.vue';
import AdminResetPasswordModal from '../AdminResetPasswordModal.vue';
import UserRolesModal from '../UserRolesModal.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import { useAuthStore } from '../../stores/auth';
import {
  useUserManagement,
  getUserRole,
  getUserRoleLabel,
  type UserRole,
} from '../../composables/useUserManagement';
import type { User } from '../../api/types';
import { USERS_ICON } from '../../composables/useSettingsTabs';
import { ACTION_ICONS } from '../../utils/actionIcons';

const auth = useAuthStore();

const {
  userList,
  loadingUsers,
  userListError,
  showCreateUserDialog,
  resetPasswordTarget,
  resetPasswordResult,
  resettingPassword,
  verifyingEmailId,
  changingRoleId,
  loadUserList,
  changeUserRole,
  deleteUserAccount,
  onUserCreated,
  openResetPasswordDialog,
  closeResetPasswordDialog,
  performResetPassword,
  verifyUserEmail,
} = useUserManagement();

const showRolesModal = ref(false);
const selectedRoleForModal = ref<UserRole | null>(null);

function openRolesModal(role?: UserRole) {
  selectedRoleForModal.value = role ?? null;
  showRolesModal.value = true;
}

async function onRoleSelect(u: User, role: UserRole) {
  if (role === getUserRole(u)) return;
  await changeUserRole(u, role);
}

onMounted(() => {
  if (auth.user?.is_admin) {
    loadUserList();
  }
});
</script>

<template>
  <Card class="admin-card">
    <SettingsCardHeader title="Benutzerverwaltung" :icon="USERS_ICON">
      <template #actions>
        <Button variant="secondary" size="sm" @click="openRolesModal()">
          <AppIcon :icon="ACTION_ICONS.info" :size="14" group="actions" /> Rollen & Rechte
        </Button>
        <Button variant="primary" size="sm" @click="showCreateUserDialog = true">
          <AppIcon :icon="ACTION_ICONS.userPlus" :size="14" group="actions" /> Nutzer anlegen
        </Button>
      </template>
    </SettingsCardHeader>
    <p class="hint">
      Verwalte bestehende Benutzerkonten, Rollen, Berechtigungen und setze Passwörter zurück.
    </p>

    <p v-if="userListError" class="hint error">{{ userListError }}</p>
    <ViewLoadingState v-if="loadingUsers" message="Lade Nutzerliste…" />

    <div v-else-if="userList.length" class="users-table-wrapper">
      <table class="users-table">
        <thead>
          <tr>
            <th>Nutzer</th>
            <th>E-Mail</th>
            <th>Rolle</th>
            <th>Status</th>
            <th class="actions-col">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in userList" :key="u.id">
            <td>
              <div class="user-cell">
                <span class="user-avatar">{{ u.avatar }}</span>
                <span class="username">{{ u.username }}</span>
                <span v-if="u.id === auth.user?.id" class="self-label">(Du)</span>
              </div>
            </td>
            <td class="email-cell">{{ u.email || '—' }}</td>
            <td>
              <div
                class="role-badge-select"
                :class="[
                  `role-badge-select--${getUserRole(u)}`,
                  { 'is-loading': changingRoleId === u.id },
                ]"
              >
                <Badge
                  interactive
                  :variant="
                    u.is_admin ? 'accent-secondary' : u.is_restricted ? 'warning' : 'success'
                  "
                  class="role-badge"
                >
                  <span>{{ getUserRoleLabel(u) }}</span>
                  <span v-if="changingRoleId === u.id" class="role-spinner" aria-hidden="true" />
                  <AppIcon
                    v-else
                    :icon="ACTION_ICONS.chevronDown"
                    :size="12"
                    class="role-chevron"
                    group="actions"
                  />
                </Badge>
                <select
                  :value="getUserRole(u)"
                  :disabled="changingRoleId === u.id"
                  :aria-label="`Rolle für ${u.username}`"
                  :title="`Rolle für ${u.username} ändern (aktuell: ${getUserRoleLabel(u)})`"
                  class="role-native-select"
                  @change="
                    (e) => onRoleSelect(u, (e.target as HTMLSelectElement).value as UserRole)
                  "
                >
                  <option value="restricted" :disabled="u.id === auth.user?.id">Basis-Konto</option>
                  <option value="plus">Plus</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </td>
            <td>
              <div class="status-badges">
                <Badge
                  v-if="u.is_email_verified === false"
                  variant="warning"
                  title="E-Mail-Adresse noch nicht bestätigt"
                >
                  E-Mail unbestätigt
                </Badge>
                <Badge
                  v-if="u.must_change_password"
                  variant="warning"
                  title="Passwortänderung beim ersten Login ausstehend"
                >
                  PW-Änderung offen
                </Badge>
                <Badge
                  v-if="u.is_email_verified !== false && !u.must_change_password"
                  variant="success"
                  >Aktiv</Badge
                >
              </div>
            </td>
            <td class="actions-col">
              <div class="user-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  title="Passwort für diesen Account zurücksetzen"
                  @click="openResetPasswordDialog(u)"
                >
                  <AppIcon :icon="ACTION_ICONS.key" :size="14" group="actions" />
                  PW Reset
                </Button>
                <Button
                  v-if="u.is_email_verified === false"
                  size="sm"
                  variant="secondary"
                  title="E-Mail-Adresse manuell freischalten"
                  :loading="verifyingEmailId === u.id"
                  @click="verifyUserEmail(u)"
                >
                  <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
                  Mail bestätigen
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  :disabled="u.id === auth.user?.id"
                  title="Nutzer löschen"
                  @click="deleteUserAccount(u)"
                >
                  <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" />
                  Löschen
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CreateUserDialog v-model="showCreateUserDialog" @created="onUserCreated" />
    <AdminResetPasswordModal
      :model-value="Boolean(resetPasswordTarget)"
      :user="resetPasswordTarget"
      :result="resetPasswordResult"
      :loading="resettingPassword"
      @reset="(pw) => resetPasswordTarget && performResetPassword(resetPasswordTarget, pw)"
      @close="closeResetPasswordDialog"
    />
    <UserRolesModal v-model="showRolesModal" :initial-role="selectedRoleForModal" />
  </Card>
</template>

<style scoped>
.role-badge-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.role-badge {
  padding-right: 6px;
  user-select: none;
}

.role-chevron {
  opacity: 0.75;
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
  flex-shrink: 0;
}

.role-badge-select:hover .role-chevron {
  opacity: 1;
}

.role-native-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-pill);
  -webkit-appearance: none;
  appearance: none;
}

.role-native-select option {
  background-color: var(--color-surface);
  color: var(--color-text);
}

.role-native-select:focus-visible {
  outline: none;
}

.role-badge-select:focus-within .role-badge {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.role-badge-select:hover .role-badge {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.role-badge-select:active .role-badge {
  transform: translateY(0);
}

.role-badge-select.is-loading {
  pointer-events: none;
  opacity: 0.7;
}

.role-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--radius-pill);
  animation: role-spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes role-spin {
  to {
    transform: rotate(360deg);
  }
}

.self-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: 500;
  margin-left: 2px;
}

.admin-card {
  margin-bottom: var(--space-4);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.hint.error {
  color: var(--color-danger);
}

.users-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}

.users-table {
  width: 100%;
  min-width: 580px;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.users-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.users-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  min-width: 0;
}

.user-avatar {
  font-size: var(--font-size-xl);
  flex-shrink: 0;
}

.username {
  font-weight: 500;
}

.email-cell {
  color: var(--color-text-muted);
}

.status-badges {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.actions-col {
  text-align: right;
  white-space: nowrap;
}

.user-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
