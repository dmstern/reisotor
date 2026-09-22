import type { Meta, StoryObj } from '@storybook/vue3';
import Input from './Input.vue';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../../stories/stressFixtures';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'number', 'date', 'time', 'email', 'url', 'password'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
  args: {
    type: 'text',
    size: 'md',
    placeholder: 'Eingabe eingeben...',
    disabled: false,
    invalid: false,
    modelValue: '',
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Standard Textfeld',
  },
  render: (args) => ({
    components: { Input },
    setup() {
      return { args };
    },
    template: '<Input v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const Small: Story = {
  args: {
    size: 'sm',
    placeholder: 'Kompaktes Feld',
  },
  render: (args) => ({
    components: { Input },
    setup() {
      return { args };
    },
    template: '<Input v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const Large: Story = {
  args: {
    size: 'lg',
    placeholder: 'Großes Feld',
  },
  render: (args) => ({
    components: { Input },
    setup() {
      return { args };
    },
    template: '<Input v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const Invalid: Story = {
  args: {
    invalid: true,
    modelValue: 'Ungültiger Inhalt',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    modelValue: 'Deaktiviertes Feld',
  },
};

export const DateInput: Story = {
  args: {
    type: 'date',
    modelValue: '2026-08-25',
  },
};

export const StressTest: Story = {
  render: () => ({
    components: { Input },
    setup() {
      return { STRESS_STRINGS, STRESS_CONTAINERS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.narrow" style="display: flex; flex-direction: column; gap: 12px;">
        <Input :modelValue="STRESS_STRINGS.longWord" placeholder="Extrem langer Text" />
        <Input :modelValue="STRESS_STRINGS.specialChars" placeholder="Sonderzeichen" />
        <Input :placeholder="STRESS_STRINGS.longSentence" />
      </div>
    `,
  }),
};
