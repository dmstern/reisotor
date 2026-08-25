import type { Meta, StoryObj } from '@storybook/vue3';
import Card from './Card.vue';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [undefined, 'muted'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => ({
    components: { Card },
    setup() { return { args }; },
    template: `
      <Card v-bind="args" style="padding: 16px;">
        <h3 style="margin: 0 0 8px;">Card Title</h3>
        <p style="margin: 0;">This is a standard surface card utilizing the design system primitives.</p>
      </Card>
    `,
  }),
};

export const Muted: Story = {
  args: { variant: 'muted' },
  render: (args) => ({
    components: { Card },
    setup() { return { args }; },
    template: `
      <Card v-bind="args" style="padding: 16px;">
        <h3 style="margin: 0 0 8px;">Muted Card</h3>
        <p style="margin: 0;">This is a muted background variant of the card surface.</p>
      </Card>
    `,
  }),
};
