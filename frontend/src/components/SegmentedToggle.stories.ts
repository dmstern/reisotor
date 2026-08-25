import type { Meta, StoryObj } from '@storybook/vue3';
import SegmentedToggle from './SegmentedToggle.vue';

const meta: Meta<typeof SegmentedToggle> = {
  title: 'Components/SegmentedToggle',
  component: SegmentedToggle,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'text' },
  },
  args: {
    modelValue: 'spots',
    options: [
      { value: 'spots', label: 'Spots' },
      { value: 'tours', label: 'Touren' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedToggle>;

export const Default: Story = {
  render: (args) => ({
    components: { SegmentedToggle },
    setup() {
      return { args };
    },
    template: '<SegmentedToggle v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const ThreeOptions: Story = {
  args: {
    modelValue: 'all',
    options: [
      { value: 'all', label: 'Alle' },
      { value: 'active', label: 'Aktiv' },
      { value: 'done', label: 'Erledigt' },
    ],
  },
  render: (args) => ({
    components: { SegmentedToggle },
    setup() {
      return { args };
    },
    template: '<SegmentedToggle v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};
