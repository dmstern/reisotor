<script setup lang="ts">
import { ref } from 'vue';
import type { Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  spot: Spot;
  expanded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
}>();

const popoverRef = ref<InstanceType<typeof InfoPopover> | null>(null);

function onEditClick(closePopover?: () => void) {
  closePopover?.();
  emit('edit', props.spot);
}
</script>

<template>
  <span
    v-if="spot.lat == null || spot.lng == null"
    class="spot-location-badge"
    :class="{ 'is-expanded': expanded }"
    title="Standort fehlt: Noch keine Koordinaten hinterlegt"
  >
    <AppIcon
      :icon="ACTION_ICONS.warning"
      :size="12"
      group="actions"
      class="spot-location-warning-icon"
    />
    <span class="spot-location-badge-label">Standort fehlt</span>
    <InfoPopover
      ref="popoverRef"
      class="spot-location-info-popover"
      title="Hinweise zum fehlenden Standort anzeigen"
      aria-label="Hinweise zum fehlenden Standort anzeigen"
      placement="bottom"
      align="right"
      :icon-size="12"
      :menu-width="290"
      @click.stop
    >
      <template #default="{ close }">
        <div class="spot-location-popover-content">
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
  gap: var(--space-1);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
  padding: 2px 4px 2px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
  cursor: default;
  user-select: none;
  flex-shrink: 0;
  box-shadow: var(--shadow-xs);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.spot-location-badge:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  border-color: var(--color-warning);
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
  margin-left: -2px;
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
