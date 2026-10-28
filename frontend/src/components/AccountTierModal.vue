<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useAuthStore } from '../stores/auth';
import { useAccountTierModal, type TierFeature } from '../composables/useAccountTierModal';

const props = defineProps<{
  modelValue?: boolean;
  feature?: TierFeature | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const auth = useAuthStore();
const tierModalState = useAccountTierModal();
const instance = getCurrentInstance();

const isControlled = computed(() => {
  const vnodeProps = instance?.vnode.props;
  return vnodeProps != null && ('modelValue' in vnodeProps || 'model-value' in vnodeProps);
});

const isVisible = computed({
  get() {
    if (isControlled.value) {
      return props.modelValue ?? false;
    }
    return tierModalState.isOpen.value;
  },
  set(val: boolean) {
    if (isControlled.value) {
      emit('update:modelValue', val);
    } else {
      if (!val) {
        tierModalState.closeAccountTierModal();
      } else {
        tierModalState.openAccountTierModal();
      }
    }
  },
});

const activeFeature = computed(() => {
  const vnodeProps = instance?.vnode.props;
  if (vnodeProps != null && 'feature' in vnodeProps) {
    return props.feature;
  }
  return tierModalState.highlightedFeature.value;
});

const featureNotice = computed(() => {
  if (!auth.user?.restricted) return null;
  switch (activeFeature.value) {
    case 'trips':
      return {
        title: 'Urlaub anlegen',
        description:
          'Im Basis-Konto ist maximal 1 eigener Urlaub möglich. Mit Reisotor Plus kannst du unbegrenzt viele eigene Urlaube anlegen.',
      };
    case 'members':
      return {
        title: 'Mitglieder einladen',
        description:
          'Im Basis-Konto können bis zu 3 Personen an einem Urlaub teilnehmen. Mit Reisotor Plus kannst du unbegrenzt viele Mitreisende einladen.',
      };
    case 'uploads':
      return {
        title: 'Datei- & Foto-Uploads',
        description: 'Tickets, Buchungsunterlagen und Tagebuch-Fotos erfordern Reisotor Plus.',
      };
    case 'general':
      return {
        title: 'Reisotor Plus erforderlich',
        description: 'Diese Funktion ist für verifizierte Konten mit Reisotor Plus reserviert.',
      };
    default:
      return null;
  }
});

function close() {
  isVisible.value = false;
}
</script>

<template>
  <Modal
    :model-value="isVisible"
    title="Kontostatus & Berechtigungen"
    size="md"
    @update:model-value="isVisible = $event"
  >
    <div class="tier-modal-body">
      <div v-if="featureNotice" class="feature-notice-card">
        <div class="notice-icon">
          <AppIcon :icon="ACTION_ICONS.sparkle2" :size="18" group="actions" />
        </div>
        <div class="notice-text">
          <span class="notice-badge">Reisotor Plus erforderlich</span>
          <strong>{{ featureNotice.title }}</strong>
          <p>{{ featureNotice.description }}</p>
        </div>
      </div>

      <div class="status-header">
        <div class="status-badge-wrap">
          <Badge v-if="auth.user?.is_admin" variant="accent-secondary" size="md"
            >Administrator</Badge
          >
          <Badge v-else-if="auth.user?.restricted" variant="warning" size="md">Basis-Konto</Badge>
          <Badge v-else variant="success" size="md">Plus</Badge>
        </div>
        <p class="status-subtitle">
          <template v-if="auth.user?.is_admin">
            Du besitzt volle Administrator-Rechte auf dieser Reisotor-Instanz.
          </template>
          <template v-else-if="auth.user?.restricted">
            Dein Konto läuft aktuell im eingeschränkten Basis-Modus.
          </template>
          <template v-else>
            Dein Konto verfügt über Reisotor Plus mit uneingeschränktem Zugriff auf alle Funktionen.
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

          <li
            class="feature-item"
            :class="[
              auth.user?.restricted ? 'locked' : 'enabled',
              { highlighted: activeFeature === 'trips' && auth.user?.restricted },
            ]"
          >
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
                  ? 'Maximal 1 eigener Urlaub (Plus: unbegrenzt)'
                  : 'Unbegrenzt viele eigene Urlaube'
              }}</span>
            </div>
          </li>

          <li
            class="feature-item"
            :class="[
              auth.user?.restricted ? 'locked' : 'enabled',
              { highlighted: activeFeature === 'members' && auth.user?.restricted },
            ]"
          >
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
                  ? 'Maximal 3 Personen in eigenen Urlauben (Plus: unbegrenzt)'
                  : 'Unbegrenzt viele Mitreisende einladen'
              }}</span>
            </div>
          </li>

          <li
            class="feature-item"
            :class="[
              auth.user?.restricted ? 'locked' : 'enabled',
              { highlighted: activeFeature === 'uploads' && auth.user?.restricted },
            ]"
          >
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

          <li v-if="auth.user?.is_admin" class="feature-item enabled">
            <span class="icon check">
              <AppIcon :icon="ACTION_ICONS.done" :size="16" group="actions" />
            </span>
            <div class="feature-text">
              <strong>Instanz- & Serververwaltung</strong>
              <span
                >Vollzugriff auf Instanz-Einstellungen, Benutzerkonten & Rollen, Registrierungsmodi
                sowie System-Backups.</span
              >
            </div>
          </li>
        </ul>
      </div>

      <div v-if="auth.user?.restricted" class="upgrade-info-card">
        <h4>Wie erhalte ich Reisotor Plus?</h4>
        <p>
          Um diesen privaten Server vor Überlastung und Speicherengpässen zu schützen, starten neue
          Konten zunächst als Basis-Konto.
        </p>
        <p>
          Wenn du mit dem Betreiber befreundet bist oder zur Familie gehörst:
          <strong
            >Melde dich einfach kurz per Chat (WhatsApp, Signal etc.) bei der Administration</strong
          >. Dein Account kann mit einem einzigen Klick für Reisotor Plus freigeschaltet werden!
        </p>
      </div>

      <div class="modal-actions actions-row">
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

.feature-notice-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-warning-tint, rgba(245, 158, 11, 0.12));
  border: 1px solid var(--color-warning-border, rgba(245, 158, 11, 0.35));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.notice-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: var(--color-warning-tint, rgba(245, 158, 11, 0.2));
  color: var(--color-warning-dark, #b45309);
  flex-shrink: 0;
}

.notice-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: break-word;
}

.notice-badge {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--color-warning-dark, #b45309);
}

.notice-text strong {
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.notice-text p {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
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
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.feature-item.highlighted {
  border: 1.5px solid var(--color-warning-border, rgba(245, 158, 11, 0.5));
  border-radius: var(--radius-sm-squircle);
  padding: var(--space-2);
  background: var(--color-warning-tint, rgba(245, 158, 11, 0.08));
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
  min-width: 0;
  overflow-wrap: break-word;
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
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: var(--font-size-sm);
  overflow-wrap: break-word;
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
