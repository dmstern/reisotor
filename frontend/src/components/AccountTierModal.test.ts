// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AccountTierModal from './AccountTierModal.vue';
import { useAuthStore } from '../stores/auth';
import type { TierFeature } from '../composables/useAccountTierModal';
import type { User } from '../api/types';

function mountComponent(
  props: {
    modelValue: boolean;
    feature?: TierFeature | null;
    'onUpdate:modelValue'?: (val: boolean) => void;
  },
  initialUser?: Partial<User>
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const authStore = useAuthStore(pinia);
  if (initialUser) {
    authStore.user = initialUser as User;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(AccountTierModal, props),
  });
  app.use(pinia);
  app.mount(container);
  return {
    app,
    container,
    authStore,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('AccountTierModal component', () => {
  it('renders basis-account details when user is restricted', () => {
    const { cleanUp } = mountComponent(
      { modelValue: true },
      { id: 2, username: 'testuser', restricted: true }
    );

    expect(document.body.textContent).toContain('Basis-Konto');
    expect(document.body.textContent).toContain('eingeschränkten Basis-Modus');
    expect(document.body.textContent).toContain('Wie erhalte ich Reisotor Plus?');
    expect(document.body.textContent).toContain('Melde dich einfach kurz per Chat');
    cleanUp();
  });

  it('renders full access details when user is not restricted', () => {
    const { cleanUp } = mountComponent(
      { modelValue: true },
      { id: 1, username: 'vipuser', restricted: false }
    );

    expect(document.body.textContent).toContain('Plus');
    expect(document.body.textContent).toContain('Reisotor Plus');
    expect(document.body.textContent).not.toContain('Wie erhalte ich Reisotor Plus?');
    cleanUp();
  });

  it('renders feature notice and highlighted item when a specific feature is requested', () => {
    const { cleanUp } = mountComponent(
      { modelValue: true, feature: 'uploads' },
      { id: 2, username: 'testuser', restricted: true }
    );

    expect(document.body.textContent).toContain('Reisotor Plus erforderlich');
    expect(document.body.textContent).toContain('Datei- & Foto-Uploads');
    expect(document.body.querySelector('.feature-item.highlighted')).not.toBeNull();
    cleanUp();
  });
});
