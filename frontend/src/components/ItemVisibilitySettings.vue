<script setup lang="ts">
import { computed } from 'vue';
import type { TrackVisibility } from '../api/types';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

// ItemVisibilitySettings.vue: Wiederverwendbare Berechtigungs- und Sichtbarkeits-Einstellung
// für Urlaubs-Objekte (Aufzeichnungen/Tracks, Spots, Touren etc.). Bietet zwei zugängliche,
// taktile Kacheln (Privat vs. Geteilt) mit Icons, detaillierten Erklärungen und barrierefreier
// Radiogroup-Steuerung.

export interface ItemVisibilityOption {
  value: TrackVisibility;
  label: string;
  description: string;
  badge: string;
  icon: IconDef;
}

const props = withDefaults(
  defineProps<{
    modelValue: TrackVisibility;
    itemLabel?: string;
    disabled?: boolean;
    showHint?: boolean;
    modified?: boolean;
  }>(),
  {
    itemLabel: 'Aufzeichnung',
    disabled: false,
    showHint: true,
    modified: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: TrackVisibility): void;
  (e: 'change', value: TrackVisibility): void;
}>();

const options = computed<ItemVisibilityOption[]>(() => [
  {
    value: 'private',
    label: 'Nur für mich sichtbar',
    description: `Nur du kannst diese ${props.itemLabel} sehen und verwalten. Mitreisende haben keinen Zugriff darauf.`,
    badge: 'Privat',
    icon: ACTION_ICONS.private,
  },
  {
    value: 'shared',
    label: 'Für alle Mitreisenden sichtbar',
    description: `Alle Mitglieder dieses Urlaubs können diese ${props.itemLabel} auf der Karte und in Touren sehen.`,
    badge: 'Geteilt',
    icon: ACTION_ICONS.shared,
  },
]);

function select(val: TrackVisibility) {
  if (props.disabled || props.modelValue === val) return;
  emit('update:modelValue', val);
  emit('change', val);
}

function onKeydown(e: KeyboardEvent, currentVal: TrackVisibility) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    select(currentVal);
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    const nextVal: TrackVisibility = currentVal === 'private' ? 'shared' : 'private';
    select(nextVal);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const prevVal: TrackVisibility = currentVal === 'shared' ? 'private' : 'shared';
    select(prevVal);
  }
}
</script>

<template>
  <div class="visibility-settings" role="radiogroup" aria-label="Sichtbarkeit auswählen">
    <div class="visibility-intro">
      <span class="visibility-intro-title">Sichtbarkeit in der Reisegruppe</span>
      <p class="visibility-intro-desc">
        Lege fest, wer in deiner Reisegruppe Zugriff auf diese {{ itemLabel }} hat.
      </p>
    </div>

    <div class="visibility-cards">
      <div
        v-for="opt in options"
        :key="opt.value"
        class="visibility-card"
        :class="{
          'is-active': modelValue === opt.value,
          'is-disabled': disabled,
        }"
        role="radio"
        :aria-checked="modelValue === opt.value"
        :aria-disabled="disabled"
        tabindex="0"
        @click="select(opt.value)"
        @keydown="onKeydown($event, opt.value)"
      >
        <div class="visibility-card-icon" :class="`visibility-card-icon--${opt.value}`">
          <AppIcon :icon="opt.icon" :size="20" group="actions" />
        </div>

        <div class="visibility-card-body">
          <div class="visibility-card-head">
            <span class="visibility-card-label">{{ opt.label }}</span>
            <span class="visibility-card-badge" :class="`badge--${opt.value}`">{{
              opt.badge
            }}</span>
          </div>
          <p class="visibility-card-desc">{{ opt.description }}</p>
        </div>

        <div class="visibility-card-indicator" aria-hidden="true">
          <div class="radio-circle">
            <div v-if="modelValue === opt.value" class="radio-dot" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="showHint" class="visibility-hint">
      <AppIcon :icon="ACTION_ICONS.history" :size="14" group="actions" />
      <span
        >Private Aufzeichnungen können jederzeit nachträglich für Mitreisende freigegeben
        werden.</span
      >
    </div>
  </div>
</template>

<style scoped>
.visibility-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.visibility-intro {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.visibility-intro-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.visibility-intro-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.visibility-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.visibility-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.visibility-card:hover:not(.is-disabled) {
  border-color: var(--color-primary-light, var(--color-border));
  background: var(--color-hover);
}

.visibility-card.is-active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
  box-shadow: 0 0 0 1px var(--color-primary);
}

.visibility-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.visibility-card.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.visibility-card-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg);
  color: var(--color-text-muted);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.visibility-card.is-active .visibility-card-icon--private {
  background: color-mix(in srgb, var(--color-text-muted) 20%, transparent);
  color: var(--color-text);
}

.visibility-card.is-active .visibility-card-icon--shared {
  background: var(--color-primary);
  color: #fff;
}

.visibility-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.visibility-card-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.visibility-card-label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.visibility-card-badge {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  corner-shape: round;
}

.badge--private {
  background: var(--color-border);
  color: var(--color-text-muted);
}

.badge--shared {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
}

.visibility-card-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.visibility-card-indicator {
  display: flex;
  align-items: center;
  padding-top: 2px;
  flex-shrink: 0;
}

.radio-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.18s ease;
}

.visibility-card.is-active .radio-circle {
  border-color: var(--color-primary);
}

.radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary);
}

.visibility-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}
</style>
