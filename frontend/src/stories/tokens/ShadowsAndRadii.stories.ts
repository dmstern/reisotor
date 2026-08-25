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
      const squircleRadii = [
        {
          var: '--radius-sm-squircle',
          px: '10px / 17.5px (Squircle)',
          usage: 'Kompakte Buttons, Chips, Badges & Inputs',
        },
        {
          var: '--radius-md-squircle',
          px: '16px / 28px (Squircle)',
          usage: 'Standard Cards, Panels & Modals',
        },
        {
          var: '--radius-lg-squircle',
          px: '26px / 45.5px (Squircle)',
          usage: 'Große Hero-Container & Fokus-Kacheln',
        },
        {
          var: '--radius-xl-squircle',
          px: '32px / 56px (Squircle)',
          usage: 'Modal-Dialoge, Bottom-Sheets & Schubladen',
        },
      ];

      const specialRadii = [
        {
          var: '--radius-pill',
          px: '9999px',
          shape: 'pill',
          usage: 'Ovale Pillen für CategoryChips, Badges, TabBar-Indikatoren & Filter-Toggles',
        },
        {
          var: '--radius-full',
          px: '50%',
          shape: 'circle',
          usage: 'Kreisrunde Elemente (Dashboard Tile Card Circle Icons, runde FAB Buttons)',
        },
      ];

      const shadows = [
        {
          var: '--shadow-sm',
          radius: 'var(--radius-md-squircle)',
          shape: 'squircle',
          usage: 'Standard Kartenschatten (weich, dezent)',
        },
        {
          var: '--shadow-md',
          radius: 'var(--radius-md-squircle)',
          shape: 'squircle',
          usage: 'Erhöhter Schatten für schwebende Panels, Modals & Hover',
        },
        {
          var: '--shadow-inset',
          radius: 'var(--radius-pill)',
          shape: 'pill',
          usage: 'Eingesenkter Rinnen-Schatten für taktile SegmentedToggle Tracks',
        },
        {
          var: '--shadow-pill-raised',
          radius: 'var(--radius-pill)',
          shape: 'pill',
          usage: 'Erhöhter Schatten für schwebende SegmentedToggle Thumbs & Pillen',
        },
      ];

      return { squircleRadii, specialRadii, shadows };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 800px;">
        <h2 style="margin: 0 0 8px;">Eckenrundung & Weiches Material</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          Squircle-Superellipsen (<code>corner-shape: squircle</code>), Pillen-Formen, Kreise und Schattierungs-Tokens.
        </p>

        <!-- 1. Squircle Superellipsen -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">1. Squircle-Superellipsen (corner-shape: squircle)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Karten, Buttons, Inputs und Modals setzen <code>corner-shape: squircle</code> für sanft geschwungene Superellipsen-Ecken statt geometrischer Kreisbögen.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div
            v-for="r in squircleRadii"
            :key="r.var"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; text-align: center;"
          >
            <div
              :style="{ width: '64px', height: '64px', background: 'var(--color-primary-tint)', border: '2px solid var(--color-primary)', borderRadius: 'var(' + r.var + ')', cornerShape: 'squircle', marginBottom: '10px' }"
            ></div>
            <code style="font-size: 0.78rem; font-weight: bold; color: var(--color-primary-dark);">{{ r.var }}</code>
            <span style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">{{ r.usage }}</span>
          </div>
        </div>

        <!-- 2. Pillen & Kreise -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">2. Pillen & Kreisrunde Elemente</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Pillen nutzen volle 9999px Rundung. Kreisrunde Icons & Action-Buttons nutzen 50% Radius mit 1:1 Seitenverhältnis.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div
            v-for="sr in specialRadii"
            :key="sr.var"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; text-align: center;"
          >
            <div
              v-if="sr.shape === 'pill'"
              :style="{ width: '110px', height: '40px', background: 'var(--color-primary-tint)', border: '2px solid var(--color-primary)', borderRadius: 'var(--radius-pill)', marginBottom: '10px' }"
            ></div>
            <div
              v-else
              :style="{ width: '48px', height: '48px', background: 'var(--color-primary-tint)', border: '2px solid var(--color-primary)', borderRadius: 'var(--radius-full)', marginBottom: '10px' }"
            ></div>
            <code style="font-size: 0.82rem; font-weight: bold; color: var(--color-primary-dark);">{{ sr.var }}</code>
            <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">{{ sr.usage }}</span>
          </div>
        </div>

        <!-- 3. Schatten & Soft Material -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">3. Schatten & Weiches Material (Soft Rounded Material)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Vorschau-Kacheln mit weicher Material-Eckenrundung (Squircle oder Pillen-Radius).
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px;">
          <div
            v-for="s in shadows"
            :key="s.var"
            style="padding: 20px; background: var(--color-surface); display: flex; flex-direction: column; align-items: center; text-align: center; border: 1px solid var(--color-border);"
            :style="{
              boxShadow: 'var(' + s.var + ')',
              borderRadius: s.radius,
              cornerShape: s.shape === 'squircle' ? 'squircle' : 'initial'
            }"
          >
            <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark); margin-bottom: 6px;">{{ s.var }}</code>
            <span style="font-size: 0.78rem; color: var(--color-text-muted);">{{ s.usage }}</span>
          </div>
        </div>
      </div>
    `,
  }),
};
