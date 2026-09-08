import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Checkbox from './Checkbox.vue';

const meta: Meta<typeof Checkbox> = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  args: {
    disabled: false,
    required: false,
    modelValue: false,
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => ({
    components: { Checkbox },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `
      <div style="display: flex; align-items: center; gap: 8px;">
        <Checkbox v-bind="args" v-model="checked" id="cb-demo" />
        <label for="cb-demo">Option auswählen</label>
      </div>
    `,
  }),
};

export const Checked: Story = {
  args: {
    modelValue: true,
  },
  render: (args) => ({
    components: { Checkbox },
    setup() {
      const checked = ref(true);
      return { args, checked };
    },
    template: `
      <div style="display: flex; align-items: center; gap: 8px;">
        <Checkbox v-bind="args" v-model="checked" id="cb-checked" />
        <label for="cb-checked">Bereits ausgewählt</label>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => ({
    components: { Checkbox },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <Checkbox v-bind="args" :modelValue="false" id="cb-dis-1" />
          <label for="cb-dis-1">Deaktiviert (nicht gewählt)</label>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <Checkbox v-bind="args" :modelValue="true" id="cb-dis-2" />
          <label for="cb-dis-2">Deaktiviert (gewählt)</label>
        </div>
      </div>
    `,
  }),
};
