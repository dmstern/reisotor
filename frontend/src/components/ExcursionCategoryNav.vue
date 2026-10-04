<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import type { Excursion } from '../api/types';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

export interface SpotGroupNavOption {
  category: string;
  iconDef: IconDef;
  excursion: Excursion | null;
}

defineProps<{
  spotGroups: SpotGroupNavOption[];
  activeCategory: string | null;
  isStuck: boolean;
  underlineLeft: number;
  underlineWidth: number;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  groupIconColor?: (grp: SpotGroupNavOption) => string | undefined;
  setSentinelRef?: (el: Element | ComponentPublicInstance | null) => void;
  setNavRef?: (el: Element | ComponentPublicInstance | null) => void;
  setNavItemRef?: (cat: string, el: Element | ComponentPublicInstance | null) => void;
}>();

const emit = defineEmits<{
  (e: 'selectCategory', category: string): void;
  (e: 'scrollNav', direction: 1 | -1): void;
  (e: 'updateNavArrows'): void;
}>();
</script>

<template>
  <div v-if="spotGroups.length > 1" class="category-nav-sentinel" :ref="setSentinelRef"></div>
  <div v-if="spotGroups.length > 1" class="category-nav-wrap" :class="{ 'is-stuck': isStuck }">
    <nav
      class="category-nav"
      aria-label="Zu Kategorie springen"
      :ref="setNavRef"
      @scroll="emit('updateNavArrows')"
    >
      <div class="category-nav-track">
        <button
          v-for="grp in spotGroups"
          :key="grp.category"
          type="button"
          class="category-nav-item"
          :class="{ active: activeCategory === grp.category }"
          :aria-current="activeCategory === grp.category ? 'true' : undefined"
          :ref="(el) => setNavItemRef?.(grp.category, el)"
          @click="emit('selectCategory', grp.category)"
        >
          <AppIcon
            class="category-nav-icon"
            :icon="grp.iconDef"
            group="categories"
            :active="activeCategory === grp.category"
            :color="groupIconColor ? groupIconColor(grp) : undefined"
          />
          <span class="category-nav-label">{{ grp.category }}</span>
        </button>
        <span
          class="category-nav-underline"
          :style="{
            transform: `translateX(${underlineLeft}px)`,
            width: `${underlineWidth}px`,
          }"
          aria-hidden="true"
        ></span>
      </div>
    </nav>
    <button
      v-if="canScrollLeft"
      type="button"
      class="category-nav-arrow left"
      aria-label="Kategorien nach links scrollen"
      @click="emit('scrollNav', -1)"
    >
      <AppIcon :icon="ACTION_ICONS.scrollLeft" :size="16" group="actions" />
    </button>
    <button
      v-if="canScrollRight"
      type="button"
      class="category-nav-arrow right"
      aria-label="Kategorien nach rechts scrollen"
      @click="emit('scrollNav', 1)"
    >
      <AppIcon :icon="ACTION_ICONS.scrollRight" :size="16" group="actions" />
    </button>
  </div>
</template>

<style scoped>
/* Zero-height Sentinel direkt vor .category-nav, per IntersectionObserver beobachtet */
.category-nav-sentinel {
  height: 0;
}

.category-nav-wrap {
  position: sticky;
  top: -1px;
  padding-top: 1px;
  z-index: 10;
  margin-bottom: var(--space-3);
  margin-left: calc(var(--space-3) * -1);
  margin-right: calc(var(--space-3) * -1);
  padding-left: var(--space-3);
  padding-right: var(--space-3);
  --category-nav-bg: var(--color-surface);
  background: var(--category-nav-bg);
  border-bottom: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease;
}

.category-nav-wrap.is-stuck {
  box-shadow:
    0 calc(var(--space-3) * -1) 0 0 var(--category-nav-bg),
    var(--shadow-sm);
}

.category-nav {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-nav::-webkit-scrollbar {
  display: none;
}

.category-nav-track {
  position: relative;
  display: flex;
  align-items: center;
  min-width: max-content;
}

.category-nav-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  width: 32px;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
}

.category-nav-arrow:hover {
  color: var(--color-primary-dark);
}

.category-nav-arrow.left {
  left: 0;
  justify-content: flex-start;
  padding-left: 4px;
  background: linear-gradient(to right, var(--category-nav-bg) 45%, transparent);
}

.category-nav-arrow.right {
  right: 0;
  justify-content: flex-end;
  padding-right: 4px;
  background: linear-gradient(to left, var(--category-nav-bg) 45%, transparent);
}

.category-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
}

.category-nav-item:hover {
  color: var(--color-primary-dark);
}

.category-nav-item.active {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.category-nav-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.category-nav-label {
  font-size: var(--font-size-sm);
}

.category-nav-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 2;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px 2px 0 0;
  transition:
    transform 0.2s ease,
    width 0.2s ease;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .category-nav-wrap,
  .category-nav-underline {
    transition: none;
  }
}
</style>
