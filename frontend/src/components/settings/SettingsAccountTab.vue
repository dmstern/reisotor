<script setup lang="ts">
import { onMounted, watch } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import IconButton from '../primitives/IconButton.vue';
import Input from '../primitives/Input.vue';
import PasswordInput from '../PasswordInput.vue';
import AppIcon from '../AppIcon.vue';
import PendingSyncCard from './PendingSyncCard.vue';
import { useAccountTierModal } from '../../composables/useAccountTierModal';
import { useAuthStore } from '../../stores/auth';
import { useConnectivityStore } from '../../stores/connectivity';
import { useAccountSettings } from '../../composables/useAccountSettings';
import { ACTION_ICONS } from '../../utils/actionIcons';

const auth = useAuthStore();
const connectivity = useConnectivityStore();
const { openAccountTierModal } = useAccountTierModal();

function scrollToUnsynced() {
  const el = document.getElementById('unsynced-items');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const {
  avatarSaving,
  avatarSaved,
  usernameForm,
  usernameError,
  usernameSaved,
  usernameSaving,
  emailForm,
  emailError,
  emailSuccess,
  emailSaved,
  emailSaving,
  emailCancelling,
  emailResending,
  passwordForm,
  passwordError,
  passwordSaved,
  passwordSaving,
  EMOJI_CATEGORIES,
  initUsername,
  initEmail,
  changeUsername,
  changeEmail,
  cancelPendingEmail,
  resendVerificationEmail,
  selectAvatar,
  changePassword,
  logout,
} = useAccountSettings();

onMounted(() => {
  initUsername();
  initEmail();
});

watch(
  () => [auth.user?.username, auth.user?.email],
  () => {
    initUsername();
    initEmail();
  }
);
</script>

<template>
  <div class="account-tab">
    <Card>
      <div class="header account-header">
        <div class="user-info">
          <div class="name-and-status">
            <h2>{{ auth.user?.avatar }} {{ auth.user?.username }}</h2>
            <button
              type="button"
              class="tier-badge-btn"
              :title="
                auth.user?.is_admin
                  ? 'Administrator-Status anzeigen'
                  : auth.user?.restricted
                    ? 'Informationen zu deinem Basis-Konto anzeigen'
                    : 'Informationen zu deinen Kontorechten anzeigen'
              "
              @click="openAccountTierModal()"
            >
              <Badge v-if="auth.user?.is_admin" variant="accent-secondary">Admin</Badge>
              <Badge v-else-if="auth.user?.restricted" variant="warning" class="tier-badge">
                Basis-Konto
                <AppIcon :icon="ACTION_ICONS.info" :size="12" group="actions" />
              </Badge>
              <Badge v-else variant="success" class="tier-badge">
                Vollzugriff
                <AppIcon :icon="ACTION_ICONS.done" :size="12" group="actions" />
              </Badge>
            </button>
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
            <button type="button" class="jump-to-unsynced" @click="scrollToUnsynced">
              Einträge ansehen ↓
            </button>
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

      <form class="form email-form" @submit.prevent="changeEmail">
        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="profile-email">
            <span class="label-row">
              <span>
                E-Mail-Adresse
                <span class="required-indicator" aria-hidden="true">*</span>
              </span>
              <Badge
                v-if="auth.user?.email && auth.user?.is_email_verified"
                variant="success"
                size="sm"
                class="verified-badge"
              >
                Bestätigt
                <AppIcon :icon="ACTION_ICONS.done" :size="10" group="actions" />
              </Badge>
              <Badge
                v-else-if="auth.user?.email && !auth.user?.is_email_verified"
                variant="warning"
                size="sm"
                class="verified-badge"
              >
                Unbestätigt
              </Badge>
            </span>
          </label>
          <Input
            id="profile-email"
            v-model="emailForm.email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          />
        </div>

        <div v-if="auth.user?.pending_email" class="pending-email-box">
          <div class="pending-email-info">
            <AppIcon :icon="ACTION_ICONS.mail" :size="16" group="actions" class="pending-icon" />
            <div class="pending-text">
              <p class="pending-title">Bestätigung ausstehend</p>
              <p class="pending-description">
                Bestätigungslink an <strong>{{ auth.user.pending_email }}</strong> gesendet.
              </p>
            </div>
          </div>
          <div class="pending-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              :disabled="emailResending"
              @click="resendVerificationEmail"
            >
              {{ emailResending ? 'Wird gesendet…' : 'Link erneut senden' }}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="emailCancelling"
              @click="cancelPendingEmail"
            >
              {{ emailCancelling ? 'Wird abgebrochen…' : 'Abbrechen' }}
            </Button>
          </div>
        </div>

        <p v-if="emailError" class="hint error">{{ emailError }}</p>
        <p v-if="emailSaved" class="hint success">
          {{ emailSuccess }} <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
        </p>
        <p v-else-if="emailSuccess" class="hint success">
          {{ emailSuccess }}
        </p>
        <Button type="submit" :disabled="emailSaving">
          {{ emailSaving ? 'Speichern…' : 'E-Mail-Adresse speichern' }}
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

    <PendingSyncCard />
  </div>
</template>

<style scoped>
.tier-badge-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  border-radius: var(--radius-pill);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.tier-badge-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.tier-badge-btn:focus-visible {
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 2px;
}

.tier-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.account-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

.jump-to-unsynced {
  display: inline-block;
  margin-left: var(--space-2);
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
  text-decoration: underline;
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

.email-form {
  margin-bottom: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.verified-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.pending-email-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-primary-tint);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md-squircle);
}

.pending-email-info {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.pending-icon {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.pending-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-xs);
}

.pending-title {
  margin: 0;
  font-weight: 600;
  color: var(--color-text);
}

.pending-description {
  margin: 0;
  color: var(--color-text-muted);
  word-break: break-all;
}

.pending-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
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
