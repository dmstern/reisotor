<script setup lang="ts">
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Alert from './primitives/Alert.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { IconLink, IconLinkOff } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDuration } from '../utils/formatRoute';
import type { TimeDurationStatus } from '../composables/useLegTimeSync';

const departureTime = defineModel<string>('departureTime', { default: '' });
const arrivalTime = defineModel<string>('arrivalTime', { default: '' });

defineProps<{
  departureLabel: string;
  isTimeLinked: boolean;
  canToggleLink: boolean;
  timeLinkTitle: string;
  timeDurationInfo?: { label: string; duration: string } | null;
  timeDurationStatus?: TimeDurationStatus | null;
  activeDurationSeconds?: number | null;
}>();

const emit = defineEmits<{
  (e: 'departureInput', event: Event): void;
  (e: 'arrivalInput', event: Event): void;
  (e: 'toggleTimeLink'): void;
  (e: 'syncTimes'): void;
  (e: 'applySuggestedTime', field: 'departure' | 'arrival', target: string): void;
}>();

const timeLinkedIconDef: IconDef = {
  id: 'link',
  emoji: '🔗',
  outline: IconLink,
};

const timeUnlinkedIconDef: IconDef = {
  id: 'link-off',
  emoji: '🔓',
  outline: IconLinkOff,
};

function onDepartureChange(event: Event) {
  emit('departureInput', event);
}

function onArrivalChange(event: Event) {
  emit('arrivalInput', event);
}
</script>

<template>
  <div class="time-section">
    <div class="time-row">
      <FormField icon="time" :label="departureLabel" class="time-field time-field--departure">
        <div class="time-input-wrap departure-time-wrapper">
          <Input
            v-model="departureTime"
            type="time"
            @input="onDepartureChange"
            @change="onDepartureChange"
          />
        </div>
      </FormField>

      <!-- Kettensegment-Koppel-Button zwischen Abfahrt und Ankunft (Photoshop/Gimp-Stil) -->
      <div
        class="time-link-connector"
        :class="{ 'is-linked': isTimeLinked, 'is-disabled': !canToggleLink }"
      >
        <button
          type="button"
          class="time-link-btn"
          :class="{ 'is-linked': isTimeLinked }"
          :disabled="!canToggleLink"
          :title="timeLinkTitle"
          :aria-label="timeLinkTitle"
          data-testid="time-link-toggle"
          @click="emit('toggleTimeLink')"
        >
          <AppIcon
            :icon="isTimeLinked ? timeLinkedIconDef : timeUnlinkedIconDef"
            :size="15"
            group="actions"
          />
        </button>
      </div>

      <FormField icon="time" label="Ankunft" class="time-field time-field--arrival">
        <div class="time-input-wrap arrival-time-wrapper">
          <Input
            v-model="arrivalTime"
            type="time"
            @input="onArrivalChange"
            @change="onArrivalChange"
          />
        </div>
      </FormField>
    </div>

    <!-- Diskreter Dauer-Chip (wenn Zeiten synchron oder bekannt) -->
    <div v-if="timeDurationInfo" class="time-meta-row" data-testid="time-duration-chip">
      <span class="time-duration-chip" :class="{ 'is-linked': isTimeLinked }">
        <AppIcon :icon="ACTION_ICONS.duration" :size="13" group="actions" />
        <span>
          {{ timeDurationInfo.label }}:
          <strong>{{ timeDurationInfo.duration }}</strong>
        </span>
      </span>
    </div>

    <!-- Warnhinweis nur bei Mismatch (Zeiten weichen von Reisedauer ab) -->
    <Alert
      v-if="timeDurationStatus?.type === 'mismatch'"
      class="time-sync-bar time-sync-bar--mismatch"
      variant="warning"
      :icon="ACTION_ICONS.warning"
      size="sm"
      data-testid="time-sync-bar"
    >
      <span class="time-sync-message">
        Zeitfenster:
        <strong>{{ formatDuration((timeDurationStatus.elapsedMinutes ?? 0) * 60) }}</strong>
        (Reisedauer: {{ formatDuration(activeDurationSeconds) }},
        {{
          (timeDurationStatus.diffMinutes ?? 0) > 0
            ? `+${formatDuration((timeDurationStatus.diffMinutes ?? 0) * 60)} Puffer`
            : `-${formatDuration(Math.abs(timeDurationStatus.diffMinutes ?? 0) * 60)}`
        }})
      </span>

      <template #actions>
        <Button type="button" size="sm" variant="secondary" @click="emit('syncTimes')">
          Anpassen
        </Button>
      </template>
    </Alert>

    <!-- Übernahme-Vorschlag wenn nur ein Zeitfeld befüllt und Zeiten entkoppelt -->
    <Alert
      v-else-if="timeDurationStatus?.type === 'suggest'"
      class="time-sync-bar time-sync-bar--suggest"
      variant="info"
      :icon="ACTION_ICONS.sparkles"
      size="sm"
      data-testid="time-sync-bar"
    >
      <span class="time-sync-message">
        {{ timeDurationStatus.text }}
      </span>

      <template #actions>
        <Button
          type="button"
          size="sm"
          variant="primary"
          :icon="ACTION_ICONS.sparkles"
          data-testid="time-apply-btn"
          @click="emit('applySuggestedTime', timeDurationStatus.field!, timeDurationStatus.target!)"
        >
          Übernehmen
        </Button>
      </template>
    </Alert>
  </div>
</template>

<style scoped>
.time-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.time-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: flex-end;
  gap: var(--space-2);
  position: relative;
}

.time-field {
  min-width: 0;
}

.time-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.time-input-wrap :deep(.input) {
  width: 100%;
  font-variant-numeric: tabular-nums;
  padding: 9px var(--space-2);
}

.time-link-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--input-height, 44px);
  position: relative;
  padding: 0 var(--space-1);
}

.time-link-connector::before,
.time-link-connector::after {
  content: '';
  position: absolute;
  top: 50%;
  width: var(--space-2);
  height: 1.5px;
  background: var(--color-border-strong);
  transition: background-color var(--transition-fast, 0.15s ease);
  pointer-events: none;
}

.time-link-connector::before {
  right: 100%;
}

.time-link-connector::after {
  left: 100%;
}

.time-link-connector.is-linked::before,
.time-link-connector.is-linked::after {
  background: var(--color-primary);
}

.time-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
  padding: 0;
  z-index: 1;
}

.time-link-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-hover);
  transform: scale(1.1);
  box-shadow: var(--shadow-sm);
}

.time-link-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.time-link-btn.is-linked {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
  color: var(--color-primary);
}

.time-link-btn.is-linked:hover:not(:disabled) {
  background: var(--color-primary-tint);
  border-color: var(--color-primary-dark);
  color: var(--color-primary-dark);
}

.time-link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.time-link-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.time-meta-row {
  display: flex;
  justify-content: center;
  animation: route-content-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.time-duration-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition:
    background-color var(--transition-fast, 0.15s ease),
    border-color var(--transition-fast, 0.15s ease),
    color var(--transition-fast, 0.15s ease);
}

.time-duration-chip.is-linked {
  color: var(--color-primary-dark, var(--color-primary));
  background: var(--color-primary-tint);
  border-color: transparent;
}

.time-sync-bar {
  margin-top: calc(-1 * var(--space-1));
}

.time-sync-message {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes route-content-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .time-link-btn,
  .time-link-connector::before,
  .time-link-connector::after,
  .time-duration-chip,
  .time-meta-row {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}

@container (max-width: 480px) {
  .time-input-wrap :deep(.input) {
    padding: 9px 6px;
    font-size: var(--font-size-sm);
  }
}
</style>
