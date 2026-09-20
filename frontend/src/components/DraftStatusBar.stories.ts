import type { Meta, StoryObj } from '@storybook/vue3';
import DraftStatusBar from './DraftStatusBar.vue';

const meta: Meta<typeof DraftStatusBar> = {
  title: 'Components/DraftStatusBar',
  component: DraftStatusBar,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['idle', 'dirty', 'saved', 'offline'],
    },
    restored: { control: 'boolean' },
    canDiscard: { control: 'boolean' },
  },
  args: {
    status: 'saved',
    restored: false,
    canDiscard: true,
  },
};

export default meta;
type Story = StoryObj<typeof DraftStatusBar>;

export const Default: Story = {
  render: (args) => ({
    components: { DraftStatusBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <DraftStatusBar v-bind="args" @discard="console.log('discard clicked')" />
      </div>
    `,
  }),
};

export const Restored: Story = {
  args: {
    status: 'saved',
    restored: true,
    canDiscard: true,
  },
  render: (args) => ({
    components: { DraftStatusBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <DraftStatusBar v-bind="args" @discard="console.log('discard clicked')" />
      </div>
    `,
  }),
};

export const Saving: Story = {
  args: {
    status: 'dirty',
    canDiscard: true,
  },
  render: (args) => ({
    components: { DraftStatusBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <DraftStatusBar v-bind="args" @discard="console.log('discard clicked')" />
      </div>
    `,
  }),
};
