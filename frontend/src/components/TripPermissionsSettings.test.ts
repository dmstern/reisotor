// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TripPermissionsSettings from './TripPermissionsSettings.vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import type { Trip, User } from '../api/types';

describe('TripPermissionsSettings', () => {
  let pinia: ReturnType<typeof createPinia>;

  const mockTrip: Trip = {
    id: 10,
    name: 'Sommerurlaub Lissabon',
    destination: 'Lissabon',
    start_date: '2026-08-01',
    end_date: '2026-08-10',
    maps_link: null,
    image_url: null,
    packing_category_required: 1,
    weather_model: 'ecmwf_ifs025',
    lat: 38.72,
    lng: -9.14,
    owner_restricted: false,
  };

  const mockMembers: User[] = [
    { id: 1, username: 'alice', email: 'alice@example.com', avatar: '👩' },
    { id: 2, username: 'bob', email: 'bob@example.com', avatar: '👨' },
  ];

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);

    const authStore = useAuthStore();
    authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', avatar: '👩' };

    const tripStore = useTripStore();
    tripStore.trips = [mockTrip];

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/trips/10/members') {
        return mockMembers;
      }
      if (path.startsWith('/users/search')) {
        return [{ id: 3, username: 'charlie', email: 'charlie@example.com', avatar: '🧑' }];
      }
      return [];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountComponent(props: { tripId: number; trip?: Trip | null } = { tripId: 10 }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(TripPermissionsSettings, props),
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

  it('renders section title, members list, and search input', async () => {
    const { container, cleanUp } = mountComponent({ tripId: 10, trip: mockTrip });
    await nextTick();
    // Allow loadMembers promise to resolve
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.textContent).toContain('Aktuelle Mitglieder');
    expect(container.textContent).toContain('alice');
    expect(container.textContent).toContain('bob');
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
    cleanUp();
  });

  it('shows delete button only for other members, not for current user', async () => {
    const { container, cleanUp } = mountComponent({ tripId: 10, trip: mockTrip });
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    const deleteButtons = container.querySelectorAll('[aria-label="Mitglied entfernen"]');
    // Only 1 delete button (for bob, not alice who is current user)
    expect(deleteButtons.length).toBe(1);
    cleanUp();
  });

  it('shows restricted mode hint when member cap is reached for restricted owner', async () => {
    const restrictedTrip: Trip = {
      ...mockTrip,
      owner_restricted: true,
    };
    const threeMembers: User[] = [
      ...mockMembers,
      { id: 3, username: 'charlie', email: 'charlie@example.com', avatar: '🧑' },
    ];
    vi.spyOn(api, 'get').mockResolvedValueOnce(threeMembers);

    const { container, cleanUp } = mountComponent({ tripId: 10, trip: restrictedTrip });
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.textContent).toContain('Eingeschränkter Modus');
    expect(container.querySelector('input[type="search"]')).toBeNull();
    cleanUp();
  });
});
