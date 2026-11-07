import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import ToggleSwitch from './ToggleSwitch.vue';

const meta: Meta<typeof ToggleSwitch> = {
  title: 'Primitives/ToggleSwitch',
  component: ToggleSwitch,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    modelValue: { control: 'boolean' },
  },
  args: {
    disabled: false,
    size: 'md',
    modelValue: false,
  },
};

export default meta;
type Story = StoryObj<typeof ToggleSwitch>;

export const Default: Story = {
  render: (args) => ({
    components: { ToggleSwitch },
    setup() {
      const active = ref(args.modelValue ?? false);
      return { args, active };
    },
    template: `
      <div style="display: flex; align-items: center; gap: 12px; font-family: var(--font-sans);">
        <ToggleSwitch v-bind="args" v-model="active" id="switch-demo" aria-label="Urlaubsregion" />
        <label for="switch-demo" style="cursor: pointer; font-size: 14px; font-weight: 500;">
          Teil der Urlaubsregion: {{ active ? 'Ja' : 'Nein' }}
        </label>
      </div>
    `,
  }),
};

export const Active: Story = {
  args: {
    modelValue: true,
  },
  render: (args) => ({
    components: { ToggleSwitch },
    setup() {
      const active = ref(true);
      return { args, active };
    },
    template: `
      <div style="display: flex; align-items: center; gap: 12px; font-family: var(--font-sans);">
        <ToggleSwitch v-bind="args" v-model="active" id="switch-active" />
        <label for="switch-active" style="cursor: pointer; font-size: 14px; font-weight: 500;">
          Aktiviert
        </label>
      </div>
    `,
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { ToggleSwitch },
    setup() {
      const sm = ref(false);
      const md = ref(true);
      const lg = ref(true);
      return { sm, md, lg };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; font-family: var(--font-sans);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <ToggleSwitch v-model="sm" size="sm" id="switch-sm" />
          <label for="switch-sm" style="font-size: 13px;">Klein (sm - 20px)</label>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <ToggleSwitch v-model="md" size="md" id="switch-md" />
          <label for="switch-md" style="font-size: 14px;">Standard (md - 24px)</label>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <ToggleSwitch v-model="lg" size="lg" id="switch-lg" />
          <label for="switch-lg" style="font-size: 15px;">Groß (lg - 28px)</label>
        </div>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => ({
    components: { ToggleSwitch },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px; font-family: var(--font-sans);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <ToggleSwitch v-bind="args" :model-value="false" id="switch-dis-off" />
          <label for="switch-dis-off" style="font-size: 14px; color: var(--color-text-muted);">
            Deaktiviert (aus)
          </label>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <ToggleSwitch v-bind="args" :model-value="true" id="switch-dis-on" />
          <label for="switch-dis-on" style="font-size: 14px; color: var(--color-text-muted);">
            Deaktiviert (an)
          </label>
        </div>
      </div>
    `,
  }),
};
