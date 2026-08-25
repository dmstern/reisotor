import type { Meta, StoryObj } from '@storybook/vue3';
import Card from './Card.vue';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'muted', 'condensed', 'flat', 'elevated'],
    },
    bannerUrl: { control: 'text' },
    highlight: { control: 'boolean' },
  },
  args: {
    variant: 'default',
    highlight: false,
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

export const Condensed: Story = {
  args: { variant: 'condensed' },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h4 style="margin: 0 0 4px;">Kompakte Karte (Condensed / Mini)</h4>
        <p style="margin: 0; font-size: 0.85rem;">Kompakteres Padding für dichte Listen-Einträge, Mini-Spots oder Tages-Stationen.</p>
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

export const WithBanner: Story = {
  args: {
    bannerUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop',
    bannerAlt: 'Strand im Sonnenuntergang',
  },
  render: (args) => ({
    components: { Card },
    setup() {
      return { args };
    },
    template: `
      <Card v-bind="args" style="max-width: 400px;">
        <h3 style="margin: 0 0 8px;">Karte mit Bild-Banner</h3>
        <p style="margin: 0;">Integriertes Banner-Bild am oberen Rand mit nahtloser Squircle-Eckenanpassung.</p>
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
