import { ref } from 'vue';
import type { DiaryImage } from '../api/types';

export function useDiaryPreview() {
  const diaryPreviewOpen = ref(false);
  const diaryPreviewImages = ref<DiaryImage[]>([]);
  const diaryPreviewIndex = ref(0);
  const diaryPreviewEditable = ref(false);
  const diaryPreviewOnRemove = ref<((idx: number) => void) | null>(null);

  function openDiaryPreview(
    images: DiaryImage[],
    index: number,
    editable = false,
    onRemove?: (idx: number) => void
  ) {
    diaryPreviewImages.value = images;
    diaryPreviewIndex.value = index;
    diaryPreviewEditable.value = editable;
    diaryPreviewOnRemove.value = onRemove ?? null;
    diaryPreviewOpen.value = true;
  }

  function handleDiaryPreviewRemove(index: number) {
    if (diaryPreviewOnRemove.value) {
      diaryPreviewOnRemove.value(index);
    }
  }

  return {
    diaryPreviewOpen,
    diaryPreviewImages,
    diaryPreviewIndex,
    diaryPreviewEditable,
    diaryPreviewOnRemove,
    openDiaryPreview,
    handleDiaryPreviewRemove,
  };
}
