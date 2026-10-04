<script setup lang="ts">
import { onMounted } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import IconButton from '../primitives/IconButton.vue';
import Input from '../primitives/Input.vue';
import PasswordInput from '../PasswordInput.vue';
import AppIcon from '../AppIcon.vue';
import { useAuthStore } from '../../stores/auth';
import { useConnectivityStore } from '../../stores/connectivity';
import { useAccountSettings } from '../../composables/useAccountSettings';
import { ACTION_ICONS } from '../../utils/actionIcons';

const auth = useAuthStore();
const connectivity = useConnectivityStore();

const {
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
} = useAccountSettings();

onMounted(() => {
  initUsername();
});
</script>

<template>
  <div class="account-tab">
    <Card>
      <div class="header account-header">
        <div class="user-info">
          <div class="name-and-status">
            <h2>{{ auth.user?.avatar }} {{ auth.user?.username }}</h2>
            <div
              class="status-badge"
              :class="{
                online: connectivity.isOnline && !connectivity.syncing && !connectivity.checking,
                retrying: connectivity.syncing || connectivity.checking,
                offline: !connectivity.isOnline,
              }"
            >
              <span class="status-dot"></span>
              <span class="status-text">
                <template
                  v-if="connectivity.isOnline && !connectivity.syncing && !connectivity.checking"
                  >Online</template
                >
                <template v-else-if="connectivity.syncing || connectivity.checking"
                  >Verbinde…</template
                >
                <template v-else>Offline</template>
              </span>
            </div>
            <Button
              v-if="!connectivity.isOnline"
              size="sm"
              variant="secondary"
              :disabled="connectivity.checking"
              @click="connectivity.checkNow()"
              class="retry-btn"
            >
              <AppIcon
                :icon="connectivity.checking ? ACTION_ICONS.refresh : ACTION_ICONS.offline"
                :size="14"
                group="actions"
              />
              {{ connectivity.checking ? 'Prüfe…' : 'Jetzt prüfen' }}
            </Button>
            <Button
              v-if="connectivity.pendingCount > 0"
              size="sm"
              variant="secondary"
              :disabled="connectivity.syncing"
              @click="connectivity.syncNow()"
              class="pending-sync-btn"
              :title="
                connectivity.syncing
                  ? 'Synchronisiere…'
                  : 'Ausstehende Änderungen jetzt synchronisieren'
              "
            >
              <AppIcon
                :icon="ACTION_ICONS.syncPending"
                :size="14"
                group="actions"
                :class="{ 'is-spinning': connectivity.syncing }"
              />
              {{
                connectivity.syncing ? 'Synchronisiere…' : `${connectivity.pendingCount} ausstehend`
              }}
            </Button>
          </div>
          <p v-if="!connectivity.isOnline" class="offline-description hint">
            Änderungen werden lokal gespeichert. Die App versucht alle 6 Sekunden automatisch, sich
            wieder zu verbinden.
          </p>
          <p v-else-if="connectivity.pendingCount > 0" class="pending-description hint">
            {{ connectivity.pendingCount }}
            {{ connectivity.pendingCount === 1 ? 'Änderung ist' : 'Änderungen sind' }}
            noch nicht mit dem Server synchronisiert.
          </p>
        </div>
        <Button type="button" variant="secondary" @click="logout" class="logout-btn">
          <AppIcon :icon="ACTION_ICONS.logout" :size="14" group="actions" /> Abmelden
        </Button>
      </div>

      <form class="form username-form" @submit.prevent="changeUsername">
        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="profile-username">
            Benutzername
            <span class="required-indicator" aria-hidden="true">*</span>
          </label>
          <Input id="profile-username" v-model="usernameForm.username" type="text" required />
        </div>
        <p v-if="usernameError" class="hint error">{{ usernameError }}</p>
        <p v-if="usernameSaved" class="hint success">
          Benutzername geändert <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
        </p>
        <Button type="submit" :disabled="usernameSaving">
          {{ usernameSaving ? 'Speichern…' : 'Benutzername speichern' }}
        </Button>
      </form>

      <h3>Avatar wählen</h3>
      <div class="emoji-scroll">
        <div v-for="cat in EMOJI_CATEGORIES" :key="cat.label" class="emoji-category">
          <p class="emoji-category-label">{{ cat.label }}</p>
          <div class="emoji-grid">
            <IconButton
              v-for="emoji in cat.emojis"
              :key="emoji"
              variant="ghost"
              :active="emoji === auth.user?.avatar"
              :disabled="avatarSaving"
              :aria-label="`Avatar ${emoji} auswählen`"
              :title="`Avatar ${emoji}`"
              @click="selectAvatar(emoji)"
            >
              {{ emoji }}
            </IconButton>
          </div>
        </div>
      </div>
      <p v-if="avatarSaved" class="hint success">
        Gespeichert <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
      </p>
    </Card>

    <Card>
      <h2>Passwort ändern</h2>
      <form class="form" @submit.prevent="changePassword">
        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="profile-current-password">
            Aktuelles Passwort
            <span class="required-indicator" aria-hidden="true">*</span>
          </label>
          <PasswordInput
            id="profile-current-password"
            v-model="passwordForm.currentPassword"
            autocomplete="current-password"
            required
          />
        </div>
        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="profile-new-password">
            Neues Passwort
            <span class="required-indicator" aria-hidden="true">*</span>
          </label>
          <PasswordInput
            id="profile-new-password"
            v-model="passwordForm.newPassword"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </div>
        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="profile-confirm-password">
            Neues Passwort bestätigen
            <span class="required-indicator" aria-hidden="true">*</span>
          </label>
          <PasswordInput
            id="profile-confirm-password"
            v-model="passwordForm.confirmPassword"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </div>
        <p v-if="passwordError" class="hint error">{{ passwordError }}</p>
        <p v-if="passwordSaved" class="hint success">
          Passwort geändert <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
        </p>
        <Button type="submit" :disabled="passwordSaving">
          {{ passwordSaving ? 'Speichern…' : 'Passwort speichern' }}
        </Button>
      </form>
    </Card>
  </div>
