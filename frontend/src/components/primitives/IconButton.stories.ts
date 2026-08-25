import type { Meta, StoryObj } from '@storybook/vue3';
import IconButton from './IconButton.vue';

const meta: Meta<typeof IconButton> = {
  title: 'Primitives/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['ghost', 'secondary', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    active: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
  args: {
    variant: 'ghost',
    size: 'md',
    active: false,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {
  args: { variant: 'ghost' },
  render: (args) => ({
    components: { IconButton },
    setup() { return { args }; },
    template: '<IconButton v-bind="args">⚙️</IconButton>',
  }),
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
  render: (args) => ({
    components: { IconButton },
    setup() { return { args }; },
    template: '<IconButton v-bind="args">✏️</IconButton>',
  }),
};

export const Danger: Story = {
  args: { variant: 'danger' },
  render: (args) => ({
    components: { IconButton },
    setup() { return { args }; },
    template: '<IconButton v-bind="args">🗑️</IconButton>',
  }),
};

export const Active: Story = {
  args: { active: true },
  render: (args) => ({
    components: { IconButton },
    setup() { return { args }; },
    template: '<IconButton v-bind="args">⭐</IconButton>',
  }),
};
