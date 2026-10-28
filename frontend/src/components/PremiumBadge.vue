<script setup lang="ts">
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useAccountTierModal, type TierFeature } from '../composables/useAccountTierModal';

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md';
    label?: string;
    feature?: TierFeature;
    stop?: boolean;
  }>(),
  {
    size: 'sm',
    label: 'Premium',
    feature: 'general',
    stop: true,
  }
);

const emit = defineEmits<{
  (e: 'click', ev: MouseEvent): void;
}>();

const { openAccountTierModal } = useAccountTierModal();

function handleClick(ev: MouseEvent) {
  if (props.stop) {
    ev.stopPropagation();
    ev.preventDefault();
  }
  openAccountTierModal(props.feature);
  emit('click', ev);
}
</script>

<template>
  <Badge
    as="button"
    type="button"
    variant="accent"
    :size="size"
    class="premium-badge"
    interactive
    title="Vollzugriff erforderlich – Klicken für Details"
    aria-label="Vollzugriff erforderlich"
    @click="handleClick"
  >
    <AppIcon :icon="ACTION_ICONS.sparkles" :size="size === 'md' ? 14 : 11" group="actions" />
    <span class="premium-label">{{ label }}</span>
  </Badge>
</template>

<style scoped>
.premium-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  cursor: pointer;
  vertical-align: middle;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: var(--color-warning-tint, rgba(245, 158, 11, 0.15));
  color: var(--color-warning-dark, #b45309);
  border: 1px solid var(--color-warning-border, rgba(245, 158, 11, 0.35));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition:
    transform var(--transition-fast),
    filter var(--transition-fast);
}

.premium-badge:hover {
  filter: brightness(1.08);
  transform: translateY(-0.5px);
}

.premium-badge:focus-visible {
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 2px;
}

.premium-badge:active {
  transform: translateY(0);
}

.premium-label {
  text-transform: uppercase;
  font-size: 0.72em;
  letter-spacing: 0.04em;
}
</style>
