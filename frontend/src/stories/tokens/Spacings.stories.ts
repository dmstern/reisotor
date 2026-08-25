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
          var: '--space-1',
          px: '4px',
          usage: 'Mikro-Abstände (Icon-Gaps, Badges, Chips, Button-Gap)',
        },
        {
          var: '--space-2',
          px: '8px',
          usage: 'Standard-Gap für dichte Flex-Zeilen (Formularfelder, Button-Gruppen)',
        },
        {
          var: '--space-3',
          px: '16px',
          usage: 'Standard Card-Padding (Mobil), Listen-Gaps, Fließtext-Abstand',
        },
        {
          var: '--space-4',
          px: '24px',
          usage: 'Großzügiges Card-Padding (Desktop), Dialoge, Sektions-Abstände',
        },
        {
          var: '--space-5',
          px: '32px',
          usage: 'Große Trennabstände zwischen Hauptbereichen einer View',
        },
        { var: '--space-6', px: '48px', usage: 'Maximale Außenabstände / Hero-Layouts' },
      ];
      return { spacings };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans);">
        <h2 style="margin: 0 0 8px;">Abstände & Gaps (--space-1 bis --space-6)</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">Gestufte Layout-Abstände für konsistente Abstände über alle Ansichten.</p>

        <div style="display: flex; flex-direction: column; gap: 16px; max-width: 650px;">
          <div
            v-for="s in spacings"
            :key="s.var"
            style="padding: 12px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <code style="font-size: 0.9rem; font-weight: bold; color: var(--color-primary-dark);">{{ s.var }}</code>
              <span style="font-size: 0.85rem; font-weight: 600;">{{ s.px }}</span>
            </div>
            <div style="background: var(--color-hover); border-radius: 4px; padding: 4px; margin-bottom: 8px;">
              <div :style="{ width: s.px, height: '12px', background: 'var(--color-primary)', borderRadius: '2px' }"></div>
            </div>
            <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-muted);">{{ s.usage }}</p>
          </div>
        </div>
      </div>
    `,
  }),
};
