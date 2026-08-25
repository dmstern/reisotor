import type { Meta, StoryObj } from '@storybook/vue3';
import BudgetMeter from './BudgetMeter.vue';

const meta: Meta<typeof BudgetMeter> = {
  title: 'Components/Budget & Progress/BudgetMeter',
  component: BudgetMeter,
  tags: ['autodocs'],
  argTypes: {
    format: {
      control: { type: 'select' },
      options: ['currency', 'count'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BudgetMeter>;

export const UnderBudget: Story = {
  args: {
    label: 'Unterkünfte',
    spent: 450,
    target: 600,
    color: '#e08e45',
    format: 'currency',
  },
};

export const OverBudget: Story = {
  args: {
    label: 'Essen & Trinken',
    spent: 380,
    target: 300,
    color: '#c1503f',
    format: 'currency',
  },
};

export const CountFormat: Story = {
  args: {
    label: 'Erreichte Orte',
    spent: 8,
    target: 12,
    color: '#2a7f74',
    format: 'count',
  },
};

export const WithoutTarget: Story = {
  args: {
    label: 'Sonstige Ausgaben',
    spent: 85.5,
    target: 0,
    color: '#5b6ee1',
    format: 'currency',
  },
};
