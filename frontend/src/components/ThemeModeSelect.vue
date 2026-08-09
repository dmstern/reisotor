<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore, THEME_MODE_OPTIONS } from '../stores/theme';

// icon: kompakter runder Button wie der bisherige Toggle (AppHeader.vue, LoginView.vue) - das
// eigentliche <select> liegt unsichtbar über dem Icon und fängt den Klick ab, damit sich der
// gewohnte Header-Platzbedarf nicht ändert. block: normales, beschriftetes <select> im
// Einstellungen-Listenstil (ProfileView.vue, siehe .nav-position-row dort).
withDefaults(defineProps<{ variant?: 'icon' | 'block' }>(), { variant: 'icon' });

const theme = useThemeStore();

const currentOption = computed(() => THEME_MODE_OPTIONS.find((o) => o.value === theme.mode) ?? THEME_MODE_OPTIONS[2]);
</script>

<template>
  <label
    class="theme-mode-select"
    :class="variant"
    title="Erscheinungsbild"
  >
    <span v-if="variant === 'icon'" class="icon-face" aria-hidden="true">{{ currentOption.icon }}</span>
    <span v-else class="block-label">Erscheinungsbild</span>
    <select v-model="theme.mode" aria-label="Erscheinungsbild">
      <option v-for="option in THEME_MODE_OPTIONS" :key="option.value" :value="option.value">
        {{ option.icon }} {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.theme-mode-select {
  display: inline-flex;
  align-items: center;
}

.theme-mode-select.icon {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  corner-shape: round;
  border: 1px solid var(--color-border);
  justify-content: center;
}

.theme-mode-select.icon .icon-face {
  font-size: 1.1rem;
  line-height: 1;
  pointer-events: none;
}

.theme-mode-select.icon select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: none;
  padding: 0;
  cursor: pointer;
}

.theme-mode-select.block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
