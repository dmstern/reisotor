<script setup lang="ts">
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';
import PolaroidStack from './primitives/PolaroidStack.vue';
import AppIcon from './AppIcon.vue';
import FileAttachments from './FileAttachments.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { travelTypeIconDef } from '../utils/travelTypeIcon';

defineProps<{
  excursion: Excursion;
  resolvedStations: ExcursionStation[];
}>();
</script>

<template>
  <div class="tour-visual-col">
    <PolaroidStack
      v-if="resolvedStations.length"
      class="tour-polaroid-stack"
      :items="resolvedStations"
      :expanded="false"
      :interactive="false"
      :title="`${resolvedStations.length} Stationen`"
      aria-hidden="true"
    />
    <div v-else class="tour-placeholder">
      <AppIcon
        class="placeholder"
        :size="26"
        :icon="
          excursion.role
            ? travelTypeIconDef(excursion.transport_type)
            : SECTION_ICON_DEFS.excursions
        "
        group="categories"
      />
    </div>

    <!-- Floating Paperclip Badge im eingeklappten Zustand (#396 Pattern) -->
    <div class="tour-collapsed-attachments">
      <FileAttachments domain="ideas" :entity-id="excursion.id" :editable="false" collapsed />
    </div>
  </div>
</template>

<style scoped>
.tour-visual-col {
  width: 68px;
  min-width: 68px;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  align-self: flex-start;
  overflow: visible;
  padding: 2px 0 0 0;
}

.tour-placeholder {
  width: 54px;
  height: 64px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tour-placeholder .placeholder {
  font-size: 1.75rem;
  color: var(--excursion-theme-color, var(--color-tour));
  opacity: 0.7;
}

.tour-collapsed-attachments {
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: 6;
}

.tour-collapsed-attachments :deep(.file-attachments) {
  margin-top: 0;
}

:deep(.tour-polaroid-stack) {
  width: 54px;
  height: 64px;
}

:deep(.tour-polaroid-stack .polaroid-tile) {
  width: 48px;
  height: 58px;
  padding: 2px 2px 8px 2px;
}

:deep(.tour-polaroid-stack .polaroid-photo-frame) {
  height: 38px;
}

:deep(.tour-polaroid-stack .polaroid-chin) {
  height: 10px;
}

:deep(.tour-polaroid-stack .polaroid-caption) {
  font-size: 0.42rem;
}

@container spots-col (max-width: 360px) {
  .tour-visual-col {
    width: 52px;
    min-width: 52px;
  }

  .tour-placeholder {
    width: 42px;
    height: 52px;
  }

  .tour-placeholder .placeholder {
    font-size: 1.25rem;
  }

  :deep(.tour-polaroid-stack) {
    width: 42px;
    height: 52px;
  }

  :deep(.tour-polaroid-stack .polaroid-tile) {
    width: 38px;
    height: 48px;
    padding: 2px 2px 6px 2px;
  }

  :deep(.tour-polaroid-stack .polaroid-photo-frame) {
    height: 30px;
  }

  :deep(.tour-polaroid-stack .polaroid-chin) {
    height: 8px;
  }

  :deep(.tour-polaroid-stack .polaroid-caption) {
    font-size: 0.38rem;
  }
}
</style>
