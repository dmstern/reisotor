// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import MapsAppPicker from './MapsAppPicker.vue';

describe('MapsAppPicker', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountPicker(props: Record<string, unknown> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(MapsAppPicker, {
          lat: 48.2082,
          lng: 16.3738,
          title: 'Stephansdom',
          ...props,
        }),
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

  it('renders trigger button and opens popover on click', async () => {
    const { container, cleanUp } = mountPicker();
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('In Maps-App öffnen');

    expect(document.querySelector('.maps-picker-menu')).toBeNull();

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const menu = document.querySelector('.maps-picker-menu');
    expect(menu).toBeTruthy();

    cleanUp();
  });

  it('contains Standard-Karten-App, Google Maps, Apple Maps, and OpenStreetMap links', async () => {
    const { container, cleanUp } = mountPicker();
    const button = container.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.maps-picker-menu a'));
    expect(links.length).toBe(4);

    // 1. Standard-Karten-App (generic OS link, no target="_blank" to prevent blank tabs on mobile)
    const genericLink = links.find((l) => l.textContent?.includes('Standard-Karten-App'));
    expect(genericLink).toBeTruthy();
    expect(genericLink?.getAttribute('target')).toBeNull();
    const href = genericLink?.getAttribute('href') ?? '';
    expect(href.startsWith('geo:') || href.startsWith('maps://')).toBe(true);
    expect(href).toContain('48.2082');
    expect(href).toContain('16.3738');

    // 2. Google Maps
    const googleLink = links.find((l) => l.textContent?.includes('Google Maps'));
    expect(googleLink).toBeTruthy();
    expect(googleLink?.getAttribute('target')).toBe('_blank');
    expect(googleLink?.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=48.2082,16.3738'
    );

    // 3. Apple Maps
    const appleLink = links.find((l) => l.textContent?.includes('Apple Maps'));
    expect(appleLink).toBeTruthy();
    expect(appleLink?.getAttribute('target')).toBe('_blank');
    expect(appleLink?.getAttribute('href')).toBe(
      'https://maps.apple.com/?ll=48.2082,16.3738&q=Stephansdom'
    );

    // 4. OpenStreetMap
    const osmLink = links.find((l) => l.textContent?.includes('OpenStreetMap'));
    expect(osmLink).toBeTruthy();
    expect(osmLink?.getAttribute('target')).toBe('_blank');
    expect(osmLink?.getAttribute('href')).toBe(
      'https://www.openstreetmap.org/?mlat=48.2082&mlon=16.3738#map=16/48.2082/16.3738'
    );

    cleanUp();
  });

  it('renders original link when mapsLink is provided', async () => {
    const { container, cleanUp } = mountPicker({
      mapsLink: 'https://example.com/original-link',
    });
    const button = container.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.maps-picker-menu a'));
    expect(links.length).toBe(5);

    const originalLink = links.find((l) => l.textContent?.includes('Ursprünglichen Link öffnen'));
    expect(originalLink).toBeTruthy();
    expect(originalLink?.getAttribute('href')).toBe('https://example.com/original-link');
    expect(originalLink?.getAttribute('target')).toBe('_blank');

    cleanUp();
  });

  it('closes popover when a link is clicked', async () => {
    const { container, cleanUp } = mountPicker();
    const button = container.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const firstLink = document.querySelector<HTMLAnchorElement>('.maps-picker-menu a');
    firstLink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(document.querySelector('.maps-picker-menu')).toBeNull();

    cleanUp();
  });
});
