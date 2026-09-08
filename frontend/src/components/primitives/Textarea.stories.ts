import type { Meta, StoryObj } from '@storybook/vue3';
import Textarea from './Textarea.vue';

const meta: Meta<typeof Textarea> = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    rows: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: 'Hier Text eingeben...',
    modelValue: '',
  },
};

export const WithValue: Story = {
  args: {
    modelValue: 'Dies ist ein mehrzeiliger Text\nmit einer zweiten Zeile.',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    modelValue: 'Deaktiviertes Textfeld',
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    modelValue: 'Ungültige Eingabe',
  },
};
