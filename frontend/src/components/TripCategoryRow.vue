<script setup lang="ts">
import { computed } from 'vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import EditButton from './EditButton.vue';
import CategoryChip from './CategoryChip.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

export interface DisplayCategory {
  id?: number;
  name: string;
  defaultName?: string | null;
  isCustom: boolean;
  isAdapted?: boolean;
  isHidden: boolean;
  icon?: string | null;
  emoji?: string | null;
  color?: string | null;
  usageCount: number;
}

const props = defineProps<{
  category: DisplayCategory;
  activeType: 'expense' | 'spot';
  reserveResetSlot?: boolean;
}>();

defineEmits<{
  (e: 'edit', category: DisplayCategory): void;
  (e: 'reset', category: DisplayCategory): void;
  (e: 'toggle-hide', category: DisplayCategory): void;
}>();

const usageLabel = computed(() => {
  if (props.activeType === 'expense') {
    return props.category.usageCount === 1 ? 'Ausgabe' : 'Ausgaben';
  }

  return props.category.usageCount === 1 ? 'Spot' : 'Spots';
});
</script>

<template>
  <div
    class="category-row"
    :class="{
      'is-hidden': category.isHidden,
    }"
  >
    <div class="category-main">
      <CategoryChip :category="category.name" :type="activeType" />

      <div class="category-meta">
        <Badge v-if="category.isCustom" variant="primary">Urlaub</Badge>
        <Badge v-else-if="category.isAdapted" variant="accent">Standard (angepasst)</Badge>
        <Badge v-else variant="default">Standard</Badge>

        <span class="usage-count" :class="{ 'has-usage': category.usageCount > 0 }">
          {{ category.usageCount }} {{ usageLabel }}
        </span>
      </div>
    </div>

    <div class="row-actions">
      <!-- Standardkategorie auf Standard zurücksetzen -->
      <Button
        v-if="category.isAdapted"
        type="button"
        variant="ghost"
        size="sm"
        class="reset-btn"
        :icon="ACTION_ICONS.restore"
        title="Auf Standard zurücksetzen"
        aria-label="Auf Standard zurücksetzen"
        @click="$emit('reset', category)"
      >
        Zurücksetzen
      </Button>
      <span v-else-if="reserveResetSlot" class="reset-btn-placeholder" aria-hidden="true" />

      <!-- Bearbeiten (Pencil) -->
      <EditButton
        small
        title="Kategorie bearbeiten"
        aria-label="Kategorie bearbeiten"
        @click="$emit('edit', category)"
      />

      <!-- Standardkategorie ausblenden / einblenden -->
      <Button
        v-if="!category.isCustom"
        type="button"
        variant="ghost"
        size="sm"
        class="hide-btn"
        :icon="category.isHidden ? ACTION_ICONS.show : ACTION_ICONS.hide"
        @click="$emit('toggle-hide', category)"
      >
        {{ category.isHidden ? 'Einblenden' : 'Ausblenden' }}
      </Button>
      <span v-else class="hide-btn-placeholder" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-1);
  gap: var(--space-3);
  @include divider-engraved-row;
}

.category-row.is-hidden {
  opacity: 0.55;
  filter: grayscale(0.4);
}

.category-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.category-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  flex-shrink: 0;
}

.usage-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  min-width: 80px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.usage-count.has-usage {
  color: var(--color-text);
  font-weight: 500;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.reset-btn,
.hide-btn {
  font-size: var(--font-size-xs);
  padding: var(--space-1) var(--space-2);
  justify-content: flex-start;
  white-space: nowrap;
}

.reset-btn,
.reset-btn-placeholder {
  width: 116px;
  flex-shrink: 0;
}

.hide-btn,
.hide-btn-placeholder {
  width: 112px;
  flex-shrink: 0;
}

.reset-btn-placeholder,
.hide-btn-placeholder {
  display: inline-block;
  height: 1px;
  pointer-events: none;
}

@include container-down('tablet-sm') {
  .category-row {
    flex-direction: column;
    align-items: stretch;
  }

  .usage-count {
    min-width: auto;
  }

  .row-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
    padding-top: var(--space-1);
  }

  .reset-btn,
  .hide-btn {
    width: auto;
  }

  .reset-btn-placeholder,
  .hide-btn-placeholder {
    display: none;
  }
}
</style>
