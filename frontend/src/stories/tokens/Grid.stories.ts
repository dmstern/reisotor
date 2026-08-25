import type { Meta, StoryObj } from '@storybook/vue3';
import Card from '../../components/primitives/Card.vue';

const meta: Meta = {
  title: 'Design Tokens/Grid & Page Layouts',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const PageContainerWidths: Story = {
  render: () => ({
    setup() {
      const containers = [
        { name: 'Standard Page (.page)', width: '960px', usage: 'Standard für einspaltige Lesbarkeit (Tagebuch, Notizen, Einstellungen, Dashboard)' },
        { name: 'Wide Page (Multi-Column)', width: '1400px', usage: 'Für breite Tabellen & mehrspaltige Übersichten (BudgetView, ListenView)' },
        { name: 'Full-Split Page (Karte + Split)', width: '1600px', usage: 'Maximale Desktop-Breite für Karte & Spot-Listen Split-Screen (ExcursionsView)' },
        { name: 'Breiter Dialog / Modal', width: '900px', usage: 'Formular-Modals & Fotocollagen-Overlays' },
        { name: 'Standard Dialog / Modal', width: '480px', usage: 'Bestätigungs-Dialoge, Bearbeiten-Modals (Modal.vue)' },
        { name: 'Auth / Login Card', width: '360px', usage: 'Kompakte Zentrierung für Login & Registrierungs-Karten' },
      ];
      return { containers };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 800px;">
        <h2 style="margin: 0 0 8px;">Page-Container & Breiten-System</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">
          Definition der maximalen Inhaltsbreiten (<code>max-width</code>) für Seiten, Modals und Dialoge.
        </p>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div
            v-for="c in containers"
            :key="c.name"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <strong style="color: var(--color-text);">{{ c.name }}</strong>
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark); background: var(--color-primary-tint); padding: 2px 8px; border-radius: 4px;">max-width: {{ c.width }}</code>
            </div>
            <div style="background: var(--color-hover); border-radius: 4px; height: 16px; padding: 3px; margin-bottom: 8px; width: 100%;">
              <div :style="{ width: 'min(100%, ' + (parseInt(c.width) / 16) + '%)', height: '100%', background: 'var(--color-primary)', borderRadius: '2px' }"></div>
            </div>
            <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-muted);">{{ c.usage }}</p>
          </div>
        </div>
      </div>
    `,
  }),
};

export const DesktopVsMobileSplit: Story = {
  render: () => ({
    setup() {
      return {};
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 800px;">
        <h2 style="margin: 0 0 8px;">Layout-Spalten & 800px Breakpoint</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">
          De-facto Standard der App: <strong>800px Breakpoint</strong> unterscheidet zwischen der mobilen Ansicht und dem Desktop-Layout.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
          <!-- Mobil (< 800px) -->
          <div style="padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <h3 style="margin: 0; font-size: 1.05rem; color: var(--color-primary-dark);">📱 Mobil (&lt; 800px)</h3>
              <code style="font-size: 0.75rem;">max-width: 799px</code>
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 0.85rem; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 8px;">
              <li><strong>1-Spalten-Stapel:</strong> Inhalte werden vertikal untereinander gestapelt.</li>
              <li><strong>Bottom-Sheet Drawer:</strong> Schubladen und Filter-Panels schieben sich von unten ins Bild.</li>
              <li><strong>Bottom TabBar:</strong> Haupt-Navigation fixiert am unteren Bildschirmrand.</li>
              <li><strong>Spot & Karten-View:</strong> Vollbild-Karte mit ausziehbarem Bottom-Sheet.</li>
            </ul>
          </div>

          <!-- Desktop (>= 800px) -->
          <div style="padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <h3 style="margin: 0; font-size: 1.05rem; color: var(--color-primary-dark);">🖥️ Desktop (&ge; 800px)</h3>
              <code style="font-size: 0.75rem;">min-width: 800px</code>
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 0.85rem; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 8px;">
              <li><strong>Multi-Column Grids:</strong> Automatische 2- bis 4-spaltige Kachelraster (.grid / .cards).</li>
              <li><strong>Feste Seitenschubladen:</strong> Seitliche Sidebar-Drawer verbleiben fest an den Rändern.</li>
              <li><strong>Top Header NavBar:</strong> Sticky Navigationsleiste am oberen Bildschirmrand.</li>
              <li><strong>Split-Screen Karten-View:</strong> Interaktive Karte fest auf 50% Breite neben der Spot-Liste.</li>
            </ul>
          </div>
        </div>
      </div>
    `,
  }),
};

export const AutoFitGrid: Story = {
  render: () => ({
    components: { Card },
    setup() {
      const cards = [
        { title: 'Spot 1: Elafonisi Strand 🏖️', desc: 'Rosafarbener Sandstrand mit kristallklarem Wasser.' },
        { title: 'Spot 2: Samaria Schlucht 🥾', desc: '16 km lange Wanderung durch Kretas spektakulärste Schlucht.' },
        { title: 'Spot 3: Balos Lagune 🛥️', desc: 'Malerische Bucht mit türkisblauem Flachwasser.' },
        { title: 'Spot 4: Knossos Palast 🏛️', desc: 'Minoische Palastanlage nahe Heraklion.' },
      ];
      return { cards };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans);">
        <h2 style="margin: 0 0 8px;">Responsive Auto-Fit Grid (.grid)</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 20px;">
          Nutzt CSS Grid (<code>display: grid; gap: var(--space-3)</code>) mit <code>repeat(auto-fit, minmax(240px, 1fr))</code> für gleichmäßige Kachel-Ansichten.
        </p>

        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
          <Card v-for="(c, i) in cards" :key="i">
            <h4 style="margin: 0 0 4px;">{{ c.title }}</h4>
            <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">{{ c.desc }}</p>
          </Card>
        </div>
      </div>
    `,
  }),
};

export const MasonryLayout: Story = {
  render: () => ({
    components: { Card },
    setup() {
      const notes = [
        { title: 'Wichtige Dokumente 📄', text: 'Reisepässe, Buchungsbestätigungen & Mietwagen-Voucher im Handgepäck aufbewahren.' },
        { title: 'Packliste Notiz 🧳', text: 'Sonnencreme LSF 50, Schnorchelausrüstung, Wanderschuhe & Reiseapotheke nicht vergessen.' },
        { title: 'Mietwagen Abhebung 🚗', text: 'Termin am Flughafen um 14:30 Uhr. Kautionskreditkarte bereithalten.' },
        { title: 'Restaurant Tipp 🍷', text: 'Taverna Sunset in Chania reservieren – super Ausblick aufs Meer!' },
        { title: 'Notfallnummern 🚑', text: '112 Notruf, ADAC Auslandsschutz, Reiseversicherung Polizzennummer.' },
      ];
      return { notes };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans);">
        <h2 style="margin: 0 0 8px;">Masonry Layout (.masonry)</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 20px;">
          Multi-Column Layout (<code>column-width: 240px; column-gap: var(--space-3)</code>) für Notizen & Karten unterschiedlicher Höhe. Verhindert unschöne vertikale Zeilen-Lücken.
        </p>

        <div class="masonry" style="column-width: 240px;">
          <Card v-for="(n, i) in notes" :key="i" variant="muted" style="margin-bottom: 16px; break-inside: avoid;">
            <h4 style="margin: 0 0 6px;">{{ n.title }}</h4>
            <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">{{ n.text }}</p>
          </Card>
        </div>
      </div>
    `,
  }),
};
