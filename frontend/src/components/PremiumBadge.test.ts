// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PremiumBadge from './PremiumBadge.vue';
import { useAccountTierModal } from '../composables/useAccountTierModal';

describe('PremiumBadge', () => {
  const { isOpen, highlightedFeature, closeAccountTierModal } = useAccountTierModal();

  beforeEach(() => {
    setActivePinia(createPinia());
    closeAccountTierModal();
    document.body.innerHTML = '';
  });

  function mountComponent(props = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(PremiumBadge, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders with default label Plus', () => {
    const { container, cleanUp } = mountComponent();
    expect(container.textContent).toContain('Plus');
    cleanUp();
  });

  it('renders with custom label', () => {
    const { container, cleanUp } = mountComponent({ label: 'Freigeschaltet' });
    expect(container.textContent).toContain('Freigeschaltet');
    cleanUp();
  });

  it('opens account tier modal with specified feature on click', () => {
    const { container, cleanUp } = mountComponent({ feature: 'uploads' });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    btn?.click();

    expect(isOpen.value).toBe(true);
    expect(highlightedFeature.value).toBe('uploads');
    cleanUp();
  });

  it('omits aria-label and title when rendered as span', () => {
    const { container, cleanUp } = mountComponent({ as: 'span' });
    const span = container.querySelector('.premium-badge');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('aria-label')).toBeNull();
    expect(span?.getAttribute('title')).toBeNull();
    cleanUp();
  });
});
