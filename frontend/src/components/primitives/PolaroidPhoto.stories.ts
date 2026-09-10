import type { Meta, StoryObj } from '@storybook/vue3';
import PolaroidPhoto from './PolaroidPhoto.vue';

const meta: Meta<typeof PolaroidPhoto> = {
  title: 'Primitives/PolaroidPhoto',
  component: PolaroidPhoto,
  tags: ['autodocs'],
  argTypes: {
    imageUrl: { control: 'text' },
    alt: { control: 'text' },
    caption: { control: 'text' },
    showChin: { control: 'boolean' },
    rotated: { control: 'boolean' },
  },
  args: {
    alt: 'Beispielfoto',
    showChin: true,
    rotated: false,
  },
};

export default meta;
type Story = StoryObj<typeof PolaroidPhoto>;

/** Standard-Polaroid mit Foto und Bildunterschrift. */
export const WithImage: Story = {
  args: {
    imageUrl: 'https://picsum.photos/seed/reisotor/300/220',
    caption: 'Amalfi, Italien',
    showChin: true,
  },
  render: (args) => ({
    components: { PolaroidPhoto },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; align-items: flex-end; gap: 16px; padding: 32px; background: var(--color-bg);">
        <PolaroidPhoto v-bind="args" style="width: 120px; height: 140px;" />
      </div>
    `,
  }),
};

/** Polaroid ohne Foto – zeigt den placeholder-Slot mit einem Icon. */
export const WithPlaceholder: Story = {
  args: {
    imageUrl: null,
    caption: 'Keine Aufnahme',
    showChin: true,
  },
  render: (args) => ({
    components: { PolaroidPhoto },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; align-items: flex-end; gap: 16px; padding: 32px; background: var(--color-bg);">
        <PolaroidPhoto v-bind="args" style="width: 120px; height: 140px; --color-surface-sunken: #e2e8f0;">
          <template #placeholder>
            <span style="font-size: 2rem;">📍</span>
          </template>
        </PolaroidPhoto>
      </div>
    `,
  }),
};

/** Gestapelter Polaroid-Effekt wie in der Tour-Card-Vorschau. */
export const StackedTiles: Story = {
  render: () => ({
    components: { PolaroidPhoto },
    template: `
      <div style="padding: 48px; background: var(--color-bg);">
        <h3 style="margin: 0 0 24px; font-size: 0.9rem; color: var(--color-text-muted);">Gestapelt (Tour-Card-Vorschau)</h3>
        <div style="position: relative; width: 60px; height: 70px;">
          <PolaroidPhoto
            image-url="https://picsum.photos/seed/a/80/60"
            style="position:absolute;top:2px;left:3px;width:52px;height:62px;--polaroid-padding:3px;--polaroid-chin-height:10px;--polaroid-rotate:-8deg;"
            :rotated="true"
            caption="Spot 1"
            :show-chin="true"
          />
          <PolaroidPhoto
            image-url="https://picsum.photos/seed/b/80/60"
            style="position:absolute;top:2px;left:3px;width:52px;height:62px;--polaroid-padding:3px;--polaroid-chin-height:10px;--polaroid-rotate:6deg;"
            :rotated="true"
            caption="Spot 2"
            :show-chin="true"
          />
          <PolaroidPhoto
            image-url="https://picsum.photos/seed/c/80/60"
            style="position:absolute;top:2px;left:3px;width:52px;height:62px;--polaroid-padding:3px;--polaroid-chin-height:10px;--polaroid-rotate:-3deg;"
            :rotated="true"
            caption="Spot 3"
            :show-chin="true"
          />
        </div>
      </div>
    `,
  }),
};

/** SpotCard-Größe: So wird das Polaroid als Bild-Bereich in der Spot-Karte verwendet. */
export const SpotCardSize: Story = {
  args: {
    imageUrl: 'https://picsum.photos/seed/spot/400/240',
    caption: 'Pompeji, Kampanien',
    showChin: true,
  },
  render: (args) => ({
    components: { PolaroidPhoto },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; gap: 24px; padding: 32px; background: var(--color-bg); flex-wrap: wrap;">
        <div>
          <p style="margin: 0 0 8px; font-size: 0.75rem; color: var(--color-text-muted);">Collapsed (120px)</p>
          <PolaroidPhoto v-bind="args"
            style="width: 100%; --polaroid-padding: 6px; --polaroid-chin-height: 36px;"
            :show-chin="true"
          >
            <template #placeholder><span style="font-size:2rem">🏛️</span></template>
          </PolaroidPhoto>
        </div>
        <div style="width: 320px;">
          <p style="margin: 0 0 8px; font-size: 0.75rem; color: var(--color-text-muted);">Expanded (200px)</p>
          <PolaroidPhoto v-bind="args"
            style="width: 100%; --polaroid-padding: 8px; --polaroid-chin-height: 44px;"
            :show-chin="true"
          />
        </div>
      </div>
    `,
  }),
};

/** Ohne Chin – reiner Foto-Rahmen. */
export const NoChin: Story = {
  args: {
    imageUrl: 'https://picsum.photos/seed/nochin/200/150',
    showChin: false,
  },
  render: (args) => ({
    components: { PolaroidPhoto },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 32px; background: var(--color-bg);">
        <PolaroidPhoto v-bind="args" style="width: 160px; display: inline-flex;" />
      </div>
    `,
  }),
};
