import { computed, ref, unref, type ComputedRef, type Ref } from 'vue';
import { api } from '../api/client';
import type { DiaryEntry } from '../api/types';
import { isEmptyRichText } from '../utils/richText';
import { useDraftAutosave } from './useDraftAutosave';
import { useToast } from './useToast';
import { useExcursionsStore } from '../stores/excursions';
import { useDiaryImageUpload } from './useDiaryImageUpload';
import {
  createEmptyDiaryForm,
  hasDiaryEntryContent,
  type DiaryFormData,
} from './useDiaryFormTypes';
import type RichTextEditor from '../components/RichTextEditor.vue';

export interface UseDiaryNewFormOptions {
  tripId: number | Ref<number> | ComputedRef<number>;
  myDraft: ComputedRef<DiaryEntry | null> | Ref<DiaryEntry | null>;
  onStartEditDraft: (draft: DiaryEntry) => void;
  onEntryCreated: (entry: DiaryEntry) => void;
  onLinkDone: (excursionIds: number[], spotIds: number[], date: string) => void;
}

export function useDiaryNewForm(options: UseDiaryNewFormOptions) {
  const { tripId, myDraft, onStartEditDraft, onEntryCreated, onLinkDone } = options;
  const excursionsStore = useExcursionsStore();
  const { showToast } = useToast();

  const showForm = ref(false);
  const form = ref<DiaryFormData>(createEmptyDiaryForm());
  const showExcursionPicker = ref(false);
  const showSpotPicker = ref(false);

  const editorRef = ref<InstanceType<typeof RichTextEditor> | null>(null);
  const contentTouched = ref(false);
  const dateTouched = ref(false);

  const upload = useDiaryImageUpload();

  const isContentEmpty = computed(() => isEmptyRichText(form.value.content));
  const showContentError = computed(() => contentTouched.value && isContentEmpty.value);
  const isDateEmpty = computed(() => !form.value.date);
  const showDateError = computed(() => dateTouched.value && isDateEmpty.value);

  const canSubmit = computed(
    () => !isContentEmpty.value && !isDateEmpty.value && !upload.uploading.value
  );

  const saveTooltip = computed(() => {
    if (upload.uploading.value) return 'Bilder werden noch hochgeladen…';
    if (isDateEmpty.value) return 'Bitte wähle ein Datum aus';
    if (isContentEmpty.value) return 'Bitte fülle zuerst den Text des Tagebucheintrags aus';
    return undefined;
  });

  const newDraft = useDraftAutosave('diary:new', form, showForm);

  function openNewForm() {
    contentTouched.value = false;
    dateTouched.value = false;
    const draft = unref(myDraft);
    if (draft) {
      onStartEditDraft(draft);
      return;
    }
    form.value = createEmptyDiaryForm();
    showSpotPicker.value = false;
    form.value.excursion_ids = excursionsStore.excursions
      .filter((e) => e.date === form.value.date)
      .map((e) => e.id);
    showExcursionPicker.value = form.value.excursion_ids.length > 0;
    showForm.value = true;
  }

  async function submitEntry() {
    if (isDateEmpty.value || isContentEmpty.value) {
      if (isDateEmpty.value) dateTouched.value = true;
      if (isContentEmpty.value) {
        contentTouched.value = true;
        editorRef.value?.focus();
      }
      return;
    }
    if (upload.uploading.value) return;
    const currentTripId = unref(tripId);
    const body = {
      trip_id: currentTripId,
      title: form.value.title || undefined,
      content: form.value.content,
      content_format: 'html',
      images: form.value.images,
      excursion_ids: form.value.excursion_ids,
      spot_ids: form.value.spot_ids,
      date: form.value.date,
    };
    const created = await api.post<DiaryEntry>('/diary', body);
    onEntryCreated(created);
    onLinkDone(form.value.excursion_ids, form.value.spot_ids, form.value.date);
    form.value = createEmptyDiaryForm();
    showForm.value = false;
    newDraft.clear();
  }

  async function closeForm() {
    upload.abortUpload();
    showForm.value = false;
    if (hasDiaryEntryContent(form.value)) {
      const currentTripId = unref(tripId);
      const body = {
        trip_id: currentTripId,
        title: form.value.title || undefined,
        content: form.value.content,
        content_format: 'html',
        images: form.value.images,
        excursion_ids: form.value.excursion_ids,
        spot_ids: form.value.spot_ids,
        date: form.value.date,
        is_draft: true,
      };
      const created = await api.post<DiaryEntry>('/diary', body);
      onEntryCreated(created);
    }
    form.value = createEmptyDiaryForm();
    newDraft.clear();
  }

  function discardNewDraft() {
    contentTouched.value = false;
    dateTouched.value = false;
    form.value = createEmptyDiaryForm();
    newDraft.clear();
    showToast({ message: 'Entwurf verworfen.', type: 'info' });
  }

  return {
    showForm,
    form,
    showExcursionPicker,
    showSpotPicker,
    editorRef,
    contentTouched,
    dateTouched,
    isContentEmpty,
    showContentError,
    isDateEmpty,
    showDateError,
    canSubmit,
    saveTooltip,
    newDraft,
    upload,
    openNewForm,
    submitEntry,
    closeForm,
    discardNewDraft,
  };
}
