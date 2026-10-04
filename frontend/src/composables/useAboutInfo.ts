import { computed } from 'vue';
import { useBuildInfoStore } from '../stores/buildInfo';

const buildTimeFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatBuildTime(iso: string | null) {
  return iso ? buildTimeFormatter.format(new Date(iso)) : 'unbekannt';
}

export function useAboutInfo() {
  const buildInfoStore = useBuildInfoStore();
  const backendBuildInfo = computed(() => buildInfoStore.buildInfo);

  const changelogContent = computed(() => {
    const cl = backendBuildInfo.value?.changelog;
    if (!cl) return '';
    if (cl.groups && cl.groups.length > 0) {
      return cl.groups
        .map(
          (g) =>
            `#### ${g.title}\n\n` +
            g.notes.map((note) => (note.startsWith('- ') ? note : `- ${note}`)).join('\n')
        )
        .join('\n\n');
    }
    return cl.notes.map((note) => (note.startsWith('- ') ? note : `- ${note}`)).join('\n');
  });

  // Lokale Bindings statt der globalen __APP_*__-Konstanten direkt im Template: vue-tsc's
  // Template-Typprüfung löst per `define` gebackene Ambient-Globals dort nicht auf (versucht sie
  // stattdessen als Property der Komponenteninstanz zu finden).
  const frontendVersion = __APP_VERSION__;
  const frontendCommit = __APP_COMMIT__;
  const frontendBuiltAt = __APP_BUILT_AT__;

  return {
    buildInfoStore,
    backendBuildInfo,
    formatBuildTime,
    changelogContent,
    frontendVersion,
    frontendCommit,
    frontendBuiltAt,
  };
}
