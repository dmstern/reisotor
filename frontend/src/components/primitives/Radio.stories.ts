import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Radio from './Radio.vue';

const meta: Meta<typeof Radio> = {
  title: 'Primitives/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    visualOnly: { control: 'boolean' },
  },
  args: {
    size: 'md',
    disabled: false,
    required: false,
    visualOnly: false,
  },
};

export default meta;
type Story = StoryObj<typeof Radio>;

export const Default: Story = {
  render: (args) => ({
    components: { Radio },
    setup() {
      const selected = ref('private');
      return { args, selected };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 10px;" role="radiogroup" aria-label="Beispiel-Auswahl">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <Radio v-bind="args" v-model="selected" name="demo-radio" value="private" />
          <span>Nur für mich sichtbar</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <Radio v-bind="args" v-model="selected" name="demo-radio" value="shared" />
          <span>Für alle Mitreisenden sichtbar</span>
        </label>
      </div>
    `,
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { Radio },
    setup() {
      const selected = ref('md');
      return { selected };
    },
    template: `
      <div style="display: flex; align-items: center; gap: 18px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <Radio v-model="selected" name="radio-sizes" value="sm" size="sm" />
          <span>Small (sm)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <Radio v-model="selected" name="radio-sizes" value="md" size="md" />
          <span>Medium (md)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <Radio v-model="selected" name="radio-sizes" value="lg" size="lg" />
          <span>Large (lg)</span>
        </label>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => ({
    components: { Radio },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <Radio v-bind="args" :checked="false" name="radio-dis" value="off" />
          <span>Deaktiviert (nicht gewählt)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <Radio v-bind="args" :checked="true" name="radio-dis" value="on" />
          <span>Deaktiviert (gewählt)</span>
        </label>
      </div>
    `,
  }),
};

export const VisualOnly: Story = {
  render: () => ({
    components: { Radio },
    template: `
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <Radio visual-only :checked="false" />
          <span>Visual Only (nicht gewählt)</span>
        </span>
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <Radio visual-only :checked="true" />
          <span>Visual Only (gewählt)</span>
        </span>
      </div>
    `,
  }),
};
