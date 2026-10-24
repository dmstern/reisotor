<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    spot?: Spot | null;
    hasCoords?: boolean;
    expanded?: boolean;
    /**
     * 'card': Popover erklärt Nutzen des Standorts, Klick auf Badge öffnet Bearbeiten.
     * 'dialog': Popover erklärt Methoden zum Festlegen des Standorts (im Edit-Dialog).
     */
    context?: 'card' | 'dialog';
    popoverClass?: string;
  }>(),
  {
    spot: null,
    hasCoords: undefined,
    expanded: false,
    context: 'card',
    popoverClass: '',
  }
);

const emit = defineEmits<{
  (e: 'edit', spot?: Spot): void;
}>();

const isMissing = computed(() => {
  if (props.hasCoords !== undefined) return !props.hasCoords;
  if (props.spot) return props.spot.lat == null || props.spot.lng == null;
  return true;
});

function onBadgeActionClick() {
  if (props.context === 'card') {
    emit('edit', props.spot ?? undefined);
  }
}

function onEditClick(closePopover?: () => void) {
  closePopover?.();
  emit('edit', props.spot ?? undefined);
}
</script>

<template>
  <span
    v-if="isMissing"
    class="spot-location-badge"
    :class="{
      'is-expanded': expanded,
      'is-clickable': context === 'card',
      'is-dialog': context === 'dialog',
    }"
  >
    <button
      v-if="context === 'card'"
      type="button"
      class="spot-location-badge-action-btn"
      title="Standort fehlt – jetzt im Bearbeiten-Dialog festlegen"
      aria-label="Standort fehlt – jetzt im Bearbeiten-Dialog festlegen"
      @click.stop="onBadgeActionClick"
    >
      <AppIcon
        :icon="ACTION_ICONS.warning"
        :size="12"
        group="actions"
        class="spot-location-warning-icon status-warning-icon"
      />
      <span class="spot-location-badge-label">Standort fehlt</span>
    </button>
    <span v-else class="spot-location-badge-display">
      <AppIcon
        :icon="ACTION_ICONS.warning"
        :size="12"
        group="actions"
        class="spot-location-warning-icon status-warning-icon"
      />
      <span class="spot-location-badge-label">Standort fehlt</span>
    </span>

    <InfoPopover
      class="spot-location-info-popover"
      :class="popoverClass"
      :title="
        context === 'dialog' ? 'Standort festlegen' : 'Hinweise zum fehlenden Standort anzeigen'
      "
      :aria-label="
        context === 'dialog'
          ? 'Hinweise zum Festlegen des Standorts anzeigen'
          : 'Hinweise zum fehlenden Standort anzeigen'
      "
      placement="bottom"
      :align="context === 'dialog' ? 'left' : 'right'"
      :icon-size="12"
      :menu-width="context === 'dialog' ? 260 : 290"
      @click.stop
    >
      <template #default="{ close }">
        <div v-if="context === 'dialog'" class="spot-location-popover-content">
          <p>
            <strong>Standort festlegen:</strong>
          </p>
          <p>
            • <strong>Ortssuche:</strong> Nutze die Suchleiste oben für Adressen oder
            Sehenswürdigkeiten.
          </p>
          <p>
            • <strong>Karten-Link:</strong> Kopiere einen Google Maps-, Apple Maps- oder OSM-Link in
            das Suchfeld.
          </p>
          <p class="popover-tip">
            📍 Tippe alternativ direkt auf die Karte, um die Stecknadel manuell zu platzieren.
          </p>
        </div>
        <div v-else class="spot-location-popover-content">
          <p>
            <strong>Warum ist der Standort wichtig?</strong>
          </p>
          <p>
            🗺️ <strong>Karten-Ansicht:</strong> Ohne Koordinaten kann der Spot nicht auf der
            Reisekarte angezeigt werden.
          </p>
          <p>
            🚗 <strong>Wege & Zeiten:</strong> Routen, Distanzen und Fahrzeiten lassen sich nur mit
            Standort berechnen.
          </p>
          <p>
            ☀️ <strong>Wetterdaten:</strong> Lokale Wetterprognosen und Sonnenzeiten basieren auf
            genauen Koordinaten.
          </p>
          <p>
            🧭 <strong>Navigation:</strong> Schnelles Öffnen und Navigieren in externen Karten-Apps.
          </p>
          <div class="popover-action">
            <Button
              variant="primary"
              size="sm"
              class="popover-edit-btn"
              :icon="ACTION_ICONS.edit"
              @click="onEditClick(close)"
            >
              Standort jetzt festlegen
            </Button>
          </div>
        </div>
      </template>
    </InfoPopover>
  </span>
</template>

<style scoped>
.spot-location-badge {
  display: inline-flex;
  align-items: center;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
  border-radius: var(--radius-pill);
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
  box-shadow: var(--shadow-xs);
  flex-shrink: 0;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.spot-location-badge.is-clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  border-color: var(--color-warning);
}

.spot-location-badge-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 2px 2px 7px;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  line-height: 1.2;
  border-radius: var(--radius-pill) 0 0 var(--radius-pill);
  transition: opacity 0.15s ease;
}

.spot-location-badge-action-btn:hover {
  opacity: 0.82;
}

.spot-location-badge-action-btn:focus-visible {
  outline: 2px solid var(--color-warning);
  outline-offset: -1px;
}

.spot-location-badge-display {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 2px 2px 7px;
  line-height: 1.2;
}

.spot-location-warning-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.spot-location-badge-label {
  font-weight: 650;
  letter-spacing: -0.01em;
}

.spot-location-info-popover {
  display: inline-flex;
  align-items: center;
  padding-right: 3px;
}

.spot-location-info-popover :deep(.info-popover-btn) {
  width: 18px;
  height: 18px;
  color: var(--color-warning-dark);
  opacity: 0.85;
}

.spot-location-info-popover :deep(.info-popover-btn:hover),
.spot-location-info-popover :deep(.info-popover-btn:focus-visible) {
  opacity: 1;
  color: var(--color-warning);
}

.spot-location-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.popover-action {
  margin-top: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.popover-edit-btn {
  width: 100%;
  justify-content: center;
}
</style>
