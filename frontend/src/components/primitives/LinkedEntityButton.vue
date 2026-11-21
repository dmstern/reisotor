<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { imageDisplayUrl } from '../../utils/imageDisplayUrl';
import Button from './Button.vue';
import AppIcon from '../AppIcon.vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    icon: IconDef;
    iconGroup?: IconGroup;
    imageUrl?: string | null;
    warning?: boolean;
    disabled?: boolean;
    to?: RouteLocationRaw | string;
    href?: string;
    title?: string;
    ariaLabel?: string;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  {
    label: undefined,
    iconGroup: 'actions',
    imageUrl: null,
    warning: false,
    disabled: false,
    to: undefined,
    href: undefined,
    title: undefined,
    ariaLabel: undefined,
    type: 'button',
  }
);

const resolvedImageUrl = computed(() => {
  if (!props.imageUrl) {
    return undefined;
  }

  return imageDisplayUrl(props.imageUrl);
});
</script>

<template>
  <Button
    variant="linked-entity"
    shape="pill"
    :type="type"
    :disabled="disabled"
    :to="to"
    :href="href"
    :title="title"
    :aria-label="ariaLabel"
    class="linked-entity-button"
    :class="{ 'is-warning': warning }"
  >
    <span
      class="linked-entity-badge"
      :class="{ 'has-image': Boolean(resolvedImageUrl) }"
      :style="resolvedImageUrl ? { backgroundImage: `url(${resolvedImageUrl})` } : undefined"
      aria-hidden="true"
    >
      <AppIcon v-if="!resolvedImageUrl" :icon="icon" :size="13" :group="iconGroup" />
    </span>
    <span class="linked-entity-label">
      <slot>{{ label }}</slot>
    </span>
    <slot name="badge" />
    <AppIcon
      :icon="ACTION_ICONS.arrowRight"
      :size="13"
      group="actions"
      class="linked-entity-arrow"
    />
  </Button>
</template>

<style lang="scss" scoped>
.linked-entity-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  background-color: var(--color-primary-tint);
  color: var(--color-primary);
}

.linked-entity-badge.has-image {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.linked-entity-label {
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.linked-entity-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition:
    color 0.15s ease,
    transform 0.15s cubic-bezier(0.2, 0.8, 0.4, 1);
}

@include can-hover {
  .linked-entity-button:hover:not(:disabled):not(.is-disabled) .linked-entity-arrow {
    color: var(--color-primary);
    transform: translateX(2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .linked-entity-arrow {
    transition: color 0.15s ease;
  }

  .linked-entity-button:hover:not(:disabled):not(.is-disabled) .linked-entity-arrow {
    transform: none;
  }
}
</style>
