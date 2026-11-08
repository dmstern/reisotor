// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SettingsNotificationsTab from './SettingsNotificationsTab.vue';
import { useNotificationPreferencesStore } from '../../stores/notificationPreferences';

// Mock Web Push detection so push is supported in test environment
vi.mock('../../utils/push', () => ({
  isPushSupported: vi.fn(() => true),
  getExistingSubscription: vi.fn(async () => null),
  subscribeToPush: vi.fn(async () => ({})),
  unsubscribeFromPush: vi.fn(async () => {}),
}));

// Mock api client
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === '/push/preferences') {
        return {
          schedule: true,
          members: true,
          departure: true,
          version: true,
          budget: true,
          ideas: true,
          spots: true,
          diary: true,
          notes: true,
          packing: false,
          shopping: false,
          todos: false,
          activity_updates: true,
        };
      }

      if (url === '/notifications/email-preferences') {
        return {
          schedule: false,
          members: false,
          departure: false,
          version: false,
          budget: false,
          ideas: false,
          spots: false,
          diary: false,
          notes: false,
          packing: false,
          shopping: false,
          todos: false,
        };
      }

      return {};
    }),
    put: vi.fn(async (_url: string, data: unknown) => data),
  },
}));

describe('SettingsNotificationsTab', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function mountComponent() {
    app = createApp(
      defineComponent({
        render: () => h(SettingsNotificationsTab),
      })
    );
    app.use(createPinia());
    app.mount(container);
  }

  it('zeigt den Toggle an und ersetzt ihn bei "Aus" nicht durch einen Aktivieren-Button', async () => {
    mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    // Keine "Aktivieren"-Buttons
    const buttons = Array.from(container.querySelectorAll('button'));
    const activateButton = buttons.find((b) => b.textContent?.includes('Aktivieren'));
    expect(activateButton).toBeUndefined();

    // SegmentedToggle für Push ist vorhanden
    const toggles = container.querySelectorAll('.segmented-toggle');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('deaktiviert die Push-Einstellungen bei deaktiverten Push-Benachrichtigungen ("Aus")', async () => {
    mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    // Push-Scope und Push-Spalte sind ausgegraut/disabled
    const scopeSection = container.querySelector('.push-scope-section');
    expect(scopeSection?.classList.contains('is-disabled')).toBe(true);

    const pushCheckbox = container.querySelector(
      '#push-domain-schedule'
    ) as HTMLInputElement | null;
    expect(pushCheckbox?.disabled).toBe(true);

    // E-Mail-Checkbox bleibt dabei aktiv
    const emailCheckbox = container.querySelector(
      '#email-domain-schedule'
    ) as HTMLInputElement | null;
    expect(emailCheckbox?.disabled).toBe(false);
  });

  it('erlaubt das Umschalten von E-Mail-Präferenzen unabhängig von Push', async () => {
    mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    const emailCheckbox = container.querySelector('#email-domain-schedule') as HTMLInputElement;
    expect(emailCheckbox.checked).toBe(false);

    emailCheckbox.checked = true;
    emailCheckbox.dispatchEvent(new Event('change'));
    await nextTick();

    const store = useNotificationPreferencesStore();
    expect(store.emailPreferences?.schedule).toBe(true);
  });
});
