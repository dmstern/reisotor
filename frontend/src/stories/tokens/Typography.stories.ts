import type { Meta, StoryObj } from '@storybook/vue3';
import _Badge from '../../components/primitives/Badge.vue';
import Kicker from '../../components/primitives/Kicker.vue';

const meta: Meta = {
  title: 'Design Tokens/Typography',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const TypographySystem: Story = {
  render: () => ({
    components: { Badge: _Badge, Kicker },
    setup() {
      const fontSizes = [
        {
          var: '--font-size-xs',
          val: '0.75rem (12px)',
          usage:
            'Pre-Heading Kicker, Badges, Captions, Timestamps, Formular-Meta, kompakte Kalender-/Nav-Labels',
        },
        {
          var: '--font-size-sm',
          val: '0.875rem (14px)',
          usage:
            'Sekundärtexte, .hint, kompakte Listen/Tabellen, size="sm" Controls, FormField-Labels',
        },
        {
          var: '--font-size-md',
          val: '1rem (16px)',
          usage: 'Standard-Fließtext (body, p), Standard-Inputs & Buttons (size="md"), h4',
        },
        {
          var: '--font-size-lg',
          val: '1.125rem (18px)',
          usage: 'h3 Gruppen-Titel, Card-Titel, Dialog-Titel',
        },
        {
          var: '--font-size-xl',
          val: '1.375rem (22px)',
          usage: 'h2 Sektions-Überschriften',
        },
        {
          var: '--font-size-2xl',
          val: '1.75rem (28px)',
          usage: 'h1 Haupt-Seitentitel (700 Bold, -0.01em Tracking)',
        },
      ];
      const lineHeights = [
        {
          var: '--line-height-none',
          val: '1',
          usage: 'Einzeilige Badges, Icons, Zähler, kompakte Pillen',
        },
        {
          var: '--line-height-tight',
          val: '1.2',
          usage: 'Überschriften (h1–h3), Kennzahlen, einzeilige Controls',
        },
        {
          var: '--line-height-snug',
          val: '1.35',
          usage:
            'Kompakte mehrzeilige UI-Texte (h4, Card-Titel/Subtitles, Listeneinträge, Alerts, Popovers, Toasts)',
        },
        {
          var: '--line-height-normal',
          val: '1.5',
          usage: 'Standard-Fließtext (body, p, Formular-Hinweise, Modal-Beschreibungen)',
        },
        {
          var: '--line-height-relaxed',
          val: '1.625',
          usage: 'Längerer Lesetext (Tagebuch-Einträge, Rich-Text-Notizen, Rechtliches)',
        },
      ];
      return { fontSizes, lineHeights };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Typografie & Semantische Textbausteine</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">Fira Sans Schriftfamilie (selbstgehostet) in allen Gewichten (400, 500, 600, 700) und Kursiv-Schnitten.</p>

        <!-- Semantische Textbausteine -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Semantische Textbausteine</h3>
        <div style="padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); margin-bottom: 32px;">
          <Kicker>Kicker / Pre-Heading Label</Kicker>
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
            <Kicker>Monospace & Code-Bausteine</Kicker>
            <p style="margin: 4px 0 0;">Code-Bausteine werden in dezentem <code style="padding: 2px 6px; background: var(--color-hover); border-radius: 4px;">code</code>-Span mit hellbepolstertem Hintergrund hervorgehoben.</p>
          </div>

          <div style="margin-top: 20px; display: flex; gap: 24px; flex-wrap: wrap;">
            <div>
              <Kicker style="display: block; margin-bottom: 4px;">Button-Label Typografie</Kicker>
              <button style="padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm-squircle); font-weight: 600; font-family: inherit; font-size: var(--font-size-sm);">Haupt-Button Text (600)</button>
            </div>
            <div>
              <Kicker style="display: block; margin-bottom: 4px;">Badge-Label Typografie</Kicker>
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
              <code style="font-size: var(--font-size-sm); font-weight: bold; color: var(--color-primary-dark);">{{ fs.var }}</code>
              <span style="font-size: var(--font-size-sm); color: var(--color-text-muted);">{{ fs.val }}</span>
            </div>
            <div :style="{ fontSize: 'var(' + fs.var + ')', fontWeight: 600, margin: '6px 0' }">
              Reisotor Reiseplanung & Ausflüge
            </div>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">{{ fs.usage }}</span>
          </div>
        </div>

        <!-- Zeilenhöhen-Skala -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Zeilenhöhen-Skala (--line-height-*)</h3>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
          <div
            v-for="lh in lineHeights"
            :key="lh.var"
            style="padding: 12px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <code style="font-size: var(--font-size-sm); font-weight: bold; color: var(--color-primary-dark);">{{ lh.var }}</code>
              <span style="font-size: var(--font-size-sm); color: var(--color-text-muted);">{{ lh.val }}</span>
            </div>
            <p
              :style="{
                lineHeight: 'var(' + lh.var + ')',
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text)',
                margin: '8px 0',
                maxWidth: '52ch',
              }"
            >
              Gemeinsame Reiseplanung mit Etappen, Ausflügen, Packlisten und Budget-Übersicht – so bleibt jeder Urlaubstag entspannt strukturiert.
            </p>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">{{ lh.usage }}</span>
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
