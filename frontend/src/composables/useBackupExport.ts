import { ref } from 'vue';
import { toLocalDateString } from '../utils/dateFormat';
import { useErrorNotifier } from './useErrorNotifier';

export function useBackupExport() {
  const exporting = ref(false);
  const exportError = ref('');
  const { notifyError } = useErrorNotifier();

  async function exportBackup() {
    exportError.value = '';
    exporting.value = true;
    let failedStatus: number | undefined;

    try {
      const res = await fetch('/api/backup/export', { credentials: 'include' });

      if (!res.ok) {
        failedStatus = res.status;
        throw new Error(`Export fehlgeschlagen (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reisotor-backup-${toLocalDateString(new Date())}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      exportError.value = 'Export fehlgeschlagen. Bitte erneut versuchen.';
      notifyError(err, {
        context: 'Datensicherung Export',
        kind: 'api',
        status: failedStatus,
        method: 'GET',
        path: '/backup/export',
        silent: true,
      });
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
