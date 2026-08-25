import type { Meta, StoryObj } from '@storybook/vue3';
import Card from '../../components/primitives/Card.vue';

const meta: Meta = {
  title: 'Design Tokens/Grid & Layouts',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

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
          Nutzt CSS Grid (<code>display: grid; gap: var(--space-3)</code>) mit <code>repeat(auto-fit, minmax(260px, 1fr))</code> für gleichmäßige Kachel-Ansichten.
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
          Multi-Column Layout (<code>column-width: 260px; column-gap: var(--space-3)</code>) für Notizen & Karten unterschiedlicher Höhe. Verhindert unschöne vertikale Zeilen-Lücken.
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

export const LayoutGuidelines: Story = {
  render: () => ({
    setup() {
      const rules = [
        { title: '800px Breakpoint Standard', desc: 'Ab 800px schaltet die App vom mobilen Stack-/Bottom-Sheet-Modus auf das Desktop Multi-Column Layout um.' },
        { title: 'Gutters & Abstände', desc: 'Raster nutzen durchgehend --space-3 (16px mobil) und --space-3 bis --space-4 (24px Desktop) als Spalten- & Zeilenabstand.' },
        { title: 'Leerzustände (.empty)', desc: 'Leere Grids zeigen zentrierte Hinweise in var(--color-text-muted) mit mindestens --space-4 vertikalem Innenabstand.' },
      ];
      return { rules };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 700px;">
        <h2 style="margin: 0 0 8px;">Layout-Regeln & Prinzipien</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">Standards für Grid-Spalten, Responsivität und Abstände.</p>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div
            v-for="r in rules"
            :key="r.title"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <h4 style="margin: 0 0 6px; color: var(--color-primary-dark);">{{ r.title }}</h4>
            <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">{{ r.desc }}</p>
          </div>
        </div>
      </div>
    `,
  }),
};
