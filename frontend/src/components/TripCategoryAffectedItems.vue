<script setup lang="ts">
import { computed, hasInjectionContext } from 'vue';
import { useRouter } from 'vue-router';
import { IconArrowUpRight } from '@tabler/icons-vue';
import type { CategoryUsageItem } from '../stores/tripCategories';

const props = defineProps<{
  items: CategoryUsageItem[];
  totalCount: number;
  activeType: 'expense' | 'spot';
  categoryName: string;
  tripId: number;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'navigate'): void;
}>();

let router: ReturnType<typeof useRouter> | null = null;
if (hasInjectionContext()) {
  try {
    router = useRouter();
  } catch {
    // outside router context
  }
}

const targetRoute = computed(() => {
  if (props.activeType === 'expense') {
    return {
      name: 'budget',
      params: { tripId: String(props.tripId) },
    };
  }
  return {
    name: 'excursions',
    params: { tripId: String(props.tripId) },
    query: { category: props.categoryName },
  };
});

const targetHref = computed(() => {
  if (props.activeType === 'expense') {
    return `/trip/${props.tripId}/budget`;
  }
  return `/trip/${props.tripId}/excursions?category=${encodeURIComponent(props.categoryName)}`;
});

const linkText = computed(() => {
  if (props.activeType === 'expense') {
    return 'Im Budget anzeigen';
  }
  return 'In Spot-Übersicht anzeigen';
});

const linkTitle = computed(() => {
  if (props.activeType === 'expense') {
    return 'Ausgaben im Budget aufrufen';
  }
  return `Spots mit Kategorie „${props.categoryName}“ in der Übersicht anzeigen`;
});

function handleNavigate(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  emit('navigate');
  router?.push(targetRoute.value);
}

function formatAmount(amount: number): string {
  return (
    amount.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}
</script>

<template>
  <div class="affected-items-block">
    <div class="affected-items-header">
      <span class="affected-items-label">
        {{
          activeType === 'expense'
            ? totalCount === 1
              ? 'Betroffene Ausgabe'
              : 'Betroffene Ausgaben'
            : totalCount === 1
              ? 'Betroffener Spot'
              : 'Betroffene Spots'
        }}
        ({{ totalCount }}):
      </span>
      <span v-if="isLoading" class="affected-items-loading">Wird geladen...</span>
      <a
        v-else-if="categoryName"
        :href="targetHref"
        class="affected-items-link"
        :title="linkTitle"
        @click="handleNavigate"
      >
        <span>{{ linkText }}</span>
        <IconArrowUpRight class="link-icon" :size="14" aria-hidden="true" />
      </a>
    </div>

    <div v-if="items.length > 0" class="affected-items-list" role="list">
      <div v-for="item in items" :key="item.id" class="affected-item-row" role="listitem">
        <span class="affected-item-title">{{ item.title }}</span>
        <span v-if="item.subtitle" class="affected-item-meta">{{ item.subtitle }}</span>
        <span v-else-if="item.amount != null" class="affected-item-meta">
          {{ formatAmount(item.amount) }}
        </span>
      </div>
    </div>

    <div
      v-if="totalCount > items.length && !isLoading && items.length > 0"
      class="affected-items-more"
    >
      + {{ totalCount - items.length }} weitere
      <template v-if="categoryName">
        —
        <a
          :href="targetHref"
          class="affected-items-link inline-link"
          :title="linkTitle"
          @click="handleNavigate"
        >
          alle in der Übersicht ansehen
        </a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.affected-items-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.affected-items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.affected-items-label {
  white-space: nowrap;
}

.affected-items-loading {
  font-style: italic;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.affected-items-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
  transition:
    color 0.15s ease,
    opacity 0.15s ease;
}

.affected-items-link:hover,
.affected-items-link:focus-visible {
  color: var(--color-primary-hover, var(--color-primary));
  text-decoration: underline;
}

.affected-items-link.inline-link {
  display: inline;
}

.link-icon {
  flex-shrink: 0;
}

.affected-items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 180px;
  overflow-y: auto;
  padding-right: 2px;
}

.affected-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}

.affected-item-title {
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.affected-item-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.affected-items-more {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  padding-top: var(--space-1);
}

@media (max-width: 480px) {
  .affected-items-header {
    flex-wrap: wrap;
  }
  .affected-item-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}
</style>
