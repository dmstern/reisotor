import type { Meta, StoryObj } from '@storybook/vue3';

const meta: Meta = {
  title: 'Design Tokens/Shadows & Radii',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ShadowsAndRadiiSystem: Story = {
  render: () => ({
    setup() {
      const radii = [
        { var: '--radius-sm-squircle', px: '10px / 10px', usage: 'Kompakte Buttons, Chips, Badges & Inputs' },
        { var: '--radius-md-squircle', px: '16px / 16px', usage: 'Standard Cards, Panels & Dropdown-Menüs' },
        { var: '--radius-lg-squircle', px: '24px / 24px', usage: 'Große Hero-Container & Fokus-Kacheln' },
        { var: '--radius-xl-squircle', px: '32px / 32px', usage: 'Modal-Dialoge, Bottom-Sheets & Schubladen' },
      ];
      const shadows = [
        { var: '--shadow-sm', usage: 'Standard Kartenschatten (weich, dezent)' },
        { var: '--shadow-md', usage: 'Erhöhter Schatten für schwebende Panels & Hover' },
        { var: '--shadow-inset', usage: 'Eingesenkter Schatten für aktive Eingabefelder' },
        { var: '--shadow-pill-raised', usage: 'Erhöhter Schatten für schwebende Pillen & Toggles' },
      ];
      return { radii, shadows };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Eckenrundung & Schatten</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">Squircle-Prinzip (Superellipsen) und Schattierungs-Tokens.</p>

        <!-- Eckenrundung -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Eckenrundung & Squircle-Prinzip</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div
            v-for="r in radii"
            :key="r.var"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; text-align: center;"
          >
            <div
              :style="{ width: '70px', height: '70px', background: 'var(--color-primary-tint)', border: '2px solid var(--color-primary)', borderRadius: 'var(' + r.var + ')', cornerShape: 'squircle', marginBottom: '12px' }"
            ></div>
            <code style="font-size: 0.8rem; font-weight: bold; color: var(--color-primary-dark);">{{ r.var }}</code>
            <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">{{ r.usage }}</span>
          </div>
        </div>

        <!-- Schatten -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Schatten & Weiches Material</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px;">
          <div
            v-for="s in shadows"
            :key="s.var"
            style="padding: 20px; border-radius: var(--radius-md-squircle); background: var(--color-surface); display: flex; flex-direction: column; align-items: center; text-align: center;"
            :style="{ boxShadow: 'var(' + s.var + ')' }"
          >
            <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark); margin-bottom: 6px;">{{ s.var }}</code>
            <span style="font-size: 0.78rem; color: var(--color-text-muted);">{{ s.usage }}</span>
          </div>
        </div>
      </div>
    `,
  }),
};
