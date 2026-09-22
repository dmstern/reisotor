import type { Meta, StoryObj } from '@storybook/vue3';
import DetailRow from './DetailRow.vue';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../../stories/stressFixtures';

const meta: Meta<typeof DetailRow> = {
  title: 'Primitives/DetailRow',
  component: DetailRow,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
    },
    tag: {
      control: 'text',
    },
  },
  args: {
    label: 'Strecke',
    tag: 'p',
  },
};

export default meta;
type Story = StoryObj<typeof DetailRow>;

export const Default: Story = {
  render: (args) => ({
    components: { DetailRow },
    setup() {
      return { args };
    },
    template: '<DetailRow v-bind="args">Zürich HB → Rom Termini</DetailRow>',
  }),
};

export const MultipleRows: Story = {
  render: () => ({
    components: { DetailRow },
    template: `
      <div style="font-family: var(--font-sans); max-width: 400px;">
        <DetailRow label="Adresse">Via del Corso 12, Rom</DetailRow>
        <DetailRow label="Zeitraum">01.09.2026 – 08.09.2026</DetailRow>
        <DetailRow label="Kosten">120.00 €</DetailRow>
      </div>
    `,
  }),
};

export const StressTest: Story = {
  render: () => ({
    components: { DetailRow },
    setup() {
      return { STRESS_STRINGS, STRESS_CONTAINERS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.narrow">
        <DetailRow :label="STRESS_STRINGS.longWord">{{ STRESS_STRINGS.longSentence }}</DetailRow>
        <DetailRow label="Sonderzeichen">{{ STRESS_STRINGS.specialChars }}</DetailRow>
      </div>
    `,
  }),
};
