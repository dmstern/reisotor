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
          usage: 'Sub-Boxen (surface-sunken-box), Inset-Container & kleine Popovers',
        },
        {
          var: '--radius-md-squircle',
          px: '16px / 28px (Squircle)',
          usage: 'Standard-Cards, Panels, Popover- & Dropdown-Menüs (PickerMenu)',
        },
        {
          var: '--radius-lg-squircle',
          px: '22px / 38.5px (Squircle)',
          usage: 'Drawers, Bottom-Sheets & große Panels',
        },
        {
          var: '--radius-xl-squircle',
          px: '28px / 49px (Squircle)',
          usage: 'Modals, Page-Overlays & Hero-Container',
        },
      ];

      const roundRadii = [
        {
          var: '--radius-2xs',
          px: '4px',
          usage: 'Mikro-Elemente, <code> & kleine Inline-Tags',
        },
        {
          var: '--radius-xs',
          px: '6px',
          usage: 'Sehr kleine Flächen, Mini-Boxen & Checkboxes',
        },
        {
          var: '--control-radius-xs',
          px: '6px',
          usage: 'Buttons (xs, 30px) & CopyButton',
        },
        {
          var: '--control-radius-sm',
          px: '8px',
          usage: 'Controls (sm, 36px) & Menüpunkte (DropdownMenuItem)',
        },
        {
          var: '--control-radius-md',
          px: '10px',
          usage: 'Standard-Controls (md, 46px): Buttons, Inputs, Selects, Dropdown-Trigger',
        },
        {
          var: '--control-radius-lg',
          px: '12px',
          usage: 'Große Controls (lg, 52px): Buttons, Inputs & Selects',
        },
      ];

      const specialRadii = [
        {
          var: '--radius-pill',
          px: '9999px',
          shape: 'pill',
          usage: 'Pillen für CategoryChips, Badges, TabBar-Indikatoren & Filter-Toggles',
        },
        {
          var: '--radius-full',
          px: 'var(--radius-pill) (9999px)',
          shape: 'circle',
          usage:
            'Kreise (Dashboard Tile Icons, FABs) & Alias für --radius-pill (verhindert ovale Eier)',
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
        {
          var: '--shadow-floating-island',
          radius: 'var(--radius-pill)',
          shape: 'pill',
          usage:
            'Einheitlicher Glass-Elevation-Schatten für schwebende Inseln (Header-Pills, Floating-NavBar)',
        },
      ];

      return { squircleRadii, roundRadii, specialRadii, shadows };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 800px;">
        <h2 style="margin: 0 0 8px;">Eckenrundung & Weiches Material</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          Differenzierte Radien-Hierarchie: Squircle-Superellipsen (<code>corner-shape: squircle</code>) für Container ab 10px, klassisch runde Ecken für Controls und kleine Elemente, Pillen/Kreise sowie Schattierungs-Tokens.
        </p>

        <!-- 1. Squircle Superellipsen -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">1. Squircle-Superellipsen (Container ab ≥ 10px)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Cards, Modals, Drawers, Sub-Boxen und Menüs setzen <code>corner-shape: squircle</code> kombiniert mit <code>--radius-*-squircle</code> für sanft geschwungene Superellipsen-Ecken.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div
            v-for="r in squircleRadii"
            :key="r.var"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); corner-shape: squircle; background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; text-align: center;"
          >
            <div
              :style="{ width: '64px', height: '64px', background: 'var(--color-primary-tint)', border: '2px solid var(--color-primary)', borderRadius: 'var(' + r.var + ')', cornerShape: 'squircle', marginBottom: '10px' }"
            ></div>
            <code style="font-size: 0.78rem; font-weight: bold; color: var(--color-primary-dark);">{{ r.var }}</code>
            <span style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 2px;">{{ r.px }}</span>
            <span style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">{{ r.usage }}</span>
          </div>
        </div>

        <!-- 2. Klassisch runde Ecken (Controls & kleine Elemente) -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">2. Klassisch runde Ecken (Controls & Mikro-Elemente)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Interaktive Controls (Buttons, Inputs, Selects, Menüpunkte) und kleine Elemente (&lt; 10px) nutzen klassische Kreisbögen ohne <code>corner-shape: squircle</code>.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div
            v-for="rr in roundRadii"
            :key="rr.var"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); corner-shape: squircle; background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; text-align: center;"
          >
            <div
              :style="{ width: '64px', height: '40px', background: 'var(--color-hover)', border: '2px solid var(--color-border-strong)', borderRadius: 'var(' + rr.var + ')', marginBottom: '10px' }"
            ></div>
            <code style="font-size: 0.78rem; font-weight: bold; color: var(--color-primary-dark);">{{ rr.var }}</code>
            <span style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 2px;">{{ rr.px }}</span>
            <span style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">{{ rr.usage }}</span>
          </div>
        </div>

        <!-- 3. Nested-Radius-Regel -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">3. Nested-Radius-Regel (R_inner = max(R_outer − Padding, R_min))</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Verschachtelte Boxen reduzieren den Radius entsprechend dem Innenabstand, damit Ecken konzentrisch mitlaufen (Beispiel: Modal 28px → Sub-Box 10px → Control 8px).
        </p>
        <div style="padding: var(--space-xl); border: 1.5px solid var(--color-border); border-radius: var(--radius-xl-squircle); corner-shape: squircle; background: var(--color-surface); box-shadow: var(--shadow-md); margin-bottom: 36px;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 10px;">
            Außen: <code>--radius-xl-squircle</code> (28px) + <code>--space-xl</code> (24px) Padding
          </div>
          <div style="padding: var(--space-md); border: 1px solid var(--color-border-divider); border-radius: var(--radius-sm-squircle); corner-shape: squircle; background: var(--color-surface-sunken);">
            <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 10px;">
              Sub-Box: <code>--radius-sm-squircle</code> (10px) + <code>--space-md</code> (12px) Padding
            </div>
            <div style="display: inline-flex; align-items: center; padding: 8px 14px; border: 1.5px solid var(--color-border-strong); border-radius: var(--control-radius-sm); background: var(--color-surface); font-size: 0.82rem; font-weight: 600;">
              Control: <code>--control-radius-sm</code> (8px, round)
            </div>
          </div>
        </div>

        <!-- 4. Pillen & Kreise -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">4. Pillen & Kreisrunde Elemente</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Pillen und Kreise nutzen einheitlich 9999px Rundung (--radius-pill). Bei Quadraten (1:1) entsteht ein exakter Kreis, bei Rechtecken eine saubere Pille – ohne ovales Verziehen.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div
            v-for="sr in specialRadii"
            :key="sr.var"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); corner-shape: squircle; background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; text-align: center;"
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

        <!-- 5. Schatten & Soft Material -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">5. Schatten & Weiches Material (Soft Rounded Material)</h3>
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
