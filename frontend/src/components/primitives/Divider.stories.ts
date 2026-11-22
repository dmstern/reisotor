import type { Meta, StoryObj } from '@storybook/vue3';
import Divider from './Divider.vue';
import Card from './Card.vue';

const meta: Meta<typeof Divider> = {
  title: 'Primitives/Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    spacing: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
      description:
        'Vertikaler Außenabstand (`margin-block`). In Flex-/Grid-Containern mit `gap` ist `none` (Standard) ideal.',
    },
  },
  args: {
    spacing: 'none',
  },
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Default: Story = {
  render: (args) => ({
    components: { Divider, Card },
    setup() {
      return { args };
    },
    template: `
      <Card style="max-width: 420px; display: flex; flex-direction: column; gap: var(--space-md);">
        <div>
          <strong style="display: block; font-size: var(--font-size-sm);">Oberer Bereich</strong>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
            Eingefräste Trennlinie mit dunkler Rille (<code>--color-divider-groove</code>) und feiner unterer Lichtkante (<code>--color-divider-highlight</code>).
          </span>
        </div>
        <Divider v-bind="args" />
        <div>
          <strong style="display: block; font-size: var(--font-size-sm);">Unterer Bereich</strong>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
            Wirkt auf opaken Surfaces (Light & Dark Mode) sowie in Liquid-Glass-Containern plastisch vertieft.
          </span>
        </div>
      </Card>
    `,
  }),
};

export const SpacingVariants: Story = {
  render: () => ({
    components: { Divider, Card },
    setup() {
      const spacings = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;
      return { spacings };
    },
    template: `
      <Card style="max-width: 460px;">
        <div v-for="s in spacings" :key="s" style="margin-bottom: var(--space-md);">
          <code style="font-size: var(--font-size-xs); color: var(--color-primary-dark);">spacing="{{ s }}"</code>
          <div style="background: var(--color-hover); padding: var(--space-xs) var(--space-sm); border-radius: var(--radius-xs-squircle); margin-top: var(--space-2xs);">
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Inhalt davor</span>
            <Divider :spacing="s" />
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Inhalt danach</span>
          </div>
        </div>
      </Card>
    `,
  }),
};
