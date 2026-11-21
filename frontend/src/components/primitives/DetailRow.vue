<script setup lang="ts">
import { computed } from 'vue';
import { FORM_FIELD_ICONS, type FormFieldIconKey } from '../../utils/formFieldIcons';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';
import AppIcon from '../AppIcon.vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    icon?: FormFieldIconKey | IconDef;
    iconGroup?: IconGroup;
    tag?: string;
  }>(),
  {
    label: '',
    icon: undefined,
    iconGroup: 'formFields',
    tag: 'div',
  }
);

const resolvedIcon = computed<IconDef | undefined>(() => {
  if (!props.icon) {
    return undefined;
  }

  return typeof props.icon === 'string' ? FORM_FIELD_ICONS[props.icon] : props.icon;
});
</script>

<template>
  <component :is="tag" class="detail-row">
    <slot name="label">
      <dt v-if="label || resolvedIcon" class="detail-row__label">
        <AppIcon
          v-if="resolvedIcon"
          :icon="resolvedIcon"
          :size="13"
          :group="iconGroup"
          class="detail-row__icon"
        />
        <span v-if="label">{{ label }}</span>
      </dt>
    </slot>
    <dd class="detail-row__value">
      <slot />
    </dd>
  </component>
</template>

<style scoped>
.detail-row {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2xs) var(--space-1-5);
  overflow-wrap: break-word;
  min-width: 0;
}

.detail-row__label {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: var(--line-height-snug);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.detail-row__icon {
  flex-shrink: 0;
  align-self: center;
}

.detail-row__value {
  margin: 0;
  min-width: 0;
  line-height: var(--line-height-snug);
  color: var(--color-text);
  overflow-wrap: anywhere;
}
</style>
