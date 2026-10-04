// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import TourRoleBadge from './TourRoleBadge.vue';

function mountBadge(props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const pinia = createPinia();
  const app = createApp({
    render: () => h(TourRoleBadge as unknown as Component, props),
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

describe('TourRoleBadge', () => {
  it('renders default Ausflug badge when no role is given', () => {
    const { container, cleanUp } = mountBadge();
    expect(container.textContent).toContain('Ausflug');
    expect(container.querySelector('.tour-type-badge')?.getAttribute('title')).toBe('Ausflug');
    cleanUp();
  });

  it('renders arrival badge when arrival role is passed', () => {
    const { container, cleanUp } = mountBadge({ role: 'arrival' });
    expect(container.textContent).toContain('Anreise');
    expect(container.querySelector('.tour-type-badge')?.getAttribute('title')).toBe('Anreise');
    cleanUp();
  });

  it('renders departure badge when departure role is passed', () => {
    const { container, cleanUp } = mountBadge({ role: 'departure' });
    expect(container.textContent).toContain('Abreise');
    expect(container.querySelector('.tour-type-badge')?.getAttribute('title')).toBe('Abreise');
    cleanUp();
  });

  it('renders onward badge when onward role is passed', () => {
    const { container, cleanUp } = mountBadge({ role: 'onward' });
    expect(container.textContent).toContain('Weiterreise');
    expect(container.querySelector('.tour-type-badge')?.getAttribute('title')).toBe('Weiterreise');
    cleanUp();
  });
});
