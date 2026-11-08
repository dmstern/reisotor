<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import Checkbox from './primitives/Checkbox.vue';
import AppIcon from './AppIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { computePopoverPosition } from '../utils/popoverPosition';

export interface TourItem {
  id: number;
  title: string;
  assigned: boolean;
}

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
const buttonRef = ref<HTMLButtonElement | null>(null);
const popupRef = ref<HTMLElement | null>(null);
const popupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

function close() {
  open.value = false;
}

async function toggle(event?: MouseEvent) {
  if (open.value) {
    close();
    return;
  }

  const triggerEl = buttonRef.value ?? (event?.currentTarget as HTMLElement | undefined) ?? null;

  if (!triggerEl) {
    return;
  }

  popupStyle.value = computePopoverPosition(triggerEl, {
    menuWidth: 240,
    menuHeight: 220,
    offset: 4,
  });
  open.value = true;

  await nextTick();

  if (popupRef.value && triggerEl) {
    const rect = popupRef.value.getBoundingClientRect();
    popupStyle.value = computePopoverPosition(triggerEl, {
      menuWidth: rect.width,
      menuHeight: rect.height,
      offset: 4,
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
    <button
      ref="buttonRef"
      type="button"
      class="tour-assign-btn"
      :class="{ 'is-open': open, 'is-compact': compact }"
      :aria-expanded="open"
      title="Tour zuordnen"
      aria-label="Tour zuordnen"
      @click="toggle($event)"
    >
      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="15" group="navigation" />
      <span class="tour-assign-label">Tour zuordnen</span>
    </button>
    <Teleport to="body">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <Transition name="fade">
        <div
          v-if="open"
          class="options-backdrop tour-assign-backdrop"
          role="button"
          tabindex="0"
          aria-label="Menü schließen"
          @click="close"
          @keydown.enter.prevent="close"
          @keydown.space.prevent="close"
        />
      </Transition>
      <Transition name="dropdown-unfold">
        <div
          v-if="open"
          ref="popupRef"
          class="options-popup tour-assign-popup"
          :style="popupStyle"
          @click.stop
        >
          <div class="popup-head">
            <span class="popup-title">Touren zuordnen</span>
          </div>
          <ul class="tour-list">
            <li v-if="!tours.length" class="empty">Noch keine Touren angelegt</li>
            <li
              v-for="tour in tours"
              :key="tour.id"
              class="tour-item"
              :class="{ selected: tour.assigned }"
            >
              <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
              <label class="tour-item-label">
                <Checkbox :checked="tour.assigned" @change="handleToggle(tour.id)" />
                <span class="tour-name">{{ tour.title }}</span>
              </label>
            </li>
          </ul>
          <form class="create-tour-form" @submit.prevent="handleCreate">
            <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
            <input
              v-model="newTourTitle"
              type="text"
              class="create-tour-input"
              placeholder="Neue Tour…"
              @click.stop
            />
            <button
              type="submit"
              class="create-btn"
              :disabled="!newTourTitle.trim()"
              title="Neue Tour erstellen & Spot zuordnen"
              aria-label="Neue Tour erstellen"
              @click.stop
            >
              <AppIcon :icon="ACTION_ICONS.mapPlus" :size="13" group="actions" />
            </button>
          </form>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.tour-assign-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.tour-assign-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 0 12px;
  height: 34px;
  min-height: 34px;
  font-size: var(--font-size-sm);
  line-height: 1.2;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  touch-action: auto;
  box-sizing: border-box;
  margin: 0;
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.2s ease;
}

.tour-assign-btn.is-compact {
  padding: 0;
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.tour-assign-btn.is-compact .tour-assign-label {
  display: none;
}

.tour-assign-label {
  display: inline;
}

.tour-assign-btn:active {
  transform: scale(0.97) translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.tour-assign-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-tour));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.tour-assign-btn :deep(.app-icon) {
  flex-shrink: 0;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: center bottom;
}

.tour-assign-btn:hover,
.tour-assign-btn.is-open {
  background: var(--color-tour-tint);
  border-color: var(--color-tour-border);
  color: var(--color-tour);
  transform: translateY(-1.5px);
  box-shadow:
    0 4px 12px -2px color-mix(in srgb, var(--color-tour) 22%, transparent),
    0 2px 4px rgba(0, 0, 0, 0.06);
}

.tour-assign-btn:hover :deep(.app-icon) {
  transform: translateY(-0.5px) rotate(-8deg) scale(1.15);
}

.options-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover, 1100);
  background: transparent;
}

.options-popup {
  position: fixed;
  z-index: calc(var(--z-popover, 1100) + 1);
  min-width: 200px;
  max-width: 280px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  transform-origin: top left;
}

.popup-head {
  padding: 2px 4px 4px;
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
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tour-item {
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.tour-item-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 5px 6px;
  font-size: 0.85rem;
  cursor: pointer;
  width: 100%;
}

.tour-item:hover {
  background: var(--color-hover);
}

.tour-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  padding: 6px 4px;
  cursor: default;
}

.create-tour-form {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--color-border);
}

.create-tour-input {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-bg);
}

.create-tour-input:focus,
.create-tour-input:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  flex-shrink: 0;
}

.create-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
