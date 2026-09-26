import type { Meta, StoryObj } from '@storybook/vue3';
import TrackVisibilitySelect from './TrackVisibilitySelect.vue';

const meta: Meta<typeof TrackVisibilitySelect> = {
  title: 'Components/TrackVisibilitySelect',
  component: TrackVisibilitySelect,
  tags: ['autodocs'],
  argTypes: {
    modelValue: {
      control: { type: 'select' },
      options: ['private', 'shared'],
    },
    disabled: { control: 'boolean' },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TrackVisibilitySelect>;

export const Default: Story = {
  args: {
    modelValue: 'private',
  },
};

export const Shared: Story = {
  args: {
    modelValue: 'shared',
  },
};

export const Disabled: Story = {
  args: {
    modelValue: 'private',
    disabled: true,
  },
};
