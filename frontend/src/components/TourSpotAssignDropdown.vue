<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue';
import type { Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import { computePopoverPosition } from '../utils/popoverPosition';

const DEFAULT_MENU_WIDTH = 380;
const DEFAULT_MENU_HEIGHT = 320;
const MENU_OFFSET = 6;
const TRIGGER_ICON_SIZE = 14;
const SEARCH_THRESHOLD = 8;

const props = withDefaults(
  defineProps<{
    spots: Spot[];
    selectedSpotIds?: number[];
    compact?: boolean;
    closeOnSelect?: boolean;
  }>(),
  {
    selectedSpotIds: () => [],
    compact: false,
    closeOnSelect: true,
  }
);

const emit = defineEmits<{
  (e: 'select-spot', spotId: number): void;
  (e: 'create-spot'): void;
}>();

const open = ref(false);
const searchQuery = ref('');
const buttonRef = ref<ComponentPublicInstance | HTMLElement | null>(null);
const popupRef = ref<InstanceType<typeof PickerMenu> | null>(null);
const popupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

const spotUsageCounts = computed(() => {
  const counts = new Map<number, number>();

  for (const spotId of props.selectedSpotIds) {
    counts.set(spotId, (counts.get(spotId) ?? 0) + 1);
  }

  return counts;
});

const sortedSpots = computed(() => {
  return [...props.spots].sort((spotA, spotB) =>
    spotA.title.localeCompare(spotB.title, 'de', { sensitivity: 'base' })
  );
});

const filteredSpots = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();

  if (!query) {
    return sortedSpots.value;
  }

  return sortedSpots.value.filter((spot) => spot.title.toLocaleLowerCase().includes(query));
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
  searchQuery.value = '';
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

  if (props.closeOnSelect) {
    close();
  }
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

        <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
        <div v-if="spots.length >= SEARCH_THRESHOLD" class="popup-search" @click.stop>
          <Input
            v-model="searchQuery"
            type="search"
            size="sm"
            shape="pill"
            placeholder="Spots filtern..."
            aria-label="Spots filtern"
            class="spot-assign-search"
          />
        </div>

        <div class="spot-assign-list">
          <p v-if="!spots.length" class="spot-assign-empty">Noch keine Spots angelegt</p>
          <p v-else-if="!filteredSpots.length" class="spot-assign-empty">
            Keine passenden Spots gefunden.
          </p>
          <DropdownMenuItem
            v-for="spot in filteredSpots"
            :key="spot.id"
            :icon="spotCategoryMeta(spot.category).tabler"
            icon-group="categories"
            :icon-size="TRIGGER_ICON_SIZE"
            :active="(spotUsageCounts.get(spot.id) ?? 0) > 0"
            class="spot-assign-option"
            @click="handleSelectSpot(spot.id)"
          >
            {{ spot.title }}
            <template #trailing>
              <span class="spot-assign-trailing">
                <Badge
                  v-if="spotUsageCounts.get(spot.id)"
                  variant="primary"
                  size="sm"
                  class="spot-usage-badge"
                >
                  {{ spotUsageCounts.get(spot.id) }}×
                </Badge>
                <AppIcon
                  :icon="ACTION_ICONS.add"
                  :size="TRIGGER_ICON_SIZE"
                  group="actions"
                  class="spot-assign-plus"
                  aria-hidden="true"
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

:global(.tour-spot-assign-popup) {
  width: min(380px, calc(100vw - 24px));
  min-width: min(320px, calc(100vw - 24px));
  max-width: min(420px, calc(100vw - 24px));
}

.popup-head {
  padding: var(--space-2xs) var(--space-1-5) var(--space-1-5);
  @include divider-engraved('bottom');
}

.popup-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.popup-search {
  padding: var(--space-xs) 0 var(--space-2xs);
}

.spot-assign-search {
  width: 100%;
}

.spot-assign-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.spot-assign-trailing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  margin-left: auto;
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
  padding: var(--space-sm) var(--space-1-5);
  cursor: default;
}

.create-spot-footer {
  margin-top: var(--space-xs);
  padding-top: var(--space-1-5);
  @include divider-engraved('top');
}

.create-spot-btn {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
