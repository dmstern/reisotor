import { getCurrentInstance, onUnmounted, ref, type Ref } from 'vue';
import { api } from '../api/client';
import type { DiaryImage } from '../api/types';
import { compressImage, isHeicFile } from '../utils/imageCompression';

export interface UseDiaryImageUploadReturn {
  uploading: Ref<boolean>;
  uploadError: Ref<string>;
  fileInputRef: Ref<HTMLInputElement | null>;
  uploadCurrent: Ref<number>;
  uploadTotal: Ref<number>;
  uploadFileName: Ref<string>;
  uploadPercent: Ref<number>;
  uploadFiles: (fileList: FileList | null, target: { images: DiaryImage[] }) => Promise<void>;
  abortUpload: () => void;
  onFilesSelected: (event: Event, target: { images: DiaryImage[] }) => Promise<void>;
  removeImage: (target: { images: DiaryImage[] }, index: number) => void;
}

export function useDiaryImageUpload(): UseDiaryImageUploadReturn {
  const uploading = ref(false);
  const uploadError = ref('');
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const uploadCurrent = ref(1);
  const uploadTotal = ref(0);
  const uploadFileName = ref('');
  const uploadPercent = ref(0);
  let abortController: AbortController | null = null;

  function abortUpload() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    uploading.value = false;
    uploadCurrent.value = 1;
    uploadTotal.value = 0;
    uploadFileName.value = '';
    uploadPercent.value = 0;
  }

  async function uploadFiles(fileList: FileList | null, target: { images: DiaryImage[] }) {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;

    const controller = new AbortController();
    abortController = controller;
    uploadTotal.value = files.length;
    uploadCurrent.value = 1;
    uploadFileName.value = files[0].name;
    uploadPercent.value = 0;

    uploading.value = true;
    uploadError.value = '';
    try {
      for (let i = 0; i < files.length; i++) {
        if (controller.signal.aborted) break;
        const file = files[i];
        uploadCurrent.value = i + 1;
        uploadFileName.value = file.name;
        uploadPercent.value = Math.round((i / files.length) * 100);

        const compressed = await compressImage(file);
        if (controller.signal.aborted) break;

        uploadPercent.value = Math.round(((i + 0.5) / files.length) * 100);

        const filename = isHeicFile(file)
          ? file.name.replace(/\.(heic|heif)$/i, '.jpg')
          : file.name;
        const res = await api.post<{ url: string; original_name?: string }>(
          '/diary/images',
          {
            data: compressed,
            filename,
          },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) break;

        target.images.push({
          url: res.url,
          original_name: res.original_name || filename,
        });
        uploadPercent.value = Math.round(((i + 1) / files.length) * 100);
      }
    } catch {
      if (controller.signal.aborted) return;
      uploadError.value = 'Bild-Upload fehlgeschlagen. Bitte erneut versuchen.';
    } finally {
      uploading.value = false;
      abortController = null;
    }
  }

  async function onFilesSelected(event: Event, target: { images: DiaryImage[] }) {
    const input = event.target as HTMLInputElement;
    await uploadFiles(input.files, target);
    input.value = '';
  }

  function removeImage(target: { images: DiaryImage[] }, index: number) {
    target.images.splice(index, 1);
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      abortUpload();
    });
  }

  return {
    uploading,
    uploadError,
    fileInputRef,
    uploadCurrent,
    uploadTotal,
    uploadFileName,
    uploadPercent,
    uploadFiles,
    abortUpload,
    onFilesSelected,
    removeImage,
  };
}
