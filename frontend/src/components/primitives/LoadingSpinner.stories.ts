import type { Meta, StoryObj } from '@storybook/vue3';
import LoadingSpinner from './LoadingSpinner.vue';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Primitives/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    inverted: {
      control: 'boolean',
    },
    decorative: {
      control: 'boolean',
    },
    label: {
      control: 'text',
    },
  },
  args: {
    size: 'md',
    inverted: false,
    decorative: false,
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Default: Story = {};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
  },
};
