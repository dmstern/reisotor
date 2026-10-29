import { computed, ref } from 'vue';
import { api } from '../api/client';
import type { DiaryEntry } from '../api/types';
import { isEmptyRichText } from '../utils/richText';
import { useDraftAutosave } from './useDraftAutosave';
import { useToast } from './useToast';
import { useDiaryImageUpload } from './useDiaryImageUpload';
import {
  createEmptyDiaryForm,
  hasDiaryEntryContent,
  type DiaryFormData,
} from './useDiaryFormTypes';
import type RichTextEditor from '../components/RichTextEditor.vue';

export interface UseDiaryEditFormOptions {
  onEntryUpdated: (entry: DiaryEntry) => void;
  onEntryRemoved: (id: number) => Promise<void>;
  onLinkDone: (excursionIds: number[], spotIds: number[], date: string) => void;
}

export function useDiaryEditForm(options: UseDiaryEditFormOptions) {
  const { onEntryUpdated, onEntryRemoved, onLinkDone } = options;
  const { showToast } = useToast();

  const editingEntry = ref<DiaryEntry | null>(null);
  const editForm = ref<DiaryFormData>(createEmptyDiaryForm());
  const editShowExcursionPicker = ref(false);
  const editShowSpotPicker = ref(false);

  const editorRef = ref<InstanceType<typeof RichTextEditor> | null>(null);
  const contentTouched = ref(false);
  const dateTouched = ref(false);

  const upload = useDiaryImageUpload({ tripId: () => editingEntry.value?.trip_id });

  const isContentEmpty = computed(() => isEmptyRichText(editForm.value.content));
  const showContentError = computed(() => contentTouched.value && isContentEmpty.value);
  const isDateEmpty = computed(() => !editForm.value.date);
  const showDateError = computed(() => dateTouched.value && isDateEmpty.value);

  const canSave = computed(
    () => !isContentEmpty.value && !isDateEmpty.value && !upload.uploading.value
  );

  const saveTooltip = computed(() => {
    if (upload.uploading.value) return 'Bilder werden noch hochgeladen…';
    if (isDateEmpty.value) return 'Bitte wähle ein Datum aus';
    if (isContentEmpty.value) return 'Bitte fülle zuerst den Text des Tagebucheintrags aus';
    return undefined;
  });

  const canSaveDraft = computed(
    () => !upload.uploading.value && hasDiaryEntryContent(editForm.value)
  );

  const saveDraftTooltip = computed(() => {
    if (upload.uploading.value) return 'Bilder werden noch hochgeladen…';
    if (!hasDiaryEntryContent(editForm.value)) {
      return 'Bitte fülle zuerst den Titel, Text oder ein Bild aus';
    }
    return undefined;
  });

  const isDraftEmpty = computed(
    () => Boolean(editingEntry.value?.is_draft) && !hasDiaryEntryContent(editForm.value)
  );

  const isDeleteDisabled = computed(() => upload.uploading.value);

  const deleteTooltip = computed(() => {
    if (upload.uploading.value) return 'Bilder werden noch hochgeladen…';
    return undefined;
  });

  const editDraft = useDraftAutosave(
    () => `diary:edit:${editingEntry.value?.id}`,
    editForm,
    computed(() => editingEntry.value !== null)
  );

  function startEdit(entry: DiaryEntry) {
    contentTouched.value = false;
    dateTouched.value = false;
    editForm.value = {
      title: entry.title ?? '',
      content: entry.content,
      images: [...entry.images],
      excursion_ids: [...entry.excursion_ids],
      spot_ids: [...entry.spot_ids],
      date: entry.date ?? entry.created_at?.slice(0, 10) ?? '',
    };
    editShowExcursionPicker.value = editForm.value.excursion_ids.length > 0;
    editShowSpotPicker.value = editForm.value.spot_ids.length > 0;
    editingEntry.value = entry;
  }

  async function submitEditEntry() {
    if (isDateEmpty.value || isContentEmpty.value) {
      if (isDateEmpty.value) dateTouched.value = true;
      if (isContentEmpty.value) {
        contentTouched.value = true;
        editorRef.value?.focus();
      }
      return;
    }
    if (!editingEntry.value || upload.uploading.value) return;
    const entryId = editingEntry.value.id;
    const body = {
      title: editForm.value.title || undefined,
      content: editForm.value.content,
      content_format: 'html',
      images: editForm.value.images,
      excursion_ids: editForm.value.excursion_ids,
      spot_ids: editForm.value.spot_ids,
      date: editForm.value.date,
      is_draft: false,
    };
    const excursionIds = editForm.value.excursion_ids;
    const spotIds = editForm.value.spot_ids;
    const date = editForm.value.date;

    const updated = await api.put<DiaryEntry>(`/diary/${entryId}`, body);
    editDraft.clear();
    editingEntry.value = null;
    onEntryUpdated(updated);
    onLinkDone(excursionIds, spotIds, date);
  }

  async function saveDraftOnly() {
    if (!editingEntry.value || upload.uploading.value) return;
    if (!hasDiaryEntryContent(editForm.value)) return;
    const entryId = editingEntry.value.id;
    const now = new Date().toISOString();
    const body = {
      title: editForm.value.title || undefined,
      content: editForm.value.content,
      content_format: 'html',
      images: editForm.value.images,
      excursion_ids: editForm.value.excursion_ids,
      spot_ids: editForm.value.spot_ids,
      date: editForm.value.date || now.slice(0, 10),
      is_draft: true,
    };
    const excursionIds = editForm.value.excursion_ids;
    const spotIds = editForm.value.spot_ids;
    const date = editForm.value.date;

    const updated = await api.put<DiaryEntry>(`/diary/${entryId}`, body);
    editDraft.clear();
    editingEntry.value = null;
    onEntryUpdated(updated);
    onLinkDone(excursionIds, spotIds, date);
    showToast({
      message: 'Entwurf gespeichert.',
      type: 'info',
    });
  }

  async function closeEditForm() {
    upload.abortUpload();
    const entryToSave = editingEntry.value;
    if (!entryToSave) return;
    const formToSave = { ...editForm.value };
    editDraft.clear();
    editingEntry.value = null;

    if (entryToSave.is_draft && hasDiaryEntryContent(formToSave)) {
      const now = new Date().toISOString();
      const body = {
        title: formToSave.title || undefined,
        content: formToSave.content,
        content_format: 'html',
        images: formToSave.images,
        excursion_ids: formToSave.excursion_ids,
        spot_ids: formToSave.spot_ids,
        date: formToSave.date || now.slice(0, 10),
        is_draft: true,
      };
      const updated = await api.put<DiaryEntry>(`/diary/${entryToSave.id}`, body);
      onEntryUpdated(updated);
    }
  }

  function discardEditDraft() {
    if (!editingEntry.value) return;
    const isDraft = editingEntry.value.is_draft;
    startEdit(editingEntry.value);
    editDraft.clear();
    showToast({
      message: isDraft ? 'Entwurf verworfen.' : 'Änderungen verworfen.',
      type: 'info',
    });
  }

  async function deleteEditingEntry() {
    if (!editingEntry.value || upload.uploading.value) return;
    const id = editingEntry.value.id;
    editDraft.clear();
    editingEntry.value = null;
    await onEntryRemoved(id);
  }

  return {
    editingEntry,
    editForm,
    editShowExcursionPicker,
    editShowSpotPicker,
    editorRef,
    contentTouched,
    dateTouched,
    isContentEmpty,
    showContentError,
    isDateEmpty,
    showDateError,
    canSave,
    saveTooltip,
    canSaveDraft,
    saveDraftTooltip,
    isDraftEmpty,
    isDeleteDisabled,
    deleteTooltip,
    editDraft,
    upload,
    startEdit,
    submitEditEntry,
    saveDraftOnly,
    closeEditForm,
    discardEditDraft,
    deleteEditingEntry,
  };
}
