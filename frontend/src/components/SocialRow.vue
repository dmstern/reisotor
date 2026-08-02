<script setup lang="ts">
import LikeButton from './LikeButton.vue';

// Teilt sich die Like+Kommentar-Zeile, die zuvor identisch in DiaryView/NotesView/ExcursionCard/
// SpotCard dupliziert war. Der offen/geschlossen-Zustand fürs Kommentar-Panel selbst bleibt bewusst
// beim jeweiligen Aufrufer (Set<number> in den Views, lokaler ref in den Cards) – hier wird nur die
// Darstellung geteilt, kein State verschoben.
defineProps<{ likeCount: number; liked: boolean; commentCount: number }>();
const emit = defineEmits<{ (e: 'toggle-like'): void; (e: 'toggle-comments'): void }>();
</script>

<template>
  <div class="social-row">
    <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
    <!-- .stop wie zuvor bei ExcursionCard/SpotCard: verhindert, dass der Klick zu einem
         umschließenden Karten-Klick-Handler (Detailansicht öffnen) durchgereicht wird. Bei
         Diary/Notes, wo es keinen solchen Handler gibt, ist .stop wirkungslos, aber unschädlich. -->
    <button type="button" class="secondary" @click.stop="emit('toggle-comments')">
      💬 {{ commentCount || '' }}
    </button>
  </div>
</template>

<style scoped>
.social-row {
  display: flex;
  gap: var(--space-2);
}
</style>
