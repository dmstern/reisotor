<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';
import { TILE_SHADOW_ALPHA } from '../../utils/widgetColors';

const props = defineProps<{
  to?: RouteLocationRaw | string;
  color: string;
  icon: IconDef;
  title: string;
}>();

defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const isLink = computed(() => !!props.to);
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'button'"
    :to="to"
    :type="isLink ? undefined : 'button'"
    class="card tile"
    :class="{ 'tile-btn': !isLink }"
    :style="{
      background: `${color}0d`,
      borderColor: color,
      '--tile-shadow': `${color}${TILE_SHADOW_ALPHA}`,
    }"
    @click="$emit('click', $event)"
  >
    <AppIcon
      class="tile-icon"
      :size="18"
      :style="{
        background: `${color}26`,
        borderColor: color,
        '--tile-icon-shadow': `${color}26`,
      }"
      :icon="icon"
      group="navigation"
      :color="color"
    />
    <h3>{{ title }}</h3>
    <slot />
  </component>
</template>

<style scoped>
.tile {
  position: relative;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 2px 6px var(--tile-shadow, var(--shadow-sm));
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--tile-shadow, var(--shadow-md));
}

.tile-btn {
  width: 100%;
}

.tile-icon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  corner-shape: round;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 6px var(--tile-icon-shadow, var(--shadow-sm));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  padding: 0.5rem;
  backdrop-filter: blur(2px);
}

.tile h3 {
  color: var(--color-primary-dark);
  font-size: 1rem;
  margin-top: var(--space-2);
  text-align: center;
}

.tile :deep(p) {
  text-align: center;
  font-size: 0.88rem;
  margin-top: auto;
  padding-top: 2px;
}

.tile :deep(.budget-meter) {
  margin-top: auto;
}
</style>
