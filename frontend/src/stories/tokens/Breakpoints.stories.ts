import type { Meta, StoryObj } from '@storybook/vue3';

const meta: Meta = {
  title: 'Design Tokens/Viewport Breakpoints',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ViewportBreakpoints: Story = {
  render: () => ({
    setup() {
      const breakpoints = [
        {
          name: 'Mobil Schmal / Compact',
          query: '@media (max-width: 480px)',
          usage: 'Horizontal/Vertikal-Umschaltung für Karten-Bilder (ExcursionCard, SpotCard) & mobile Modal-Breiten.',
        },
        {
          name: 'Medium / Kalenderwoche',
          query: '@media (min-width: 700px)',
          usage: 'Schaltet CalendarWeek.vue von der 3-Tage-Kompaktansicht auf die volle 7-Tage-Wochenansicht um.',
        },
        {
          name: 'Haupt-Desktop Breakpoint (Standard)',
          query: '@media (min-width: 800px) / (max-width: 799px)',
          usage: 'Zentraler App-Split (App.vue, NavBar.vue, Drawer.vue, AppHeader.vue): Mobil (Bottom TabBar & Bottom-Sheets) vs. Desktop (Top Sticky Header, feste Sidebar-Drawers & Split-Screen).',
        },
        {
          name: 'Breite Listen & Tabellen',
          query: '@media (min-width: 900px)',
          usage: 'Schaltet TodoView, PackingListView, ShoppingListView & BudgetView auf mehrspaltige Tabellen-Grid-Layouts um.',
        },
      ];

      const containerQueries = [
        {
          name: '@container (max-width: 380px)',
          target: 'IconStyleSettings.vue',
          usage: 'Blendet Wort-Labels bei schmalen Karten-Spalten aus und behält nur das Icon.',
        },
        {
          name: '@container spots-col (max-width: 480px / 450px)',
          target: 'SpotCard.vue / ExcursionsView.vue',
          usage: 'Schaltet Spot-Karten von horizontalem Zeilen-Layout auf vertikales Stapel-Layout basierend auf der tatsächlichen Spaltenbreite des Containers.',
        },
      ];

      const preferences = [
        {
          name: 'System Dark Mode',
          query: '@media (prefers-color-scheme: dark)',
          usage: 'Systemweite automatische Dark-Mode Farbanpassung in style.css.',
        },
        {
          name: 'Reduzierte Motion (Barrierefreiheit)',
          query: '@media (prefers-reduced-motion: reduce)',
          usage: 'Deaktiviert Gleit- & Ladeanimationen für barrierefreie Nutzung (LoadingIndicator, SplashScreen, ReisotorRobot).',
        },
      ];

      return { breakpoints, containerQueries, preferences };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Viewport Breakpoints & Media Queries</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          Genaue Übersicht aller responsiven Viewport-Schwellenwerte, Container Queries und System-Präferenzen in Reisotor.
        </p>

        <!-- Viewport Media Queries -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Viewport Media Queries (@media)</h3>
        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 36px;">
          <div
            v-for="b in breakpoints"
            :key="b.name"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
              <strong style="color: var(--color-text); font-size: 1.05rem;">{{ b.name }}</strong>
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark); background: var(--color-primary-tint); padding: 2px 8px; border-radius: 4px;">{{ b.query }}</code>
            </div>
            <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">{{ b.usage }}</p>
          </div>
        </div>

        <!-- Container Queries -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">Container Queries (@container)</h3>
        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 36px;">
          <div
            v-for="cq in containerQueries"
            :key="cq.name"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
              <strong style="color: var(--color-text); font-size: 1.05rem;">{{ cq.name }}</strong>
              <code style="font-size: 0.82rem; color: var(--color-accent-secondary);">{{ cq.target }}</code>
            </div>
            <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">{{ cq.usage }}</p>
          </div>
        </div>

        <!-- System-Präferenzen -->
        <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">System-Präferenzen</h3>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div
            v-for="p in preferences"
            :key="p.name"
            style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
              <strong style="color: var(--color-text);">{{ p.name }}</strong>
              <code style="font-size: 0.82rem; color: var(--color-primary-dark);">{{ p.query }}</code>
            </div>
            <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">{{ p.usage }}</p>
          </div>
        </div>
      </div>
    `,
  }),
};
