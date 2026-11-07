<script setup lang="ts">
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ count: number; liked: boolean; small?: boolean }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="like-btn"
    :class="{ liked, small }"
    :aria-label="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
    :title="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
    @click.stop="emit('toggle')"
  >
    <AppIcon
      :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked"
      :size="small ? 16 : 18"
      group="actions"
    />
    <span v-if="count > 0" class="social-count">{{ count }}</span>
  </Button>
</template>

<style scoped>
.like-btn {
  min-height: 36px;
  padding: 6px 10px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.like-btn.small {
  min-height: 34px;
  padding: 4px 8px;
  font-size: var(--font-size-xs);
  line-height: 1;
}

.like-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.like-btn.liked {
  color: var(--color-like);
}

.like-btn.liked:hover {
  background: var(--color-like-tint);
}

.social-count {
  font-size: var(--font-size-xs);
  font-weight: 600;
  margin-left: 2px;
}
</style>
