import { computed, onMounted, ref, unref, watch, type ComputedRef, type Ref } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryEntry, DiaryLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useLiveSyncStore } from '../stores/liveSync';
import { useToast } from './useToast';

export interface UseDiaryDataOptions {
  tripId: number | Ref<number> | ComputedRef<number>;
  onSocialLoaded?: (likes: DiaryLike[], comments: DiaryComment[]) => void;
}

export function useDiaryData(options: UseDiaryDataOptions) {
  const { tripId, onSocialLoaded } = options;
  const auth = useAuthStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const scheduleStore = useScheduleStore();
  const liveSync = useLiveSyncStore();
  const { showToast } = useToast();

  const entries = ref<DiaryEntry[]>([]);
  const users = ref<User[]>([]);
  const loading = ref(true);
  const highlightedIds = ref<Set<number>>(new Set());

  const myDraft = computed(
    () => entries.value.find((e) => e.is_draft && e.author_id === auth.user?.id) ?? null
  );

  function sortEntries() {
    entries.value.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.id - a.id
    );
  }

  function author(id: number) {
    return users.value.find((u) => u.id === id);
  }

  function coEditorsFor(entry: DiaryEntry): User[] {
    return entry.editor_ids
      .filter((id) => id !== entry.author_id)
      .map((id) => author(id))
      .filter((u): u is User => !!u);
  }

  async function load() {
    const currentTripId = unref(tripId);
    try {
      const [entriesRes, likesRes, commentsRes, usersRes] = await Promise.all([
        api.get<DiaryEntry[]>(`/diary?trip_id=${currentTripId}`),
        api.get<DiaryLike[]>(`/diary/likes?trip_id=${currentTripId}`),
        api.get<DiaryComment[]>(`/diary/comments?trip_id=${currentTripId}`),
        api.get<User[]>(`/trips/${currentTripId}/members`),
        excursionsStore.load(),
        spotsStore.load(),
        scheduleStore.load(),
      ]);
      entries.value = entriesRes;
      users.value = usersRes;
      if (onSocialLoaded) {
        onSocialLoaded(likesRes, commentsRes);
      }
    } catch {
      // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte
    } finally {
      loading.value = false;
    }
  }

  async function removeEntry(id: number) {
    await api.delete(`/diary/${id}`);
    entries.value = entries.value.filter((e) => e.id !== id);
    showToast({
      message: 'Tagebucheintrag gelöscht. Er befindet sich nun im Papierkorb.',
      type: 'info',
    });
  }

  async function removeImageFromEntry(entry: DiaryEntry, index: number) {
    if (auth.user?.restricted) return;
    const removed = entry.images[index];
    entry.images.splice(index, 1);
    const body = {
      title: entry.title || undefined,
      content: entry.content,
      content_format: entry.content_format || 'html',
      images: entry.images,
      excursion_ids: entry.excursion_ids ?? [],
      spot_ids: entry.spot_ids ?? [],
      date: entry.date,
      is_draft: Boolean(entry.is_draft),
    };
    try {
      const updated = await api.put<DiaryEntry>(`/diary/${entry.id}`, body);
      const idx = entries.value.findIndex((e) => e.id === updated.id);
      if (idx !== -1) entries.value[idx] = updated;
      sortEntries();
    } catch (err) {
      entry.images.splice(index, 0, removed);
      console.error('Fehler beim Entfernen des Bildes aus dem Tagebucheintrag:', err);
    }
  }

  watch(() => liveSync.domainVersion.diary, load);

  onMounted(async () => {
    highlightedIds.value = liveSync.markSeen('diary');
    await load();
  });

  return {
    entries,
    users,
    loading,
    highlightedIds,
    myDraft,
    sortEntries,
    author,
    coEditorsFor,
    load,
    removeEntry,
    removeImageFromEntry,
  };
}
