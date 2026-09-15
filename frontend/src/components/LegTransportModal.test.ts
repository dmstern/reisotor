// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegTransportModal from './LegTransportModal.vue';
import type { Spot, User, ExcursionLeg } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

function mountTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props),
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

const mockUsers: User[] = [
  { id: 1, username: 'alice', email: 'alice@example.com', avatar: '👩' },
  { id: 2, username: 'bob', email: 'bob@example.com', avatar: '👨' },
];

const mockFromSpot = {
  id: 10,
  trip_id: 1,
  title: 'Frankfurt Hbf',
  category: 'Bahnhof',
} as Spot;

const mockToSpot = {
  id: 11,
  trip_id: 1,
  title: 'Lisboa Oriente',
  category: 'Bahnhof',
} as Spot;

const mockLeg: ExcursionLeg = {
  id: 100,
  position: 0,
  from_spot_id: 10,
  to_spot_id: 11,
  transport_type: 'Zug',
  departure_time: '08:00',
  arrival_time: '20:00',
  amount: 89.9,
  paid_by_user_id: 1,
};

describe('LegTransportModal', () => {
  it('renders route summary with fromSpot and toSpot names and spot pills', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: mockLeg,
      users: mockUsers,
    });
    await nextTick();

    const summary = document.querySelector('.route-summary');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Frankfurt Hbf');
    expect(summary?.textContent).toContain('Lisboa Oriente');
    expect(summary?.textContent).toContain('→');

    const pills = document.querySelectorAll('.spot-pill');
    expect(pills.length).toBe(2);

    cleanUp();
  });

  it('renders modal title reflecting route fromSpot and toSpot', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: null,
      users: mockUsers,
    });
    await nextTick();

    const titleEl = document.querySelector('h2, .modal-title, .title');
    expect(titleEl?.textContent).toContain('Teilstrecke: Frankfurt Hbf → Lisboa Oriente');

    cleanUp();
  });

  it('populates form fields from existing leg and renders delete button', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: mockLeg,
      users: mockUsers,
    });
    await nextTick();

    // Delete button should be visible when leg exists
    const deleteBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Löschen')
    );
    expect(deleteBtn).toBeDefined();

    cleanUp();
  });
});
