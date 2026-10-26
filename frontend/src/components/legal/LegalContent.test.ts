// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import LegalContent from './LegalContent.vue';
import type { LegalConfig } from '../../api/types';
import { DEFAULT_LEGAL_CONFIG, DEMO_LEGAL_CONFIG } from '../../api/types';

describe('LegalContent', () => {
  function mountComponent(props: {
    config: LegalConfig;
    activeTab?: 'privacy' | 'imprint';
    isLandingPage?: boolean;
    showTabs?: boolean;
    loading?: boolean;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let currentTab = props.activeTab || 'privacy';

    const app = createApp({
      render: () =>
        h(LegalContent, {
          ...props,
          activeTab: currentTab,
          'onUpdate:activeTab': (tab: 'privacy' | 'imprint') => {
            currentTab = tab;
          },
        }),
    });

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

  it('renders privacy policy by default and shows warning when operator info is missing', () => {
    const { container, cleanUp } = mountComponent({ config: DEFAULT_LEGAL_CONFIG });

    expect(container.querySelector('h1')?.textContent).toContain('Datenschutzerklärung');
    expect(container.textContent).toContain('Betreiberangaben noch nicht konfiguriert');
    expect(container.textContent).toContain('LEGAL_OPERATOR_NAME');

    // OSM-Kacheln direkt & keine Cookies
    expect(container.textContent).toContain('tile.openstreetmap.org');
    expect(container.textContent).toContain('Art. 6 Abs. 1 lit. b DSGVO');
    expect(container.textContent).toContain('OpenStreetMap-Kachelserver setzen keine Cookies');

    // Wetter über Proxy
    expect(container.textContent).toContain('Open-Meteo');
    expect(container.textContent).toContain('GET /api/weather');
    expect(container.textContent).toContain('zwei Nachkommastellen');

    // Länderinfos & Reisehinweise
    expect(container.textContent).toContain('travel-advisory.info');
    expect(container.textContent).toContain('nominatim.openstreetmap.org/reverse');

    // Disclaimer
    expect(container.textContent).toContain('Mustervorlage');
    expect(container.textContent).toContain('keine Rechtsberatung');

    cleanUp();
  });

  it('does not flash unconfigured warning while loading is true', () => {
    const { container, cleanUp } = mountComponent({
      config: DEFAULT_LEGAL_CONFIG,
      loading: true,
    });

    expect(container.textContent).toContain('Lade Betreiberangaben');
    expect(container.textContent).not.toContain('Betreiberangaben noch nicht konfiguriert');

    cleanUp();
  });

  it('renders configured operator information when present', () => {
    const customConfig: LegalConfig = {
      operator: {
        name: 'Max Mustermann',
        address: 'Musterweg 5\n12345 Berlin',
        email: 'max@example.com',
        phone: '+49 123 456789',
      },
      hasOperatorInfo: true,
      services: {
        photonUrl: 'https://my-photon.local/api/',
        isCustomPhoton: true,
        nominatimEnabled: false,
        nominatimUrl: 'https://nominatim.openstreetmap.org/search',
        isCustomNominatim: false,
        orsConfigured: true,
        githubFeedbackConfigured: false,
        pushConfigured: false,
      },
      hostingLocation: 'München',
    };

    const { container, cleanUp } = mountComponent({ config: customConfig });

    expect(container.textContent).toContain('Max Mustermann');
    expect(container.textContent).toContain('max@example.com');
    expect(container.textContent).toContain('my-photon.local');
    expect(container.textContent).not.toContain('Betreiberangaben noch nicht konfiguriert');

    cleanUp();
  });

  it('renders Impressum tab with § 5 DDG and EUPL-1.2 license when activeTab is imprint', () => {
    const { container, cleanUp } = mountComponent({
      config: DEFAULT_LEGAL_CONFIG,
      activeTab: 'imprint',
    });

    expect(container.querySelector('h1')?.textContent).toContain('Impressum');
    expect(container.textContent).toContain('§ 5 Digitale-Dienste-Gesetz (DDG)');
    expect(container.textContent).toContain('Betreiberangaben nicht konfiguriert');
    expect(container.textContent).toContain('European Union Public Licence v. 1.2 (EUPL-1.2)');

    cleanUp();
  });

  it('renders contiguous section numbering on landing page without app-only sections', () => {
    const { container, cleanUp } = mountComponent({
      config: DEMO_LEGAL_CONFIG,
      isLandingPage: true,
    });

    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(headings).toEqual([
      '1. Überblick und Grundsätze',
      '2. Verantwortliche Stelle',
      '3. Server-Betrieb & Protokolldateien (Logfiles)',
      '4. Cookies & lokaler Speicher im Browser (§ 25 TDDDG)',
      '5. Deine Rechte als betroffene Person',
    ]);

    cleanUp();
  });

  it('renders GitHub Pages hosting notice when isLandingPage is true or hosted on GitHub Pages', () => {
    const { container, cleanUp } = mountComponent({
      config: DEMO_LEGAL_CONFIG,
      isLandingPage: false,
    });

    expect(container.textContent).toContain('GitHub Pages');
    expect(container.textContent).toContain('GitHub Inc.');
    expect(container.textContent).toContain('Daniel Morgenstern');
    expect(container.textContent).not.toContain('Betreiberangaben noch nicht konfiguriert');

    cleanUp();
  });
});
