import type { Meta, StoryObj } from '@storybook/vue3';
import ResizeHandle from './ResizeHandle.vue';

const meta: Meta<typeof ResizeHandle> = {
  title: 'Components/ResizeHandle',
  component: ResizeHandle,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['vertical', 'horizontal'],
    },
    isResizing: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    label: 'Breite anpassen',
    orientation: 'vertical',
    isResizing: false,
  },
};

export default meta;
type Story = StoryObj<typeof ResizeHandle>;

export const Default: Story = {
  render: (args) => ({
    components: { ResizeHandle },
    setup() {
      return { args };
    },
    template: `
      <div style="height: 200px; display: flex; align-items: center; justify-content: center; background: var(--color-bg); padding: 20px;">
        <ResizeHandle v-bind="args" />
      </div>
    `,
  }),
};

export const ActiveResizing: Story = {
  args: {
    isResizing: true,
  },
  render: (args) => ({
    components: { ResizeHandle },
    setup() {
      return { args };
    },
    template: `
      <div style="height: 200px; display: flex; align-items: center; justify-content: center; background: var(--color-bg); padding: 20px;">
        <ResizeHandle v-bind="args" />
      </div>
    `,
  }),
};
