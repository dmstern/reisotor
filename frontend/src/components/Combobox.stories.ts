import type { Meta, StoryObj } from '@storybook/vue3';
import Combobox from './Combobox.vue';

const meta: Meta<typeof Combobox> = {
  title: 'Components/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'text' },
    placeholder: { control: 'text' },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: {
    modelValue: '',
    size: 'md',
    options: [
      'Essen & Trinken',
      'Sehenswürdigkeiten',
      'Natur & Wandern',
      'Unterkunft',
      'Transport',
    ],
    placeholder: 'Kategorie suchen oder tippen...',
  },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

export const Default: Story = {
  render: (args) => ({
    components: { Combobox },
    setup() {
      return { args };
    },
    template:
      '<div style="max-width: 300px; min-height: 220px;"><Combobox v-bind="args" @update:modelValue="args.modelValue = $event" /></div>',
  }),
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
  render: (args) => ({
    components: { Combobox },
    setup() {
      return { args };
    },
    template:
      '<div style="max-width: 300px; min-height: 220px;"><Combobox v-bind="args" @update:modelValue="args.modelValue = $event" /></div>',
  }),
};
