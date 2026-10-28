<script setup lang="ts">
import { onMounted } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import AppIcon from '../AppIcon.vue';
import ViewLoadingState from '../ViewLoadingState.vue';
import CreateUserDialog from '../CreateUserDialog.vue';
import AdminResetPasswordModal from '../AdminResetPasswordModal.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import { useAuthStore } from '../../stores/auth';
import { useUserManagement } from '../../composables/useUserManagement';
import { USERS_ICON } from '../../composables/useSettingsTabs';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../../utils/formFieldIcons';

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
  loadUserList,
  toggleAdminRole,
  toggleRestrictedRole,
  deleteUserAccount,
  onUserCreated,
  openResetPasswordDialog,
  closeResetPasswordDialog,
  performResetPassword,
  verifyUserEmail,
} = useUserManagement();

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
              </div>
            </td>
            <td class="email-cell">{{ u.email || '—' }}</td>
            <td>
              <Badge v-if="u.is_admin" variant="accent-secondary">Admin</Badge>
              <Badge v-else-if="u.is_restricted" variant="warning">Basis-Konto</Badge>
              <Badge v-else variant="success">Plus</Badge>
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
                  v-if="!u.is_admin"
                  size="sm"
                  :variant="u.is_restricted ? 'primary' : 'secondary'"
                  :title="
                    u.is_restricted
                      ? 'Auf Reisotor Plus freischalten'
                      : 'Auf Basis-Konto einschränken'
                  "
                  @click="toggleRestrictedRole(u)"
                >
                  <AppIcon
                    :icon="u.is_restricted ? ACTION_ICONS.done : ACTION_ICONS.private"
                    :size="14"
                    group="actions"
                  />
                  {{ u.is_restricted ? 'Freischalten' : 'Einschränken' }}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  :title="u.is_admin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'"
                  @click="toggleAdminRole(u)"
                >
                  <AppIcon :icon="FORM_FIELD_ICONS.person" :size="14" group="formFields" />
                  {{ u.is_admin ? 'Admin entziehen' : 'Zum Admin machen' }}
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
  </Card>
</template>

<style scoped>
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
