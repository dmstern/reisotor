<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { DiaryEntry } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { ACTION_ICONS } from '../utils/actionIcons';

// Subkomponenten & Primitives
import DiaryEntryCard from '../components/DiaryEntryCard.vue';
import DiaryNewModal from '../components/DiaryNewModal.vue';
import DiaryEditModal from '../components/DiaryEditModal.vue';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import Button from '../components/primitives/Button.vue';
import AppIcon from '../components/AppIcon.vue';

// Composables
import { useDiaryData } from '../composables/useDiaryData';
import { useDiarySocial } from '../composables/useDiarySocial';
import { useDiaryWeather } from '../composables/useDiaryWeather';
import { useDiaryEntityLinks } from '../composables/useDiaryEntityLinks';
import { useDiaryPreview } from '../composables/useDiaryPreview';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const trip = computed(() => tripStore.currentTrip);

// 1. Data & Live Sync
const diaryData = useDiaryData({
  tripId,
  onSocialLoaded: (likes, comments) => {
    social.likes.value = likes;
    social.comments.value = comments;
  },
});
const {
  entries,
  loading,
  highlightedIds,
  author,
  coEditorsFor,
  removeEntry,
  removeImageFromEntry,
  myDraft,
} = diaryData;

// 2. Social (Likes & Comments)
const social = useDiarySocial({
  users: diaryData.users,
});
const {
  likesFor,
  likedByMe,
  commentsFor,
  openComments,
  toggleLike,
  toggleComments,
  commentItemsFor,
  submitComment,
  removeComment,
  updateComment,
  toggleCommentLike,
} = social;

// 3. Weather
const weather = useDiaryWeather({
  trip,
  tripId,
});
const { weatherForEntry } = weather;

// 4. Entity Links & Map
const links = useDiaryEntityLinks();
const { hasMapContent, excursionsForEntry, spotsForEntry, markLinkedAsDone } = links;

// 5. Image Preview Modal
const preview = useDiaryPreview();
const {
  diaryPreviewOpen,
  diaryPreviewImages,
  diaryPreviewIndex,
  diaryPreviewEditable,
  openDiaryPreview,
  handleDiaryPreviewRemove,
} = preview;

// 6. Modals
const showNewModal = ref(false);
const editingEntry = ref<DiaryEntry | null>(null);

function openNewEntry() {
  if (myDraft.value) {
    editingEntry.value = myDraft.value;
  } else {
    showNewModal.value = true;
  }
}

function onEntryCreated(created: DiaryEntry) {
  entries.value.unshift(created);
  diaryData.sortEntries();
}

function onEntryUpdated(updated: DiaryEntry) {
  const idx = entries.value.findIndex((e) => e.id === updated.id);
  if (idx !== -1) entries.value[idx] = updated;
  diaryData.sortEntries();
}

onMounted(() => {
  weather.loadDiaryWeather();
});
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Tagebuch</h1>
      <Button @click="openNewEntry">
        <AppIcon :icon="ACTION_ICONS.write" :size="14" group="actions" /> Neuer Eintrag
      </Button>
    </div>

    <TransitionGroup tag="div" name="list" class="entries">
      <DiaryEntryCard
        v-for="(entry, index) in entries"
        :key="entry.id"
        :entry="entry"
        :index="index"
        :highlighted="highlightedIds.has(entry.id)"
        :author-name="entry.author_username ?? author(entry.author_id)?.username ?? '?'"
        :author-avatar="entry.author_avatar ?? author(entry.author_id)?.avatar ?? '❓'"
        :co-editors="coEditorsFor(entry)"
        :weather="weatherForEntry(entry)"
        :has-map="hasMapContent(entry)"
        :excursions="excursionsForEntry(entry)"
        :spots="spotsForEntry(entry)"
        :like-count="likesFor(entry.id).length"
        :liked="likedByMe(entry.id)"
        :comment-count="commentsFor(entry.id).length"
        :comments="commentItemsFor(entry.id)"
        :comments-open="openComments.has(entry.id)"
        @edit="editingEntry = entry"
        @preview-images="
          (images, idx) =>
            openDiaryPreview(images, idx, !auth.user?.restricted, (i) =>
              removeImageFromEntry(entry, i)
            )
        "
        @toggle-like="toggleLike(entry.id)"
        @toggle-comments="toggleComments(entry.id)"
        @submit-comment="(content) => submitComment(entry.id, content)"
        @remove-comment="removeComment"
        @update-comment="updateComment"
        @toggle-comment-like="toggleCommentLike"
      />
    </TransitionGroup>

    <EmptyState v-if="!entries.length">Noch keine Tagebuch-Einträge.</EmptyState>

    <DiaryNewModal
      v-model="showNewModal"
      :trip-id="tripId"
      :my-draft="myDraft"
      @created="onEntryCreated"
      @start-edit-draft="(draft) => (editingEntry = draft)"
      @link-done="markLinkedAsDone"
      @preview-image="(images, idx, onRemove) => openDiaryPreview(images, idx, true, onRemove)"
    />

    <DiaryEditModal
      v-model:entry="editingEntry"
      @updated="onEntryUpdated"
      @removed="removeEntry"
      @link-done="markLinkedAsDone"
      @preview-image="(images, idx, onRemove) => openDiaryPreview(images, idx, true, onRemove)"
    />

    <AttachmentPreviewModal
      v-model="diaryPreviewOpen"
      :attachments="diaryPreviewImages"
      :initial-index="diaryPreviewIndex"
      :editable="diaryPreviewEditable"
      @remove="handleDiaryPreviewRemove"
    />
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 800px;
  margin: 0 auto;
}
</style>