</template>

<style scoped>
.account-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.account-header {
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

@container app-main (max-width: 600px) {
  .account-header {
    flex-direction: column;
    align-items: stretch;
  }
  .logout-btn {
    width: 100%;
    justify-content: center;
  }
}
@media (max-width: 600px) {
  .account-header {
    flex-direction: column;
    align-items: stretch;
  }
  .logout-btn {
    width: 100%;
    justify-content: center;
  }
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.name-and-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  min-width: 0;
}

.name-and-status h2 {
  margin: 0;
  min-width: 0;
  word-break: break-word;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.status-dot {
  display: inline-block;
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
}

.status-badge.online .status-dot {
  background-color: var(--color-success);
}

.status-badge.offline .status-dot {
  background-color: var(--color-text-muted);
}

.status-badge.retrying .status-dot {
  background: conic-gradient(
    var(--color-success) 0deg,
    var(--color-success) 90deg,
    transparent 180deg
  );
  animation: spin 1s linear infinite;
  border-radius: var(--radius-full);
}

.offline-description,
.pending-description {
  margin: 0;
  width: 100%;
  max-width: 350px;
  line-height: 1.4;
}

.pending-sync-btn {
  color: var(--color-accent);
}

.pending-sync-btn .is-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 360px;
}

.username-form {
  margin-bottom: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.field label {
  display: inline-flex;
  align-items: center;
  flex-direction: row;
  gap: var(--space-1);
}

.required-indicator {
  color: var(--color-danger);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.hint.success {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-success);
}

.hint.error {
  color: var(--color-danger);
}

h3 {
  font-size: var(--font-size-md);
  margin: var(--space-4) 0 var(--space-3) 0;
}

.emoji-scroll {
  max-height: 220px;
  overflow-y: auto;
  margin-top: var(--space-2);
  padding-right: var(--space-1);
}

.emoji-category + .emoji-category {
  margin-top: var(--space-2);
}

.emoji-category-label {
  margin: var(--space-3) 0 var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
