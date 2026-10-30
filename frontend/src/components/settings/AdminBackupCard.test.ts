// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, ref, type Component } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AdminBackupCard from './AdminBackupCard.vue';
import * as backupComposable from '../../composables/useBackupExport';

function mountComponent(rootComponent: Component) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('AdminBackupCard', () => {
  const mockExportBackup = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    mockExportBackup.mockReset();
    vi.spyOn(backupComposable, 'useBackupExport').mockReturnValue({
      exporting: ref(false),
      exportError: ref(''),
      exportBackup: mockExportBackup,
    });
  });

  it('renders Datensicherung header and backup button', () => {
    const { container, cleanUp } = mountComponent(AdminBackupCard);

    expect(container.textContent).toContain('Datensicherung');
    expect(container.textContent).toContain('Backup exportieren (ZIP)');
    expect(container.textContent).toContain(
      'Die Wiederherstellung (Import) erfolgt ab sofort manuell auf dem Server'
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button?.click();
    expect(mockExportBackup).toHaveBeenCalledTimes(1);

    cleanUp();
  });

  it('displays error message if exportError is provided', () => {
    vi.spyOn(backupComposable, 'useBackupExport').mockReturnValue({
      exporting: ref(false),
      exportError: ref('Export fehlgeschlagen. Bitte erneut versuchen.'),
      exportBackup: mockExportBackup,
    });

    const { container, cleanUp } = mountComponent(AdminBackupCard);

    expect(container.textContent).toContain('Export fehlgeschlagen. Bitte erneut versuchen.');
    cleanUp();
  });

  it('indicates exporting state', () => {
    vi.spyOn(backupComposable, 'useBackupExport').mockReturnValue({
      exporting: ref(true),
      exportError: ref(''),
      exportBackup: mockExportBackup,
    });

    const { container, cleanUp } = mountComponent(AdminBackupCard);

    expect(container.textContent).toContain('Exportiere…');
    cleanUp();
  });
});
