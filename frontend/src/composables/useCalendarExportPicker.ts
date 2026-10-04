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
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    calendarPickerKey.value = key;
    calendarPickerStyle.value = {
      top: `${rect.bottom + 6}px`,
      left: `${Math.max(8, Math.min(rect.right - 188, window.innerWidth - 196))}px`,
    };
    await nextTick();
    const menuRect = document.querySelector('.picker-menu')?.getBoundingClientRect();
    if (menuRect && menuRect.bottom > window.innerHeight - 8) {
      calendarPickerStyle.value = {
        ...calendarPickerStyle.value,
        top: `${Math.max(8, window.innerHeight - menuRect.height - 8)}px`,
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
