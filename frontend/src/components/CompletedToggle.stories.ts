import type { Meta, StoryObj } from '@storybook/vue3';
import CompletedToggle from './CompletedToggle.vue';

const meta: Meta<typeof CompletedToggle> = {
  title: 'Components/CompletedToggle',
  component: CompletedToggle,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'boolean' },
  },
  args: {
    modelValue: false,
  },
};

export default meta;
type Story = StoryObj<typeof CompletedToggle>;

export const ShowCompleted: Story = {
  args: {
    modelValue: false,
  },
  render: (args) => ({
    components: { CompletedToggle },
    setup() {
      return { args };
    },
    template: '<CompletedToggle v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const HideCompleted: Story = {
  args: {
    modelValue: true,
  },
  render: (args) => ({
    components: { CompletedToggle },
    setup() {
      return { args };
    },
    template: '<CompletedToggle v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};
