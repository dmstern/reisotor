<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { PopoverPositionStyle } from '../composables/useDoneStatusPopovers';

defineProps<{
  open: boolean;
  popoverStyle: PopoverPositionStyle;
  popoverClass: string;
  heading: string;
  subtext: string;
  dateAriaLabel: string;
  doneButtonLabel: string;
}>();

const date = defineModel<string>('date', { required: true });

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit-done'): void;
  (e: 'submit-plan'): void;
  (e: 'open-calendar'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <PickerMenu v-if="open" :class="popoverClass" :style="popoverStyle" @close="emit('close')">
      <div class="unplanned-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">{{ heading }}</span>
        </div>
        <p class="popover-subtext">{{ subtext }}</p>
        <Input
          v-model="date"
          type="date"
          class="popover-date-input"
          :aria-label="dateAriaLabel"
          @keyup.enter="emit('submit-done')"
        />
        <div class="popover-buttons">
          <Button type="button" variant="primary" size="sm" @click="emit('submit-done')">
            {{ doneButtonLabel }}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :disabled="!date"
            @click="emit('submit-plan')"
          >
            Für Datum einplanen
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="calendar-alt-link"
            @click="emit('open-calendar')"
          >
            <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
            Im Kalender auswählen
          </Button>
        </div>
      </div>
    </PickerMenu>
  </Teleport>
</template>

<style scoped>
.unplanned-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-1);
  width: min(284px, calc(100vw - 40px));
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.popover-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.popover-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.3;
}

.popover-date-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.popover-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.calendar-alt-link {
  font-size: var(--font-size-xs);
}
</style>
