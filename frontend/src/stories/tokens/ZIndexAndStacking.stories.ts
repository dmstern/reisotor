import type { Meta, StoryObj } from '@storybook/vue3';

const meta: Meta = {
  title: 'Design Tokens/Z-Index & Stacking',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ZIndexHierarchy: Story = {
  render: () => ({
    setup() {
      const layers = [
        {
          token: '--z-toast',
          zIndex: '9999',
          name: 'Toasts & Offline Indicators',
          desc: 'App-weite Benachrichtigungen, PWA Update-Prompts & Offline-Hinweise.',
          color: '#c1503f',
        },
        {
          token: '--z-popover',
          zIndex: '1100',
          name: 'Freistehende Popovers & Tooltips',
          desc: 'Ungebundene Kontext-Tooltips über Modals.',
          color: '#d97706',
        },
        {
          token: '--z-modal',
          zIndex: '1000',
          name: 'Modals & Overlays (Modal.vue)',
          desc: 'Zentrierte Dialoge, Spot-Details & Bestätigungs-Modals.',
          color: '#e08e45',
        },
        {
          token: '--z-dropdown',
          zIndex: '500',
          name: 'Dropdowns & Picker (PickerMenu.vue)',
          desc: 'Ausklappmenüs, Autocomplete-Listen und Datumsauswahlen.',
          color: '#7c3aed',
        },
        {
          token: '--z-drawer',
          zIndex: '200',
          name: 'Drawers & Bottom-Sheets (Drawer.vue)',
          desc: 'Ausziehbare Schubladen auf Mobil & feste Seitenschubladen auf Desktop.',
          color: '#5b6ee1',
        },
        {
          token: '--z-fab',
          zIndex: '120',
          name: 'Floating Action Buttons (FABs)',
          desc: 'Schwebende runde Bearbeiten-/Löschen-Buttons über Fotos & Karten.',
          color: '#9141AC',
        },
        {
          token: '--z-header',
          zIndex: '110',
          name: 'AppHeader (AppHeader.vue)',
          desc: 'Fixierte obere Headerleiste mit Titel, Kalender und Aktionen.',
          color: '#a21caf',
        },
        {
          token: '--z-nav',
          zIndex: '100',
          name: 'Floating Bottom Nav (NavBar.vue)',
          desc: 'Schwebende untere Hauptnavigationsleiste auf Mobil & Desktop.',
          color: '#c061cb',
        },
        {
          token: '--z-sticky',
          zIndex: '10',
          name: 'In-Page Sticky Filter (category-nav)',
          desc: 'Fixierte Kategorie- und Tag-Filterleisten beim Scrollen.',
          color: '#0284c7',
        },
        {
          token: '--z-card',
          zIndex: '1',
          name: 'Standard Content & Cards (Card.vue)',
          desc: 'Fließtext, Kachel-Grids, Budget-Listen & Notizen (Hover/Focus: 5, Map-Focus: 6).',
          color: 'var(--color-primary)',
        },
        {
          token: '--z-canvas',
          zIndex: '0',
          name: 'Base Canvas & Map (TripMap.vue)',
          desc: 'Interaktive OpenStreetMap / MapLibre Kartenfläche.',
          color: 'var(--color-text-muted)',
        },
      ];
      return { layers };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Z-Index Hierarchie & Layout Containment</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          Verbindliche Ebenen-Stapelung zur Vermeidung visueller Überlappungsfehler (gemäß DESIGN.md und style.css Tokens).
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div
            v-for="l in layers"
            :key="l.zIndex"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between; gap: 16px;"
          >
            <div>
              <strong style="color: var(--color-text); font-size: 1rem; display: block; margin-bottom: 4px;">{{ l.name }}</strong>
              <span style="font-size: 0.82rem; color: var(--color-text-muted);">{{ l.desc }}</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <code style="color: var(--color-primary); font-size: 0.75rem; background: var(--color-hover); padding: 2px 6px; border-radius: 4px;">{{ l.token }}</code>
              <code :style="{ color: l.color, fontWeight: 'bold', background: 'var(--color-hover)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', whitespace: 'nowrap' }">
                z-index: {{ l.zIndex }}
              </code>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
};
