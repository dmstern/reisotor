import type { Meta, StoryObj } from '@storybook/vue3';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';

const meta: Meta<typeof FormField> = {
  title: 'Components/FormField',
  component: FormField,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    icon: { control: 'text' },
  },
  args: {
    label: 'Titel',
    icon: 'title',
  },
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  render: (args) => ({
    components: { FormField, Input },
    setup() {
      return { args };
    },
    template: `
      <FormField v-bind="args">
        <Input placeholder="Titel eingeben..." />
      </FormField>
    `,
  }),
};

export const WithDateIcon: Story = {
  args: {
    label: 'Abreisedatum',
    icon: 'date',
  },
  render: (args) => ({
    components: { FormField, Input },
    setup() {
      return { args };
    },
    template: `
      <FormField v-bind="args">
        <Input type="date" modelValue="2026-08-25" />
      </FormField>
    `,
  }),
};
