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
  registrationMode,
  savingRegistrationMode,
  loadRegistrationMode,
  updateRegistrationMode,
  loadUserList,
  toggleAdminRole,
  toggleRestrictedRole,
  deleteUserAccount,
  onUserCreated,
} = useUserManagement();

onMounted(() => {
  if (auth.user?.is_admin) {
    loadUserList();
    loadRegistrationMode();
  }
});
</script>

<template>
  <div class="users-tab">
    <Card class="users-card registration-card">
      <SettingsCardHeader title="Selbstregistrierung" :icon="ACTION_ICONS.filterSettings" />
      <p class="hint">
        Steuert, welche Rechte neu registrierte Personen auf der Login-Seite standardmäßig erhalten.
      </p>

      <div
        class="registration-mode-options"
        role="radiogroup"
        aria-label="Selbstregistrierung Standard-Rechte"
      >
        <label
          for="reg-mode-restricted"
          class="mode-option"
          :class="{ active: registrationMode === 'restricted' }"
        >
          <input
            id="reg-mode-restricted"
            type="radio"
            name="registrationMode"
            value="restricted"
            :checked="registrationMode === 'restricted'"
            :disabled="savingRegistrationMode"
            @change="updateRegistrationMode('restricted')"
          />
          <div class="mode-content">
            <span class="mode-title">
              <strong>Offen als Basis-Konto</strong>
              <Badge variant="accent-secondary" size="sm">Empfohlen</Badge>
            </span>
            <span class="mode-desc">
              Freunde können sich selbst registrieren und starten mit Basis-Rechten (kein
              Datei-Upload, max. 1 eigener Urlaub), bis du sie unten per Klick freischaltest.
            </span>
          </div>
        </label>

        <label
          for="reg-mode-full"
          class="mode-option"
          :class="{ active: registrationMode === 'full' }"
        >
          <input
            id="reg-mode-full"
            type="radio"
            name="registrationMode"
            value="full"
            :checked="registrationMode === 'full'"
            :disabled="savingRegistrationMode"
            @change="updateRegistrationMode('full')"
          />
          <div class="mode-content">
            <span class="mode-title">
              <strong>Offen mit Vollzugriff</strong>
            </span>
            <span class="mode-desc">
              Jeder neu registrierte Account erhält sofort volle Berechtigungen für Urlaube und
              Datei-Uploads.
            </span>
          </div>
        </label>

        <label
          for="reg-mode-off"
          class="mode-option"
          :class="{ active: registrationMode === 'off' }"
        >
          <input
            id="reg-mode-off"
            type="radio"
            name="registrationMode"
            value="off"
            :checked="registrationMode === 'off'"
            :disabled="savingRegistrationMode"
            @change="updateRegistrationMode('off')"
          />
          <div class="mode-content">
            <span class="mode-title">
              <strong>Deaktiviert</strong>
            </span>
            <span class="mode-desc">
              Die Selbstregistrierung ist gesperrt. Neue Konten können nur von Administrator:innen
              oben über „Nutzer anlegen“ erstellt werden.
            </span>
          </div>
        </label>
      </div>
    </Card>

    <Card class="users-card">
      <SettingsCardHeader title="Nutzerverwaltung" :icon="USERS_ICON">
        <template #actions>
          <Button variant="primary" size="sm" @click="showCreateUserDialog = true">
            <AppIcon :icon="ACTION_ICONS.userPlus" :size="14" group="actions" /> Nutzer anlegen
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
                <Badge v-if="u.is_admin" variant="accent-secondary">Admin</Badge>
                <Badge v-else-if="u.is_restricted" variant="warning">Basis-Konto</Badge>
                <Badge v-else variant="success">Vollzugriff</Badge>
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
                    v-if="!u.is_admin"
                    size="sm"
                    :variant="u.is_restricted ? 'primary' : 'secondary'"
                    :title="
                      u.is_restricted
                        ? 'Auf Vollzugriff freischalten'
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
    </Card>

    <CreateUserDialog v-model="showCreateUserDialog" @created="onUserCreated" />
  </div>
</template>

<style scoped>
.users-card {
  margin-bottom: var(--space-4);
}

.registration-mode-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.mode-option:hover {
  background: var(--color-hover);
}

.mode-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.mode-option input[type='radio'] {
  margin-top: 3px;
  cursor: pointer;
}

.mode-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mode-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.mode-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-xl);
  flex-shrink: 0;
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
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
