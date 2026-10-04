<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { CalendarEntry } from '../api/types';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import {
  calendarEventFromEntry,
  googleCalendarHref,
  outlookCalendarHref,
  triggerIcsDownload,
} from '../utils/calendarExport';

const props = withDefaults(
  defineProps<{
    entry: CalendarEntry;
    variant?: 'secondary' | 'card-action';
    size?: 'sm' | 'md';
    label?: string;
    showLabel?: boolean;
    title?: string;
    ariaLabel?: string;
  }>(),
  {
    variant: 'secondary',
    size: 'sm',
    label: 'In Kalender',
    showLabel: false,
    title: 'Zum eigenen Kalender hinzufügen',
    ariaLabel: 'Zum eigenen Kalender hinzufügen',
  }
);

const isOpen = ref(false);
const pickerStyle = ref({ top: '0px', left: '0px' });
const eventData = computed(() => calendarEventFromEntry(props.entry));

async function togglePicker(event: MouseEvent) {
  if (isOpen.value) {
    isOpen.value = false;
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  isOpen.value = true;
  pickerStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.right - 188, window.innerWidth - 196))}px`,
  };
  await nextTick();
  const menuRect = document.querySelector('.picker-menu')?.getBoundingClientRect();
  if (menuRect && menuRect.bottom > window.innerHeight - 8) {
    pickerStyle.value = {
      ...pickerStyle.value,
      top: `${Math.max(8, window.innerHeight - menuRect.height - 8)}px`,
    };
  }
}

function downloadIcs() {
  triggerIcsDownload(eventData.value);
  isOpen.value = false;
}
</script>

<template>
  <div class="calendar-export">
    <Button
      :variant="variant"
      :size="size"
      class="calendar-btn"
      :class="{ 'always-show-label': showLabel }"
      :title="title"
      :aria-label="ariaLabel"
      @click.stop="togglePicker($event)"
    >
      <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" />
      <span class="calendar-btn-label">{{ label }}</span>
    </Button>
    <Teleport to="body">
      <PickerMenu v-if="isOpen" :style="pickerStyle" origin="top-right" @close="isOpen = false">
        <DropdownItem :icon="ACTION_ICONS.apple" label="Apple/iPhone" @click="downloadIcs" />
        <DropdownItem
          :href="googleCalendarHref(eventData)"
          target="_blank"
          rel="noopener"
          :icon="ACTION_ICONS.googleCalendar"
          label="Google Kalender"
          @click="isOpen = false"
        />
        <DropdownItem
          :href="outlookCalendarHref(eventData)"
          target="_blank"
          rel="noopener"
          :icon="FORM_FIELD_ICONS.email"
          icon-group="formFields"
          label="Outlook"
          @click="isOpen = false"
        />
        <DropdownItem :icon="ACTION_ICONS.android" label="Android" @click="downloadIcs" />
      </PickerMenu>
    </Teleport>
  </div>
</template>

<style scoped>
.calendar-export {
  display: inline-flex;
}

.calendar-btn {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: 500;
  line-height: 1.2;
  gap: var(--space-1);
  white-space: nowrap;
}

.calendar-btn-label {
  display: none;
}

.calendar-btn.always-show-label .calendar-btn-label {
  display: inline;
}

@container day-detail (min-width: 440px) {
  .calendar-btn {
    padding: var(--space-1) var(--space-2);
  }

  .calendar-btn-label {
    display: inline;
  }
}
</style>
