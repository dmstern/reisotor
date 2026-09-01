import type { Meta, StoryObj } from '@storybook/vue3';
import _Badge from '../../components/primitives/Badge.vue';

const meta: Meta = {
  title: 'Design Tokens/Typography',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const TypographySystem: Story = {
  render: () => ({
    setup() {
      const fontSizes = [
        {
          var: '--font-size-xs',
          val: '0.75rem (12px)',
          usage: 'Pre-Heading Kicker, Badges, Formular-Meta & Labels',
        },
        {
          var: '--font-size-sm',
          val: '0.85rem (13.6px)',
          usage: 'Sekundärtexte, Card-Actions (.card-action-btn), Hinweise',
        },
        {
          var: '--font-size-md',
          val: '1rem (16px)',
          usage: 'Standard Fließtext, Text-Inputs, Haupt-Buttons',
        },
        {
          var: '--font-size-lg',
          val: '1.15rem (18.4px)',
          usage: 'H3 Überschriften, Subheadings, Dialog-Titel',
        },
        {
          var: '--font-size-xl',
          val: '1.3rem (20.8px)',
          usage: 'H2 Sektions-Überschriften, Kachel-Titel',
        },
        {
          var: '--font-size-2xl',
          val: '1.6rem (25.6px)',
          usage: 'H1 Haupt-Seitentitel (700 Bold, -0.01em Tracking)',
        },
      ];
      return { fontSizes };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Typografie & Semantische Textbausteine</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">Fira Sans Schriftfamilie (selbstgehostet) in allen Gewichten (400, 500, 600, 700) und Kursiv-Schnitten.</p>

        <!-- Semantische Textbausteine -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Semantische Textbausteine</h3>
        <div style="padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); margin-bottom: 32px;">
          <span class="kicker">Kicker / Pre-Heading Label</span>
          <h1 style="margin-bottom: 12px;">H1 Seitentitel (700 Bold, -0.01em Tracking)</h1>
          <h2 style="margin-bottom: 10px;">H2 Sektions-Überschrift (600 Semi-Bold)</h2>
          <h3 style="margin-bottom: 8px;">H3 Kompakter Gruppen-Titel (600 Semi-Bold)</h3>
          <h4 style="margin-bottom: 12px;">H4 Subheading / Unterüberschrift (600 Semi-Bold)</h4>

          <p style="margin-top: 16px; margin-bottom: 12px;">
            Standard-Fließtext (<code>p</code>) in gedämpfter Schriftfarbe (<code>var(--color-text-muted)</code>). Text kann <strong>fett hervorgehoben (700)</strong>, <em>kursiv betont (400 Italic)</em> oder <strong><em>fett-kursiv kombiniert (700 Italic)</em></strong> dargestellt werden.
          </p>

          <p class="hint" style="margin-bottom: 16px;">
            <strong>Hinweistext (.hint / .muted):</strong> Dezenter Erklärtext für Formulare oder Seiten-Einleitungen mit sichtbarem Freiraum nach unten.
          </p>

          <div style="margin-top: 20px;">
            <span class="kicker">Monospace & Code-Bausteine</span>
            <p style="margin: 4px 0 0;">Code-Bausteine werden in dezentem <code style="padding: 2px 6px; background: var(--color-hover); border-radius: 4px;">code</code>-Span mit hellbepolstertem Hintergrund hervorgehoben.</p>
          </div>

          <div style="margin-top: 20px; display: flex; gap: 24px; flex-wrap: wrap;">
            <div>
              <span class="kicker" style="display: block; margin-bottom: 4px;">Button-Label Typografie</span>
              <button style="padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm-squircle); font-weight: 600; font-family: inherit; font-size: 0.9rem;">Haupt-Button Text (600)</button>
            </div>
            <div>
              <span class="kicker" style="display: block; margin-bottom: 4px;">Badge-Label Typografie</span>
              <Badge variant="primary">Primary Badge Text (600)</Badge>
            </div>
          </div>
        </div>

        <!-- Schriftgrößen-Skala -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Schriftgrößen-Skala (--font-size-*)</h3>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
          <div
            v-for="fs in fontSizes"
            :key="fs.var"
            style="padding: 12px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark);">{{ fs.var }}</code>
              <span style="font-size: 0.8rem; color: var(--color-text-muted);">{{ fs.val }}</span>
            </div>
            <div :style="{ fontSize: 'var(' + fs.var + ')', fontWeight: 600, margin: '6px 0' }">
              Reisotor Reiseplanung & Ausflüge
            </div>
            <span style="font-size: 0.78rem; color: var(--color-text-muted);">{{ fs.usage }}</span>
          </div>
        </div>

        <!-- Fira Sans Gewichte & Schnitte -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Fira Sans Schriftgewichte & Schnitte</h3>
        <div style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 400;">Fira Sans 400 Regular – Normaler Fließtext & Absätze</div>
          <div style="font-weight: 400; font-style: italic;">Fira Sans 400 Italic – Kursiver Text & Zitate</div>
          <div style="font-weight: 500;">Fira Sans 500 Medium – Dezent betonte Formularfeld-Labels</div>
          <div style="font-weight: 600;">Fira Sans 600 Semi-Bold – Buttons, Badges, H2/H3 Überschriften</div>
          <div style="font-weight: 700;">Fira Sans 700 Bold – H1 Seitentitel & prägnante Kacheln</div>
        </div>
      </div>
    `,
  }),
};
