import type { Meta, StoryObj } from '@storybook/vue3';
import Card from './Card.vue';
import { SECTION_ICON_DEFS } from '../../utils/sectionIcons';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'muted', 'flat', 'elevated', 'tile'],
    },
    condensed: { control: 'boolean' },
    expanded: { control: 'boolean' },
    expandable: { control: 'boolean' },
    bannerUrl: { control: 'text' },
    bannerPosition: {
      control: 'select',
      options: ['auto', 'top', 'left'],
    },
    highlight: { control: 'boolean' },
    tileColor: { control: 'color' },
  },
  args: {
    variant: 'default',
    condensed: false,
    expandable: false,
    bannerPosition: 'auto',
    highlight: false,
    tileColor: '#2a7f74',
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h3 style="margin: 0 0 8px;">Standard Karte</h3>
        <p style="margin: 0;">Standard-Oberfläche mit weißem Hintergrund, weichem Schatten (--shadow-sm) und Squircle-Ecken.</p>
      </Card>
    `,
  }),
};

export const Muted: Story = {
  args: { variant: 'muted' },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h3 style="margin: 0 0 8px;">Hinterlegte Karte (Muted)</h3>
        <p style="margin: 0;">Hinterlegter Hintergrund (--color-hover) für Sekundär-Sektionen oder inaktive Elemente.</p>
      </Card>
    `,
  }),
};

export const Flat: Story = {
  args: { variant: 'flat' },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h3 style="margin: 0 0 8px;">Flache Karte (Flat)</h3>
        <p style="margin: 0;">Ohne Schatten, nur mit dezentem Rand. Ideal für verschachtelte Container.</p>
      </Card>
    `,
  }),
};

export const Elevated: Story = {
  args: { variant: 'elevated' },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h3 style="margin: 0 0 8px;">Erhöhte Karte (Elevated)</h3>
        <p style="margin: 0;">Prägnanterer Schatten (--shadow-md) für schwebende Panels oder hervorgehobene Auswahlen.</p>
      </Card>
    `,
  }),
};

export const DashboardTile: Story = {
  args: {
    variant: 'tile',
    tileColor: '#2a7f74',
    tileIcon: SECTION_ICON_DEFS.calendar,
  },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 320px; text-align: center; margin-top: 24px;">
        <h3 style="margin: 12px 0 6px;">Kalender-Kachel</h3>
        <p style="margin: 0; font-size: 0.85rem;">Dashboard-Stil mit transparent getöntem Hintergrund & schwebendem Kreis-Icon.</p>
      </Card>
    `,
  }),
};

export const ExpandableInteractive: Story = {
  args: {
    expandable: true,
    bannerUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop',
    bannerAlt: 'Strand im Sonnenuntergang',
    bannerPosition: 'auto',
  },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 460px;">
        <h3 style="margin: 0 0 4px;">Strand von Elafonisi 🏖️</h3>
        <p style="margin: 0; font-size: 0.85rem;">Rosafarbener Sandstrand auf Kreta</p>

        <template #condensed>
          <span style="font-size: 0.75rem; color: var(--color-primary-dark); font-weight: 600;">Klicke zum Aufklappen ↗</span>
        </template>

        <template #expanded>
          <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--color-border); font-size: 0.85rem;">
            <p><strong>Notizen:</strong> Wunderschöner Strand mit seichtem Wasser, ideal zum Schnorcheln.</p>
            <p style="margin: 0;"><strong>Beste Zeit:</strong> Vormittags vor 11:00 Uhr wegen des Windes.</p>
          </div>
        </template>
      </Card>
    `,
  }),
};

export const CondensedState: Story = {
  args: {
    condensed: true,
    bannerUrl:
      'https://images.unsplash.com/photo-1476514525535-ce74f45814ce?w=600&auto=format&fit=crop',
    bannerPosition: 'left',
  },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 420px;">
        <h4 style="margin: 0 0 2px;">Komprimierter Zustand (Condensed)</h4>
        <p style="margin: 0; font-size: 0.8rem;">Kompakter Zustand für Listenansichten mit schmalem Miniatur-Banner links.</p>
      </Card>
    `,
  }),
};

export const Highlighted: Story = {
  args: { highlight: true },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h3 style="margin: 0 0 8px;">Frisch aktualisierte Karte</h3>
        <p style="margin: 0;">Farblicher Akzent-Rand (.new-highlight) markiert Echtzeit-Updates von Mitreisenden.</p>
      </Card>
    `,
  }),
};
