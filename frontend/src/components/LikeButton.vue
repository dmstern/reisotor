<script setup lang="ts">
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ count: number; liked: boolean }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="like-btn"
    :class="{ liked }"
    :aria-label="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
    :title="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
    @click.stop="emit('toggle')"
  >
    <AppIcon :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked" :size="15" group="actions" />
    <span v-if="count > 0" class="social-count">{{ count }}</span>
  </Button>
</template>

<style scoped>
.like-btn {
  color: var(--color-text-muted);
}

.like-btn.liked {
  color: var(--color-like);
}

.like-btn.liked:hover {
  background: var(--color-like-tint);
}

.social-count {
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 2px;
}
</style>
