<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, type ComponentPublicInstance } from 'vue';
import Button from './primitives/Button.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import AppIcon from './AppIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { computePopoverPosition } from '../utils/popoverPosition';

export interface TourItem {
  id: number;
  title: string;
  assigned: boolean;
}

const DEFAULT_MENU_WIDTH = 240;
const DEFAULT_MENU_HEIGHT = 220;
const MENU_OFFSET = 4;
const TRIGGER_ICON_SIZE = 15;

// Schnelle Zuordnung von Spots oder Tracks zu Touren über ein Popover-Menü
// (SpotFormModal.vue, TrackEditModal.vue).
withDefaults(
  defineProps<{
    tours: TourItem[];
    compact?: boolean;
  }>(),
  {
    compact: false,
  }
);

const emit = defineEmits<{
  (e: 'toggle-tour', excursionId: number): void;
  (e: 'create-tour', title: string): void;
}>();

const open = ref(false);
const newTourTitle = ref('');
const buttonRef = ref<ComponentPublicInstance | HTMLElement | null>(null);
const popupRef = ref<InstanceType<typeof PickerMenu> | null>(null);
const popupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

function resolveTriggerEl(event?: MouseEvent): HTMLElement | null {
  return (
    (buttonRef.value as ComponentPublicInstance | null)?.$el ??
    (buttonRef.value as HTMLElement | null) ??
    (event?.currentTarget as HTMLElement | undefined) ??
    null
  );
}

function close() {
  open.value = false;
}

async function toggle(event?: MouseEvent) {
  if (open.value) {
    close();
    return;
  }

  const triggerEl = resolveTriggerEl(event);

  if (!triggerEl) {
    return;
  }

  popupStyle.value = computePopoverPosition(triggerEl, {
    menuWidth: DEFAULT_MENU_WIDTH,
    menuHeight: DEFAULT_MENU_HEIGHT,
    offset: MENU_OFFSET,
  });
  open.value = true;

  await nextTick();

  const menuEl = popupRef.value?.el;

  if (menuEl && triggerEl) {
    const rect = menuEl.getBoundingClientRect();
    popupStyle.value = computePopoverPosition(triggerEl, {
      menuWidth: rect.width,
      menuHeight: rect.height,
      offset: MENU_OFFSET,
    });
  }
}

function handleToggle(id: number) {
  emit('toggle-tour', id);
}

function handleCreate() {
  const title = newTourTitle.value.trim();

  if (!title) {
    return;
  }

  emit('create-tour', title);
  newTourTitle.value = '';
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  event.stopPropagation();
  event.stopImmediatePropagation();
  close();
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', close, { passive: true });
    window.addEventListener('keydown', onWindowKeydown, true);
  } else {
    window.removeEventListener('resize', close);
    window.removeEventListener('keydown', onWindowKeydown, true);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', close);
  window.removeEventListener('keydown', onWindowKeydown, true);
});
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <div class="tour-assign-dropdown" @click.stop>
    <Button
      ref="buttonRef"
      variant="secondary"
      size="sm"
      :active="open"
      :icon-only="compact"
      class="tour-assign-btn"
      :class="{ 'is-open': open, 'is-compact': compact }"
      :aria-expanded="open"
      title="Tour zuordnen"
      aria-label="Tour zuordnen"
      @click="toggle($event)"
    >
      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="TRIGGER_ICON_SIZE" group="navigation" />
      <span v-if="!compact" class="tour-assign-label">Tour zuordnen</span>
    </Button>
    <Teleport to="body">
      <PickerMenu
        v-if="open"
        ref="popupRef"
        origin="top-left"
        class="tour-assign-popup"
        :style="popupStyle"
        @close="close"
      >
        <div class="popup-head">
          <span class="popup-title">Touren zuordnen</span>
        </div>
        <div class="tour-list">
          <p v-if="!tours.length" class="empty">Noch keine Touren angelegt</p>
          <DropdownMenuItem
            v-for="tour in tours"
            :key="tour.id"
            multiselect
            :checked="tour.assigned"
            :active="tour.assigned"
            :label="tour.title"
            class="tour-item"
            :class="{ selected: tour.assigned }"
            @update:checked="handleToggle(tour.id)"
          />
        </div>
        <form class="create-tour-form" @submit.prevent="handleCreate">
          <Input
            v-model="newTourTitle"
            type="text"
            size="sm"
            class="create-tour-input"
            placeholder="Neue Tour…"
            aria-label="Neue Tour erstellen"
            @click.stop
          />
          <IconButton
            type="submit"
            variant="primary"
            size="sm"
            :icon="ACTION_ICONS.mapPlus"
            class="create-btn"
            :disabled="!newTourTitle.trim()"
            title="Neue Tour erstellen & Spot zuordnen"
            aria-label="Neue Tour erstellen"
            @click.stop
          />
        </form>
      </PickerMenu>
    </Teleport>
  </div>
</template>

<style scoped>
.tour-assign-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  max-width: 100%;
}

.tour-assign-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tour-assign-popup {
  min-width: 220px;
  max-width: min(280px, calc(100vw - 24px));
}

.popup-head {
  padding: 2px 6px 6px;
  border-bottom: 1px solid var(--color-border);
}

.popup-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tour-list {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  padding: 6px 4px;
  cursor: default;
}

.create-tour-form {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}

.create-tour-input {
  flex: 1;
  min-width: 0;
}
</style>
