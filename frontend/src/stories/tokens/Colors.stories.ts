import type { Meta, StoryObj } from '@storybook/vue3';

const meta: Meta = {
  title: 'Design Tokens/Colors',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ColorPalette: Story = {
  render: () => ({
    setup() {
      const colorGroups = [
        {
          name: 'Oberflächen & Ränder',
          tokens: [
            { var: '--color-bg', name: 'Hintergrund', light: '#faf8f5', dark: '#181715' },
            { var: '--color-surface', name: 'Karten & Panels', light: '#ffffff', dark: '#232220' },
            { var: '--color-border', name: 'Standard-Rand', light: '#e8e2d9', dark: '#38352f' },
            { var: '--color-border-strong', name: 'Feld-Rand', light: '#d5cabc', dark: '#4a453c' },
            { var: '--color-text', name: 'Text Haupt', light: '#2b2a28', dark: '#f2efe9' },
            { var: '--color-text-muted', name: 'Text Gedämpft', light: '#726e66', dark: '#a8a29a' },
          ],
        },
        {
          name: 'Marke & Steuerung',
          tokens: [
            { var: '--color-primary', name: 'Marken-Grün', light: '#2a7f74', dark: '#3da296' },
            { var: '--color-primary-dark', name: 'Hover-Grün', light: '#1f6059', dark: '#7dd0c1' },
            {
              var: '--color-primary-tint',
              name: 'Leichter Grünton',
              light: '#eaf3f1',
              dark: '#1c2e2a',
            },
            { var: '--color-hover', name: 'Hover-Fläche', light: '#f4f1ec', dark: '#2a2823' },
          ],
        },
        {
          name: 'Akzente & Status',
          tokens: [
            { var: '--color-accent', name: 'Echtzeit-Update', light: '#e08e45', dark: '#f0a05a' },
            { var: '--color-danger', name: 'Gefahr / Warnung', light: '#c1503f', dark: '#e0685a' },
            { var: '--color-success', name: 'Erfolgs-Status', light: '#3f8f5c', dark: '#5cb37e' },
            {
              var: '--color-scheduled',
              name: 'Geplante Termine',
              light: '#1e96d1',
              dark: '#52b8ea',
            },
            {
              var: '--color-highlight',
              name: 'Notiz-Highlight',
              light: '#fff4e8',
              dark: '#332a1c',
            },
            {
              var: '--color-accent-secondary',
              name: 'Indigo-Akzent',
              light: '#5b6ee1',
              dark: '#8b98f0',
            },
          ],
        },
      ];
      return { colorGroups };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans);">
        <h2 style="margin: 0 0 8px;">Farbpalette & CSS-Tokens</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">Zentrale CSS-Farbtokens (Light & Dark Mode automatisch angepasst).</p>

        <div v-for="group in colorGroups" :key="group.name" style="margin-bottom: 28px;">
          <h3 style="margin-bottom: 12px; font-size: 1.1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">{{ group.name }}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
            <div
              v-for="t in group.tokens"
              :key="t.var"
              style="border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); overflow: hidden; background: var(--color-surface); box-shadow: var(--shadow-sm);"
            >
              <div :style="{ background: 'var(' + t.var + ')', height: '60px' }"></div>
              <div style="padding: 10px 12px; font-size: 0.85rem;">
                <strong style="display: block;">{{ t.name }}</strong>
                <code style="font-size: 0.75rem; color: var(--color-primary-dark);">{{ t.var }}</code>
                <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">
                  Light: {{ t.light }} | Dark: {{ t.dark }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
};
