import type { Meta, StoryObj } from '@storybook/vue3';
import DayChip from './DayChip.vue';

const meta: Meta<typeof DayChip> = {
  title: 'Components/Feedback & Badges/DayChip',
  component: DayChip,
  tags: ['autodocs'],
  argTypes: {
    date: { control: 'text' },
    active: { control: 'boolean' },
    hasContent: { control: 'boolean' },
    title: { control: 'text' },
  },
  args: {
    date: '2026-08-31',
    active: false,
    hasContent: false,
  },
};

export default meta;
type Story = StoryObj<typeof DayChip>;

export const Default: Story = {
  args: {
    date: '2026-08-31',
  },
};

export const Active: Story = {
  args: {
    date: '2026-08-31',
    active: true,
  },
};

export const WithContent: Story = {
  args: {
    date: '2026-08-31',
    hasContent: true,
  },
};

export const ActiveWithContent: Story = {
  args: {
    date: '2026-08-31',
    active: true,
    hasContent: true,
  },
};

export const DayStripShowcase: Story = {
  render: () => ({
    components: { DayChip },
    setup() {
      const days = [
        { date: '2026-08-30', active: false, hasContent: false },
        { date: '2026-08-31', active: true, hasContent: true },
        { date: '2026-09-01', active: false, hasContent: true },
        { date: '2026-09-02', active: false, hasContent: false },
        { date: '2026-09-03', active: false, hasContent: true },
        { date: '2026-09-04', active: false, hasContent: false },
        { date: '2026-09-05', active: false, hasContent: false },
      ];
      return { days };
    },
    template: `
      <div style="display: flex; gap: 6px; padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm-squircle); box-shadow: var(--shadow-sm); width: fit-content;">
        <DayChip
          v-for="d in days"
          :key="d.date"
          :date="d.date"
          :active="d.active"
          :has-content="d.hasContent"
        />
      </div>
    `,
  }),
};
