import type { Meta, StoryObj } from '@storybook/vue3';
import UnseenDot from './UnseenDot.vue';

const meta: Meta<typeof UnseenDot> = {
  title: 'Primitives/UnseenDot',
  component: UnseenDot,
  tags: ['autodocs'],
  argTypes: {
    ariaLabel: {
      control: 'text',
    },
  },
  args: {
    ariaLabel: 'Neue Änderungen',
  },
};

export default meta;
type Story = StoryObj<typeof UnseenDot>;

export const Default: Story = {
  render: (args) => ({
    components: { UnseenDot },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; align-items: center; gap: 8px; font-family: var(--font-sans);">
        <span>Ungelesene Inhalte</span>
        <UnseenDot v-bind="args" />
      </div>
    `,
  }),
};
