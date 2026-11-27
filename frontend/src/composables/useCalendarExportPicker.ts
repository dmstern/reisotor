import { nextTick, ref } from 'vue';
import type { CalendarEntry } from '../api/types';
import { calendarEventFromEntry, triggerIcsDownload } from '../utils/calendarExport';

/**
 * Verwaltet den Zustand des per Teleport außerhalb von Scroll-Containern platzierten
 * "In eigenen Kalender exportieren"-Dropdown-Menüs (Apple, Google, Outlook, Android).
 */
export function useCalendarExportPicker() {
  const calendarPickerKey = ref<string | null>(null);
  const calendarPickerStyle = ref({ top: '0px', left: '0px' });

  async function toggleCalendarPicker(key: string, event: MouseEvent) {
    if (calendarPickerKey.value === key) {
      calendarPickerKey.value = null;
      return;
    }

    const PICKER_VERTICAL_GAP_PX = 6;
    const PICKER_VIEWPORT_MARGIN_PX = 8;
    const PICKER_ESTIMATED_WIDTH_PX = 188;
    const PICKER_MAX_RIGHT_OFFSET_PX = 196;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    calendarPickerKey.value = key;
    calendarPickerStyle.value = {
      top: `${rect.bottom + PICKER_VERTICAL_GAP_PX}px`,
      left: `${Math.max(PICKER_VIEWPORT_MARGIN_PX, Math.min(rect.right - PICKER_ESTIMATED_WIDTH_PX, window.innerWidth - PICKER_MAX_RIGHT_OFFSET_PX))}px`,
    };
    await nextTick();
    const menuRect = document.querySelector('.picker-menu')?.getBoundingClientRect();

    if (menuRect && menuRect.bottom > window.innerHeight - PICKER_VIEWPORT_MARGIN_PX) {
      calendarPickerStyle.value = {
        ...calendarPickerStyle.value,
        top: `${Math.max(PICKER_VIEWPORT_MARGIN_PX, window.innerHeight - menuRect.height - PICKER_VIEWPORT_MARGIN_PX)}px`,
      };
    }
  }

  function downloadIcsForEntry(entry: CalendarEntry) {
    triggerIcsDownload(calendarEventFromEntry(entry));
    calendarPickerKey.value = null;
  }

  function closeCalendarPicker() {
    calendarPickerKey.value = null;
  }

  return {
    calendarPickerKey,
    calendarPickerStyle,
    toggleCalendarPicker,
    downloadIcsForEntry,
    closeCalendarPicker,
  };
}
