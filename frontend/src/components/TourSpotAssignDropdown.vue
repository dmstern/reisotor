<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue';
import type { Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import { computePopoverPosition } from '../utils/popoverPosition';

const DEFAULT_MENU_WIDTH = 260;
const DEFAULT_MENU_HEIGHT = 280;
const MENU_OFFSET = 6;
const TRIGGER_ICON_SIZE = 14;
const LIKE_ICON_SIZE = 12;

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
const buttonRef = ref<ComponentPublicInstance | HTMLElement | null>(null);
const popupRef = ref<InstanceType<typeof PickerMenu> | null>(null);
const popupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

const sortedSpots = computed(() => {
  return [...props.spots].sort(
    (spotA, spotB) =>
      props.likeCount(spotB.id) - props.likeCount(spotA.id) ||
      spotA.title.localeCompare(spotB.title)
  );
});

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
    <Button
      ref="buttonRef"
      variant="secondary"
      dashed
      size="sm"
      :active="open"
      :icon="compact ? ACTION_ICONS.mapPinPlus : undefined"
      :icon-only="compact"
      class="tour-add-spot-btn tour-add-spot-trigger"
      :class="{ 'is-open': open, 'is-compact': compact }"
      :aria-expanded="open"
      title="Spot zur Tour hinzufügen"
      aria-label="Spot hinzufügen"
      @click="toggle($event)"
    >
      <template v-if="!compact">
        <AppIcon :icon="ACTION_ICONS.mapPinPlus" :size="TRIGGER_ICON_SIZE" group="actions" />
        <span class="tour-add-spot-label">Spot hinzufügen</span>
      </template>
    </Button>

    <Teleport to="body">
      <PickerMenu
        v-if="open"
        ref="popupRef"
        origin="top-left"
        class="tour-spot-assign-popup"
        :style="popupStyle"
        @close="close"
      >
        <div class="popup-head">
          <span class="popup-title">Spot hinzufügen</span>
        </div>

        <div class="spot-assign-list">
          <p v-if="!sortedSpots.length" class="spot-assign-empty">Noch keine Spots angelegt</p>
          <DropdownMenuItem
            v-for="spot in sortedSpots"
            :key="spot.id"
            :icon="spotCategoryMeta(spot.category).tabler"
            icon-group="categories"
            :icon-size="TRIGGER_ICON_SIZE"
            class="spot-assign-option"
            @click="handleSelectSpot(spot.id)"
          >
            {{ spot.title }}
            <template #trailing>
              <span class="spot-assign-trailing">
                <span class="spot-assign-likes">
                  <AppIcon :icon="ACTION_ICONS.sortLikes" :size="LIKE_ICON_SIZE" group="actions" />
                  {{ likeCount(spot.id) }}
                </span>
                <AppIcon
                  :icon="ACTION_ICONS.add"
                  :size="TRIGGER_ICON_SIZE"
                  group="actions"
                  class="spot-assign-plus"
                />
              </span>
            </template>
          </DropdownMenuItem>
        </div>

        <div class="create-spot-footer">
          <DropdownMenuItem
            :icon="ACTION_ICONS.mapPinPlus"
            :icon-size="TRIGGER_ICON_SIZE"
            label="Neuen Spot erstellen"
            class="create-spot-btn"
            @click="handleCreateSpot"
          />
        </div>
      </PickerMenu>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.tour-spot-assign-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  line-height: var(--line-height-none);
  max-width: 100%;
}

.tour-add-spot-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tour-spot-assign-popup {
  min-width: 230px;
  max-width: min(300px, calc(100vw - 24px));
}

.popup-head {
  padding: 2px 6px 6px;
  @include divider-engraved('bottom');
}

.popup-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.spot-assign-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spot-assign-trailing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  flex-shrink: 0;
}

.spot-assign-likes {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.spot-assign-plus {
  color: var(--color-primary);
  flex-shrink: 0;
}

.spot-assign-empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  padding: 8px 6px;
  cursor: default;
}

.create-spot-footer {
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  @include divider-engraved('top');
}

.create-spot-btn {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
