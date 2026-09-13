import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import CheckboxCard from './CheckboxCard.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

const meta: Meta<typeof CheckboxCard> = {
  title: 'Primitives/CheckboxCard',
  component: CheckboxCard,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['card', 'row', 'muted'] },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    description: { control: 'text' },
  },
  args: {
    label: 'Option aktivieren',
    description: 'Eine kurze, informative Erklärung zu dieser Einstellung.',
    variant: 'card',
    disabled: false,
    modelValue: false,
  },
};

export default meta;
type Story = StoryObj<typeof CheckboxCard>;

export const Default: Story = {
  render: (args) => ({
    components: { CheckboxCard },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `
      <div style="max-width: 440px;">
        <CheckboxCard v-bind="args" v-model="checked" />
      </div>
    `,
  }),
};

export const Checked: Story = {
  args: {
    modelValue: true,
    label: 'Verbleibende Urlaubstage anzeigen',
    description: 'Zählt die verbleibenden Tage im Dashboard-Header herunter.',
  },
  render: (args) => ({
    components: { CheckboxCard },
    setup() {
      const checked = ref(true);
      return { args, checked };
    },
    template: `
      <div style="max-width: 440px;">
        <CheckboxCard v-bind="args" v-model="checked" />
      </div>
    `,
  }),
};

export const WithIcon: Story = {
  args: {
    label: 'Urlaubs-Countdown aktivieren',
    description: 'Schaltet die Tage-Anzeige für die laufende Reise frei.',
    icon: ACTION_ICONS.vacation,
  },
  render: (args) => ({
    components: { CheckboxCard },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `
      <div style="max-width: 440px;">
        <CheckboxCard v-bind="args" v-model="checked" />
      </div>
    `,
  }),
};

export const RowVariant: Story = {
  args: {
    variant: 'row',
    label: 'Kompakte Zeile für enge Dialoge',
    description: 'Minimalistische Darstellung ohne Kachel-Hintergrund.',
  },
  render: (args) => ({
    components: { CheckboxCard },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `
      <div style="max-width: 440px;">
        <CheckboxCard v-bind="args" v-model="checked" />
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Deaktivierte Option',
    description: 'Diese Einstellung kann derzeit nicht geändert werden.',
  },
  render: (args) => ({
    components: { CheckboxCard },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 440px; display: flex; flex-direction: column; gap: 12px;">
        <CheckboxCard v-bind="args" :model-value="false" label="Nicht gewählt & deaktiviert" />
        <CheckboxCard v-bind="args" :model-value="true" label="Gewählt & deaktiviert" />
      </div>
    `,
  }),
};
