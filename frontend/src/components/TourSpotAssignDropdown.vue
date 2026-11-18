<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import type { Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import { computePopoverPosition } from '../utils/popoverPosition';

const DEFAULT_MENU_WIDTH = 260;
const DEFAULT_MENU_HEIGHT = 280;
const MENU_OFFSET = 6;

const props = withDefaults(
  defineProps<{
    spots: Spot[];
    likeCount: (spotId: number) => number;
    compact?: boolean;
  }>(),
  {
    compact: false,
  }
);

const emit = defineEmits<{
  (e: 'select-spot', spotId: number): void;
  (e: 'create-spot'): void;
}>();

const open = ref(false);
const buttonRef = ref<HTMLButtonElement | null>(null);
const popupRef = ref<HTMLElement | null>(null);
const popupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

const sortedSpots = computed(() => {
  return [...props.spots].sort(
    (a, b) => props.likeCount(b.id) - props.likeCount(a.id) || a.title.localeCompare(b.title)
  );
});

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
    menuWidth: DEFAULT_MENU_WIDTH,
    menuHeight: DEFAULT_MENU_HEIGHT,
    offset: MENU_OFFSET,
  });
  open.value = true;

  await nextTick();

  if (popupRef.value && triggerEl) {
    const rect = popupRef.value.getBoundingClientRect();
    popupStyle.value = computePopoverPosition(triggerEl, {
      menuWidth: rect.width,
      menuHeight: rect.height,
      offset: MENU_OFFSET,
    });
  }
}

function handleSelectSpot(spotId: number) {
  emit('select-spot', spotId);
  close();
}

function handleCreateSpot() {
  emit('create-spot');
  close();
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
  <div class="tour-spot-assign-dropdown" @click.stop>
    <button
      ref="buttonRef"
      type="button"
      class="tour-add-spot-btn tour-add-spot-trigger"
      :class="{ 'is-open': open, 'is-compact': compact }"
      :aria-expanded="open"
      title="Spot zur Tour hinzufügen"
      aria-label="Spot hinzufügen"
      @click="toggle($event)"
    >
      <AppIcon :icon="ACTION_ICONS.mapPinPlus" :size="14" group="actions" />
      <span class="tour-add-spot-label">Spot hinzufügen</span>
    </button>

    <Teleport to="body">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <Transition name="fade">
        <div
          v-if="open"
          class="options-backdrop tour-spot-assign-backdrop"
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
          class="options-popup tour-spot-assign-popup"
          :style="popupStyle"
          @click.stop
        >
          <div class="popup-head">
            <span class="popup-title">Spot hinzufügen</span>
          </div>

          <ul class="spot-assign-list">
            <li v-if="!sortedSpots.length" class="spot-assign-empty">Noch keine Spots angelegt</li>
            <li v-for="spot in sortedSpots" :key="spot.id" class="spot-assign-item">
              <button type="button" class="spot-assign-option" @click="handleSelectSpot(spot.id)">
                <AppIcon
                  :icon="spotCategoryMeta(spot.category).tabler"
                  :size="14"
                  group="categories"
                />
                <span class="spot-assign-name">{{ spot.title }}</span>
                <span class="spot-assign-likes">
                  <AppIcon :icon="ACTION_ICONS.sortLikes" :size="12" group="actions" />
                  {{ likeCount(spot.id) }}
                </span>
                <span class="spot-assign-plus" aria-hidden="true">+</span>
              </button>
            </li>
          </ul>

          <div class="create-spot-footer">
            <button type="button" class="create-spot-btn" @click="handleCreateSpot">
              <AppIcon :icon="ACTION_ICONS.mapPinPlus" :size="14" group="actions" />
              <span>Neuen Spot erstellen</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.tour-spot-assign-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  max-width: 100%;
}

.tour-add-spot-btn {
  @include touch-target($expand: true);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px dashed var(--tour-theme-border, var(--color-border));
  background: var(--color-surface);
  color: var(--color-text-muted);
  padding: 6px var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: 600;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  outline: none;
  margin: 0;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

@include can-hover {
  .tour-add-spot-btn:hover {
    background: var(--tour-theme-tint, var(--color-tour-tint));
    border-color: var(--tour-theme-color, var(--color-tour));
    color: var(--tour-theme-color, var(--color-tour));
    transform: translateY(-1.5px);
    box-shadow: var(--shadow-sm);
  }
}

.tour-add-spot-btn.is-open {
  background: var(--tour-theme-tint, var(--color-tour-tint));
  border-color: var(--tour-theme-color, var(--color-tour));
  color: var(--tour-theme-color, var(--color-tour));
  transform: translateY(-1.5px);
  box-shadow: var(--shadow-sm);
}

.tour-add-spot-btn:focus-visible {
  background: var(--tour-theme-tint, var(--color-tour-tint));
  border-color: var(--tour-theme-color, var(--color-tour));
  color: var(--tour-theme-color, var(--color-tour));
  transform: translateY(-1.5px);
  box-shadow: var(--shadow-sm);
  outline: var(--focus-ring-width, 3px) solid
    var(--focus-ring-color, var(--tour-theme-color, var(--color-tour)));
  outline-offset: var(--focus-ring-offset, 2px);
}

.tour-add-spot-btn.is-compact {
  padding: 0;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.tour-add-spot-btn.is-compact .tour-add-spot-label {
  display: none;
}

.tour-add-spot-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  min-width: 220px;
  max-width: min(300px, calc(100vw - 24px));
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
  padding: 2px 4px 6px;
  border-bottom: 1px solid var(--color-border);
}

.popup-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.spot-assign-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spot-assign-item {
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.spot-assign-option {
  @include min-touch-target(44px);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: 6px 8px;
  font-size: 0.85rem;
  background: none;
  border: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  color: var(--color-text);
  text-align: left;
  box-shadow: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

@include can-hover {
  .spot-assign-option:hover {
    background: var(--tour-theme-tint, var(--color-hover));
    color: var(--tour-theme-color, var(--color-primary-dark));
  }
}

.spot-assign-option:focus-visible {
  background: var(--tour-theme-tint, var(--color-hover));
  color: var(--tour-theme-color, var(--color-primary-dark));
  outline: var(--focus-ring-width, 3px) solid
    var(--focus-ring-color, var(--tour-theme-color, var(--color-tour)));
  outline-offset: var(--focus-ring-offset, 2px);
}

.spot-assign-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-assign-likes {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.spot-assign-plus {
  color: var(--tour-theme-color, var(--color-primary));
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1;
  flex-shrink: 0;
}

.spot-assign-empty {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  padding: 8px 6px;
  cursor: default;
}

.create-spot-footer {
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}

.create-spot-btn {
  @include min-touch-target(44px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: none;
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

@include can-hover {
  .create-spot-btn:hover {
    background: var(--tour-theme-tint, var(--color-primary-tint));
    color: var(--tour-theme-color, var(--color-primary-dark));
  }
}

.create-spot-btn:focus-visible {
  background: var(--tour-theme-tint, var(--color-primary-tint));
  color: var(--tour-theme-color, var(--color-primary-dark));
  outline: var(--focus-ring-width, 3px) solid
    var(--focus-ring-color, var(--tour-theme-color, var(--color-tour)));
  outline-offset: var(--focus-ring-offset, 2px);
}

@media (prefers-reduced-motion: reduce) {
  .tour-add-spot-btn,
  .spot-assign-item,
  .spot-assign-option,
  .create-spot-btn {
    transition: none;
    transform: none;
  }
}
</style>
