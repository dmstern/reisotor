import type { Meta, StoryObj } from '@storybook/vue3';
import Select from './Select.vue';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const defaultOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
];

export const Default: Story = {
  args: {
    modelValue: 'option1',
    options: defaultOptions,
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    modelValue: 'option1',
    options: defaultOptions,
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    modelValue: 'option1',
    options: defaultOptions,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    modelValue: 'option2',
    options: defaultOptions,
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    modelValue: 'option1',
    options: defaultOptions,
  },
};
