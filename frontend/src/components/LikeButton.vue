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
    variant="secondary"
    size="sm"
    class="like-btn"
    :class="{ liked }"
    @click.stop="emit('toggle')"
  >
    <AppIcon :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked" :size="15" group="actions" />
    {{ count || '' }}
  </Button>
</template>

<style scoped>
.like-btn.liked {
  border-color: var(--color-like-border);
  color: var(--color-like);
  background: var(--color-like-tint);
}
</style>
