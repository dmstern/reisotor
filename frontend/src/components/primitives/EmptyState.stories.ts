import type { Meta, StoryObj } from '@storybook/vue3';
import EmptyState from './EmptyState.vue';

const meta: Meta<typeof EmptyState> = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    tag: {
      control: 'text',
    },
  },
  args: {
    tag: 'p',
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  render: (args) => ({
    components: { EmptyState },
    setup() {
      return { args };
    },
    template: '<EmptyState v-bind="args">Noch keine Notizen vorhanden.</EmptyState>',
  }),
};
