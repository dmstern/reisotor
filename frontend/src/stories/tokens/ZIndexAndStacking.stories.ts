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
        { zIndex: 'z-index: 9999', name: 'Toasts & Offline Indicators', desc: 'App-weite Benachrichtigungen, PWA Update-Prompts & Offline-Hinweise.', color: '#c1503f' },
        { zIndex: 'z-index: 1000', name: 'Modals & Overlays (Modal.vue)', desc: 'Zentrierte Dialoge, Spot-Details & Bestätigungs-Modals.', color: '#e08e45' },
        { zIndex: 'z-index: 200', name: 'Drawers & Bottom-Sheets (Drawer.vue)', desc: 'Ausziehbare Schubladen auf Mobil & feste Seitenschubladen auf Desktop.', color: '#5b6ee1' },
        { zIndex: 'z-index: 100', name: 'Floating Action Buttons (FABs)', desc: 'Schwebende runde Bearbeiten-/Löschen-Buttons über Fotos & Karten.', color: '#2a7f74' },
        { zIndex: 'z-index: 10', name: 'Sticky Header & Nav (NavBar.vue)', desc: 'Obere Navigationsleiste & fixierte Kategorie-Filter.', color: '#3da296' },
        { zIndex: 'z-index: 1', name: 'Standard Content & Cards', desc: 'Fließtext, Kachel-Grids, Budget-Listen & Notizen.', color: 'var(--color-primary)' },
        { zIndex: 'z-index: 0', name: 'Base Canvas & Map (TripMap.vue)', desc: 'Interaktive OpenStreetMap / MapLibre Kartenfläche.', color: 'var(--color-text-muted)' },
      ];
      return { layers };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Z-Index Hierarchie & Layout Containment</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          Verbindliche Ebenen-Stapelung zur Vermeidung visueller Überlappungsfehler (gemäß DESIGN.md).
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
            <code :style="{ color: l.color, fontWeight: 'bold', background: 'var(--color-hover)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', whitespace: 'nowrap' }">
              {{ l.zIndex }}
            </code>
          </div>
        </div>
      </div>
    `,
  }),
};
