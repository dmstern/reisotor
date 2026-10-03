<script setup lang="ts">
import { computed } from 'vue';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import EditButton from './EditButton.vue';
import CategoryChip from './CategoryChip.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

export interface DisplayCategory {
  id?: number;
  name: string;
  isCustom: boolean;
  isHidden: boolean;
  icon?: string | null;
  emoji?: string | null;
  color?: string | null;
  usageCount: number;
}

const props = defineProps<{
  category: DisplayCategory;
  activeType: 'expense' | 'spot';
}>();

defineEmits<{
  (e: 'edit', category: DisplayCategory): void;
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
  <Card
    class="category-row"
    :class="{
      'is-hidden': category.isHidden,
    }"
  >
    <div class="category-main">
      <CategoryChip :category="category.name" :type="activeType" />

      <Badge v-if="category.isCustom" variant="primary">Urlaub</Badge>
      <Badge v-else variant="default">Standard</Badge>

      <span class="usage-count" :class="{ 'has-usage': category.usageCount > 0 }">
        {{ category.usageCount }} {{ usageLabel }}
      </span>
    </div>

    <div class="row-actions">
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
    </div>
  </Card>
</template>

<style scoped>
.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  gap: var(--space-2);
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

.usage-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
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

.hide-btn {
  font-size: var(--font-size-xs);
  padding: var(--space-1) var(--space-2);
}
</style>
