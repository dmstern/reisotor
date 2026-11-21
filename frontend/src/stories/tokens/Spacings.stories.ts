import type { Meta, StoryObj } from '@storybook/vue3';

const meta: Meta = {
  title: 'Design Tokens/Spacings',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const SpacingsScale: Story = {
  render: () => ({
    setup() {
      const spacings = [
        {
          var: '--space-2xs',
          px: '2px',
          alias: null,
          usage: 'Haarfeine Abstände (Inline-Dots, Badge-Close-Offset, Switch-Padding)',
        },
        {
          var: '--space-xs',
          px: '4px',
          alias: '--space-1',
          usage: 'Mikro-Abstände (Icon-Gaps, kompakte Badges, Chips, Button-Gap XS)',
        },
        {
          var: '--space-1-5',
          px: '6px',
          alias: null,
          usage: 'Enge Control-Gaps (--control-gap-sm), Listenaktions-Gaps',
        },
        {
          var: '--space-sm',
          px: '8px',
          alias: '--space-2',
          usage: 'Standard-Gap für dichte Flex-Zeilen (Formularfelder, Button-Gruppen)',
        },
        {
          var: '--space-md',
          px: '12px',
          alias: null,
          usage: 'Kompaktes Card-/Listen-Padding, Control-Padding, Drawer-Gap',
        },
        {
          var: '--space-lg',
          px: '16px',
          alias: '--space-3',
          usage: 'Standard Card-Padding, Modal-/Drawer-Padding (Mobil), Listen-Gaps',
        },
        {
          var: '--space-3-5',
          px: '20px',
          alias: null,
          usage: 'Übergangs-Abstand zwischen Standard- und Groß-Sektion',
        },
        {
          var: '--space-xl',
          px: '24px',
          alias: '--space-4',
          usage: 'Großzügiges Padding (Modals & Drawers Desktop), Sektions-Abstände',
        },
        {
          var: '--space-2xl',
          px: '32px',
          alias: '--space-5',
          usage: 'Große Trennabstände zwischen Hauptbereichen einer View',
        },
        {
          var: '--space-3xl',
          px: '48px',
          alias: '--space-6',
          usage: 'Maximale Außenabstände / Hero-Layouts',
        },
      ];
      return { spacings };
    },
    template: `
      <div style="padding: var(--space-lg); font-family: var(--font-sans);">
        <h2 style="margin: 0 0 var(--space-sm);">Abstände & Gaps (--space-2xs bis --space-3xl)</h2>
        <p style="color: var(--color-text-muted); margin-bottom: var(--space-xl);">10-stufige T-Shirt-Abstandsskala inkl. abwärtskompatibler Aliase (--space-1 bis --space-6) für konsistente Abstände über alle Ansichten.</p>

        <div style="display: flex; flex-direction: column; gap: var(--space-lg); max-width: 650px;">
          <div
            v-for="s in spacings"
            :key="s.var"
            style="padding: var(--space-md) var(--space-lg); border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm);">
              <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;">
                <code style="font-size: 0.9rem; font-weight: bold; color: var(--color-primary-dark);">{{ s.var }}</code>
                <span v-if="s.alias" style="font-size: 0.78rem; color: var(--color-text-muted);">(Alias: <code>{{ s.alias }}</code>)</span>
              </div>
              <span style="font-size: 0.85rem; font-weight: 600;">{{ s.px }}</span>
            </div>
            <div style="background: var(--color-hover); border-radius: 4px; padding: var(--space-xs); margin-bottom: var(--space-sm);">
              <div :style="{ width: 'var(' + s.var + ')', height: '12px', background: 'var(--color-primary)', borderRadius: '2px' }"></div>
            </div>
            <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-muted);">{{ s.usage }}</p>
          </div>
        </div>
      </div>
    `,
  }),
};
