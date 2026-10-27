import { computed, onMounted, ref, unref, watch, type ComputedRef, type Ref } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryEntry, DiaryLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useLiveSyncStore } from '../stores/liveSync';
import { useToast } from './useToast';
import { restoreTrashItem } from '../api/trash';
import { useErrorNotifier } from './useErrorNotifier';

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
  const { notifyError } = useErrorNotifier();

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
        (b.date ?? b.created_at?.slice(0, 10) ?? '').localeCompare(
          a.date ?? a.created_at?.slice(0, 10) ?? ''
        ) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
        b.id - a.id
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
      entries.value = entriesRes.map((e) => ({
        ...e,
        images: Array.isArray(e.images) ? e.images.filter(Boolean) : [],
      }));
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
    const entry = entries.value.find((e) => e.id === id);
    const isDraft = Boolean(entry?.is_draft);
    await api.delete(`/diary/${id}`);
    entries.value = entries.value.filter((e) => e.id !== id);
    showToast({
      message: isDraft
        ? 'Entwurf verworfen.'
        : 'Tagebucheintrag gelöscht. Er befindet sich nun im Papierkorb.',
      type: 'info',
      onRestore: isDraft
        ? undefined
        : async () => {
            await restoreTrashItem('diary_entry', id);
            await load();
          },
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
      date: entry.date ?? entry.created_at?.slice(0, 10),
      is_draft: Boolean(entry.is_draft),
    };
    try {
      const updated = await api.put<DiaryEntry>(`/diary/${entry.id}`, body);
      const idx = entries.value.findIndex((e) => e.id === updated.id);
      if (idx !== -1) entries.value[idx] = updated;
      sortEntries();
    } catch (err) {
      entry.images.splice(index, 0, removed);
      notifyError(err, 'Bild konnte nicht aus dem Tagebucheintrag entfernt werden');
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
