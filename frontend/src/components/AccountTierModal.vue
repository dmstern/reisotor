<script setup lang="ts">
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useAuthStore } from '../stores/auth';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const auth = useAuthStore();

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Kontostatus & Berechtigungen"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="tier-modal-body">
      <div class="status-header">
        <div class="status-badge-wrap">
          <Badge v-if="auth.user?.is_admin" variant="accent-secondary" size="md"
            >Administrator</Badge
          >
          <Badge v-else-if="auth.user?.restricted" variant="warning" size="md">Basis-Konto</Badge>
          <Badge v-else variant="success" size="md">Vollzugriff</Badge>
        </div>
        <p class="status-subtitle">
          <template v-if="auth.user?.is_admin">
            Du besitzt volle Administrator-Rechte auf dieser Reisotor-Instanz.
          </template>
          <template v-else-if="auth.user?.restricted">
            Dein Konto läuft aktuell im eingeschränkten Basis-Modus.
          </template>
          <template v-else>
            Dein Konto ist verifiziert und verfügt über uneingeschränkten Zugriff auf alle
            Funktionen.
          </template>
        </p>
      </div>

      <div class="features-comparison">
        <h3>Enthaltene Funktionen</h3>
        <ul class="feature-list">
          <li class="feature-item enabled">
            <span class="icon check">
              <AppIcon :icon="ACTION_ICONS.done" :size="16" group="actions" />
            </span>
            <div class="feature-text">
              <strong>Gemeinsame Urlaubsplanung</strong>
              <span
                >Beliebig vielen geteilten Urlauben beitreten, Termine, Spots, Touren, Notizen,
                Packlisten & Ausgaben planen.</span
              >
            </div>
          </li>

          <li class="feature-item" :class="auth.user?.restricted ? 'locked' : 'enabled'">
            <span class="icon" :class="auth.user?.restricted ? 'lock' : 'check'">
              <AppIcon
                :icon="auth.user?.restricted ? ACTION_ICONS.private : ACTION_ICONS.done"
                :size="16"
                group="actions"
              />
            </span>
            <div class="feature-text">
              <strong>Eigene Urlaube anlegen</strong>
              <span>{{
                auth.user?.restricted
                  ? 'Maximal 1 eigener Urlaub (Vollzugriff: unbegrenzt)'
                  : 'Unbegrenzt viele eigene Urlaube'
              }}</span>
            </div>
          </li>

          <li class="feature-item" :class="auth.user?.restricted ? 'locked' : 'enabled'">
            <span class="icon" :class="auth.user?.restricted ? 'lock' : 'check'">
              <AppIcon
                :icon="auth.user?.restricted ? ACTION_ICONS.private : ACTION_ICONS.done"
                :size="16"
                group="actions"
              />
            </span>
            <div class="feature-text">
              <strong>Mitglieder pro Urlaub</strong>
              <span>{{
                auth.user?.restricted
                  ? 'Maximal 3 Personen in eigenen Urlauben (Vollzugriff: unbegrenzt)'
                  : 'Unbegrenzt viele Mitreisende einladen'
              }}</span>
            </div>
          </li>

          <li class="feature-item" :class="auth.user?.restricted ? 'locked' : 'enabled'">
            <span class="icon" :class="auth.user?.restricted ? 'lock' : 'check'">
              <AppIcon
                :icon="auth.user?.restricted ? ACTION_ICONS.private : ACTION_ICONS.done"
                :size="16"
                group="actions"
              />
            </span>
            <div class="feature-text">
              <strong>Datei- & Foto-Uploads</strong>
              <span>{{
                auth.user?.restricted
                  ? 'Im Basis-Konto deaktiviert (Tickets, PDFs, Tagebuch-Bilder)'
                  : 'Reiseunterlagen, Tickets, Buchungsbestätigungen & Tagebuch-Fotos'
              }}</span>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="auth.user?.restricted" class="upgrade-info-card">
        <h4>Wie erhalte ich Vollzugriff?</h4>
        <p>
          Um diesen privaten Server vor Überlastung und Speicherengpässen zu schützen, starten neue
          Konten zunächst als Basis-Konto.
        </p>
        <p>
          Wenn du mit dem Betreiber befreundet bist oder zur Familie gehörst:
          <strong
            >Melde dich einfach kurz per Chat (WhatsApp, Signal etc.) bei der Administration</strong
          >. Dein Account kann mit einem einzigen Klick für alle Funktionen freigeschaltet werden!
        </p>
      </div>

      <div class="modal-actions">
        <Button variant="secondary" @click="close">Schließen</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.tier-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.status-header {
  text-align: center;
  padding: var(--space-2) 0;
}

.status-badge-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.status-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.features-comparison h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-md);
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}

.feature-item .icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.feature-item .icon.check {
  background: var(--color-success-tint, rgba(16, 185, 129, 0.15));
  color: var(--color-success);
}

.feature-item .icon.lock {
  background: var(--color-warning-tint, rgba(245, 158, 11, 0.15));
  color: var(--color-warning);
}

.feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-text strong {
  color: var(--color-text);
}

.feature-text span {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.upgrade-info-card {
  padding: var(--space-3);
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: var(--font-size-sm);
}

.upgrade-info-card h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-primary-dark);
}

.upgrade-info-card p {
  margin: 0 0 var(--space-2);
  line-height: 1.45;
}

.upgrade-info-card p:last-child {
  margin-bottom: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}
</style>
