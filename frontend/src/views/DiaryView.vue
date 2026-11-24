<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { DiaryEntry } from '../api/types';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useDiaryStore } from '../stores/diary';
import { useToast } from '../composables/useToast';
import { ACTION_ICONS } from '../utils/actionIcons';
import { hashHighlightId } from '../utils/hashHighlight';

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

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tripStore = useTripStore();
const diaryStore = useDiaryStore();
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

// 6. Modals & Hash Navigation
const showNewModal = ref(false);
const editingEntry = ref<DiaryEntry | null>(null);
const focusedEntryId = ref<number | null>(null);
let lastHandledHash: string | null = null;

function clearFocusedEntry(event?: MouseEvent) {
  if (focusedEntryId.value == null) {
    return;
  }

  const target = event?.target as HTMLElement | null;

  if (target?.closest('a, button')) {
    return;
  }

  focusedEntryId.value = null;

  const currentRouteName = router.currentRoute.value.name;

  if (
    (currentRouteName === 'diary' || currentRouteName === 'legacy-diary') &&
    route.hash.startsWith('#entry-')
  ) {
    void router.replace({ path: route.path, query: route.query, hash: '' });
  }
}

function scrollToHashEntry(hash: string) {
  const id = hashHighlightId(hash, 'entry');
  focusedEntryId.value = id;

  if (id == null) {
    lastHandledHash = hash;
    return;
  }

  if (!entries.value.some((entry) => entry.id === id)) {
    return;
  }

  lastHandledHash = hash;

  void nextTick(() => {
    const target = document.getElementById(`entry-${id}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

watch(
  () => [route.hash, loading.value, entries.value.length] as const,
  ([hash, isLoading]) => {
    if (!hash) {
      lastHandledHash = null;
      focusedEntryId.value = null;
      return;
    }

    if (!isLoading && hash !== lastHandledHash) {
      scrollToHashEntry(hash);
    }
  },
  { immediate: true }
);

function openNewEntry() {
  clearFocusedEntry();
  showNewModal.value = true;
}

function startEditEntry(entry: DiaryEntry) {
  clearFocusedEntry();
  editingEntry.value = entry;
}

function onEntryCreated(created: DiaryEntry) {
  entries.value.unshift({
    ...created,
    images: Array.isArray(created.images) ? created.images : [],
    excursion_ids: Array.isArray(created.excursion_ids) ? created.excursion_ids : [],
    spot_ids: Array.isArray(created.spot_ids) ? created.spot_ids : [],
    editor_ids: Array.isArray(created.editor_ids) ? created.editor_ids : [],
  });
  diaryData.sortEntries();
  diaryStore.setEntries(entries.value);
}

function onEntryUpdated(updated: DiaryEntry) {
  const sanitized: DiaryEntry = {
    ...updated,
    images: Array.isArray(updated.images) ? updated.images : [],
    excursion_ids: Array.isArray(updated.excursion_ids) ? updated.excursion_ids : [],
    spot_ids: Array.isArray(updated.spot_ids) ? updated.spot_ids : [],
    editor_ids: Array.isArray(updated.editor_ids) ? updated.editor_ids : [],
  };
  const idx = entries.value.findIndex((e) => e.id === sanitized.id);

  if (idx !== -1) {
    entries.value[idx] = sanitized;
  }

  diaryData.sortEntries();
  diaryStore.setEntries(entries.value);
}

async function updateEntryContent(entry: DiaryEntry, html: string) {
  const previousContent = entry.content;
  const previousFormat = entry.content_format;
  entry.content = html;
  entry.content_format = 'html';

  try {
    const updated = await api.put<DiaryEntry>(`/diary/${entry.id}`, {
      title: entry.title ?? undefined,
      content: html,
      content_format: 'html',
      images: Array.isArray(entry.images) ? entry.images : [],
      excursion_ids: Array.isArray(entry.excursion_ids) ? entry.excursion_ids : [],
      spot_ids: Array.isArray(entry.spot_ids) ? entry.spot_ids : [],
      date: entry.date,
      is_draft: Boolean(entry.is_draft),
    });
    onEntryUpdated(updated);
  } catch {
    entry.content = previousContent;
    entry.content_format = previousFormat;
    const { showToast } = useToast();
    showToast({
      message: 'Checklisten-Status konnte nicht gespeichert werden.',
      type: 'error',
    });
  }
}

onMounted(() => {
  weather.loadDiaryWeather();
});
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Tagebuch</h1>
      <Button class="header-btn" @click="openNewEntry">
        <AppIcon :icon="ACTION_ICONS.write" :size="14" group="actions" /> Neuer Eintrag
      </Button>
    </div>

    <TransitionGroup tag="div" name="list" class="entries">
      <DiaryEntryCard
        v-for="(entry, index) in entries"
        :id="`entry-${entry.id}`"
        :key="entry.id"
        :entry="entry"
        :index="index"
        :highlighted="highlightedIds.has(entry.id)"
        :focused="focusedEntryId === entry.id"
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
        @click="clearFocusedEntry"
        @edit="startEditEntry(entry)"
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
        @update-content="updateEntryContent"
      />
    </TransitionGroup>

    <EmptyState v-if="!entries.length">Noch keine Tagebuch-Einträge.</EmptyState>

    <DiaryNewModal
      v-model="showNewModal"
      :trip-id="tripId"
      @created="onEntryCreated"
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

<style lang="scss" scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.header h1 {
  margin: 0;
}

@include container-app-main-down('mobile') {
  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-btn {
    width: 100%;
    justify-content: center;
  }
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  min-width: 0;
}
</style>
