import type { Meta, StoryObj } from '@storybook/vue3';
import Kicker from './Kicker.vue';

const meta: Meta<typeof Kicker> = {
  title: 'Primitives/Kicker',
  component: Kicker,
  tags: ['autodocs'],
  argTypes: {
    tag: {
      control: 'text',
    },
  },
  args: {
    tag: 'span',
  },
};

export default meta;
type Story = StoryObj<typeof Kicker>;

export const Default: Story = {
  render: (args) => ({
    components: { Kicker },
    setup() {
      return { args };
    },
    template: '<Kicker v-bind="args">Pre-Heading / Kicker</Kicker>',
  }),
};
