<script setup lang="ts">
import { onMounted } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import AppIcon from '../AppIcon.vue';
import ViewLoadingState from '../ViewLoadingState.vue';
import CreateUserDialog from '../CreateUserDialog.vue';
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
  loadUserList,
  toggleAdminRole,
  deleteUserAccount,
  onUserCreated,
} = useUserManagement();

onMounted(() => {
  if (auth.user?.is_admin) {
    loadUserList();
  }
});
</script>

<template>
  <div class="users-tab">
    <Card class="users-card">
      <SettingsCardHeader title="Nutzerverwaltung" :icon="USERS_ICON">
        <template #actions>
          <Button variant="primary" size="sm" @click="showCreateUserDialog = true">
            <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Nutzer anlegen
          </Button>
        </template>
      </SettingsCardHeader>

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
                <Badge :variant="u.is_admin ? 'accent-secondary' : 'default'">
                  {{ u.is_admin ? 'Admin' : 'Nutzer' }}
                </Badge>
              </td>
              <td>
                <Badge
                  v-if="u.must_change_password"
                  variant="warning"
                  title="Passwortänderung beim ersten Login ausstehend"
                >
                  Passwortänderung ausstehend
                </Badge>
                <Badge v-else variant="success">Aktiv</Badge>
              </td>
              <td class="actions-col">
                <div class="user-actions">
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
    </Card>

    <CreateUserDialog v-model="showCreateUserDialog" @created="onUserCreated" />
  </div>
</template>

<style scoped>
.users-card {
  margin-bottom: var(--space-4);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
}

.hint.error {
  color: var(--color-danger);
}

.users-table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.users-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
}

.user-avatar {
  font-size: 1.2rem;
}

.email-cell {
  color: var(--color-text-muted);
}

.actions-col {
  text-align: right;
}

.user-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
