import { ref } from 'vue';
import { toLocalDateString } from '../utils/dateFormat';

export function useBackupExport() {
  const exporting = ref(false);
  const exportError = ref('');

  async function exportBackup() {
    exportError.value = '';
    exporting.value = true;
    try {
      const res = await fetch('/api/backup/export', { credentials: 'include' });
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reisotor-backup-${toLocalDateString(new Date())}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      exportError.value = 'Export fehlgeschlagen. Bitte erneut versuchen.';
    } finally {
      exporting.value = false;
    }
  }

  return {
    exporting,
    exportError,
    exportBackup,
  };
}
