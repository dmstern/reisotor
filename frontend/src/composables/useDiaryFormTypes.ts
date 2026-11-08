import type { DiaryImage } from '../api/types';
import { toLocalDateString } from '../utils/dateFormat';
import { isEmptyRichText } from '../utils/richText';

export interface DiaryFormData {
  title: string;
  content: string;
  images: DiaryImage[];
  excursion_ids: number[];
  spot_ids: number[];
  date: string;
}

export function createEmptyDiaryForm(dateStr?: string): DiaryFormData {
  return {
    title: '',
    content: '',
    images: [],
    excursion_ids: [],
    spot_ids: [],
    date: dateStr ?? toLocalDateString(new Date()),
  };
}

export function hasDiaryEntryContent(form: {
  title: string;
  content: string;
  images: DiaryImage[];
}): boolean {
  return form.title.trim().length > 0 || !isEmptyRichText(form.content) || form.images.length > 0;
}
