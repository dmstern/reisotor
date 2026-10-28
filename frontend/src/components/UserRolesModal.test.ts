// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import UserRolesModal from './UserRolesModal.vue';
import type { UserRole } from '../composables/useUserManagement';

function mountModal(props: {
  modelValue: boolean;
  initialRole?: UserRole | null;
  'onUpdate:modelValue'?: (val: boolean) => void;
}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(UserRolesModal, props),
  });
  app.use(pinia);
  app.mount(container);
  return {
    app,
    container,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('UserRolesModal component', () => {
  it('renders roles and comparison table when visible', () => {
    const { cleanUp } = mountModal({ modelValue: true });

    expect(document.body.textContent).toContain('Rollen & Berechtigungen');
    expect(document.body.textContent).toContain('Basis-Konto');
    expect(document.body.textContent).toContain('Plus');
    expect(document.body.textContent).toContain('Admin');
    expect(document.body.textContent).toContain('Eigene Urlaube anlegen');
    expect(document.body.textContent).toContain('Datei- & Foto-Uploads');
    expect(document.body.textContent).toContain('Benutzerverwaltung');

    cleanUp();
  });

  it('highlights the initial role column when passed', () => {
    const { cleanUp } = mountModal({ modelValue: true, initialRole: 'admin' });

    const highlighted = document.querySelectorAll('.is-highlighted');
    expect(highlighted.length).toBeGreaterThan(0);

    cleanUp();
  });

  it('emits update:modelValue false when close button is clicked', () => {
    const onUpdate = vi.fn();
    const { cleanUp } = mountModal({ modelValue: true, 'onUpdate:modelValue': onUpdate });

    const closeBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Schließen')
    );
    expect(closeBtn).toBeDefined();
    closeBtn?.click();

    expect(onUpdate).toHaveBeenCalledWith(false);

    cleanUp();
  });
});
