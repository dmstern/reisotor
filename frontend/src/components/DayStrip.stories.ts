import type { Meta, StoryObj } from '@storybook/vue3';
import DayStrip from './DayStrip.vue';

const sampleDays = [
  '2026-08-30',
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-05',
  '2026-09-06',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
  '2026-09-14',
];

const meta: Meta<typeof DayStrip> = {
  title: 'Components/Navigation/DayStrip',
  component: DayStrip,
  tags: ['autodocs'],
  argTypes: {
    days: { control: 'object' },
    activeDate: { control: 'text' },
  },
  args: {
    days: sampleDays,
    activeDate: '2026-09-02',
    hasContent: (date: string) => ['2026-08-31', '2026-09-02', '2026-09-05'].includes(date),
  },
};

export default meta;
type Story = StoryObj<typeof DayStrip>;

export const Default: Story = {
  render: (args) => ({
    components: { DayStrip },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 400px; padding: 20px;">
        <DayStrip v-bind="args" />
      </div>
    `,
  }),
};

export const ShortTrip: Story = {
  args: {
    days: sampleDays.slice(0, 4),
    activeDate: '2026-08-31',
  },
  render: (args) => ({
    components: { DayStrip },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 400px; padding: 20px;">
        <DayStrip v-bind="args" />
      </div>
    `,
  }),
};

export const LongTrip: Story = {
  args: {
    days: sampleDays,
    activeDate: '2026-09-10',
  },
  render: (args) => ({
    components: { DayStrip },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 350px; padding: 20px;">
        <DayStrip v-bind="args" />
      </div>
    `,
  }),
};
