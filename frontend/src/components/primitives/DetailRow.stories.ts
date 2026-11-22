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
    icon: {
      control: 'select',
      options: [
        undefined,
        'period',
        'location',
        'time',
        'contact',
        'email',
        'amount',
        'link',
        'tour',
      ],
    },
    tag: {
      control: 'text',
    },
  },
  args: {
    label: 'Strecke',
    icon: 'location',
    tag: 'div',
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
    template:
      '<dl style="margin: 0;"><DetailRow v-bind="args">Zürich HB → Rom Termini</DetailRow></dl>',
  }),
};

export const MultipleRows: Story = {
  render: () => ({
    components: { DetailRow },
    template: `
      <dl style="font-family: var(--font-sans); max-width: 400px; margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--space-sm); row-gap: var(--space-1-5);">
        <DetailRow label="Adresse" icon="location" style="grid-column: 1 / -1; grid-template-columns: subgrid; margin: 0;">Via del Corso 12, Rom</DetailRow>
        <DetailRow label="Zeitraum" icon="period" style="grid-column: 1 / -1; grid-template-columns: subgrid; margin: 0;">01.09.2026 – 08.09.2026</DetailRow>
        <DetailRow label="Kosten" icon="amount" style="grid-column: 1 / -1; grid-template-columns: subgrid; margin: 0;">120.00 €</DetailRow>
      </dl>
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
      <dl :style="STRESS_CONTAINERS.narrow" style="margin: 0;">
        <DetailRow :label="STRESS_STRINGS.longWord" icon="location">{{ STRESS_STRINGS.longSentence }}</DetailRow>
        <DetailRow label="Sonderzeichen" icon="note">{{ STRESS_STRINGS.specialChars }}</DetailRow>
      </dl>
    `,
  }),
};
