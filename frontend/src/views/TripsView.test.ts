// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TripsView from './TripsView.vue';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useAccountTierModal } from '../composables/useAccountTierModal';
import type { Trip, User } from '../api/types';

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
    }),
  };
});

describe('TripsView', () => {
  const { isOpen, highlightedFeature, closeAccountTierModal } = useAccountTierModal();

  beforeEach(() => {
    closeAccountTierModal();
    document.body.innerHTML = '';
  });

  const mockTrip: Trip = {
    id: 1,
    name: 'Sommer 2026',
    destination: 'Italien',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    maps_link: null,
    image_url: null,
    packing_category_required: 0,
    weather_model: 'ecmwf_ifs025',
    lat: 41.9,
    lng: 12.5,
    owner_restricted: false,
  };

  function mountComponent(initialUser?: Partial<User>, trips: Trip[] = []) {
    const pinia = createPinia();
    setActivePinia(pinia);

    const authStore = useAuthStore(pinia);
    authStore.user = (initialUser ?? {
      id: 1,
      username: 'tester',
      restricted: false,
    }) as unknown as User;

    const tripStore = useTripStore(pinia);
    tripStore.trips = trips;
    tripStore.loaded = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(TripsView),
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

  it('renders "Neuer Urlaub" with Premium badge for restricted user with existing trip and opens modal on click', async () => {
    const { container, cleanUp } = mountComponent(
      { id: 2, username: 'restricted', restricted: true },
      [mockTrip]
    );
    await nextTick();

    expect(container.textContent).toContain('Neuer Urlaub');
    expect(container.textContent).toContain('Premium');

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Neuer Urlaub')
    );
    expect(button).toBeDefined();
    button?.click();

    expect(isOpen.value).toBe(true);
    expect(highlightedFeature.value).toBe('trips');

    cleanUp();
  });
});
