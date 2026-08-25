import type { Meta, StoryObj } from '@storybook/vue3';
import IconButton from './IconButton.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

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
    icon: ACTION_ICONS.edit,
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {
  args: { variant: 'ghost', icon: ACTION_ICONS.filterSettings },
  render: (args) => ({
    components: { IconButton },
    setup() {
      return { args };
    },
    template: '<IconButton v-bind="args" />',
  }),
};

export const Secondary: Story = {
  args: { variant: 'secondary', icon: ACTION_ICONS.edit },
  render: (args) => ({
    components: { IconButton },
    setup() {
      return { args };
    },
    template: '<IconButton v-bind="args" />',
  }),
};

export const Danger: Story = {
  args: { variant: 'danger', icon: ACTION_ICONS.delete },
  render: (args) => ({
    components: { IconButton },
    setup() {
      return { args };
    },
    template: '<IconButton v-bind="args" />',
  }),
};

export const Active: Story = {
  args: { active: true, icon: ACTION_ICONS.recommended },
  render: (args) => ({
    components: { IconButton },
    setup() {
      return { args };
    },
    template: '<IconButton v-bind="args" />',
  }),
};

export const Circle: Story = {
  args: { shape: 'circle', variant: 'secondary', icon: ACTION_ICONS.close },
  render: (args) => ({
    components: { IconButton },
    setup() {
      return { args };
    },
    template: '<IconButton v-bind="args" />',
  }),
};
