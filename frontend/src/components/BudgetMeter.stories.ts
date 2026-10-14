import type { Meta, StoryObj } from '@storybook/vue3';
import BudgetMeter from './BudgetMeter.vue';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../stories/stressFixtures';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

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
    color: '#9141AC',
    format: 'count',
  },
};

export const NearLimit: Story = {
  args: {
    label: 'Souvenirs',
    spent: 70,
    target: 80,
    format: 'currency',
  },
};

export const WithoutTarget: Story = {
  args: {
    label: 'Sonstige Ausgaben',
    spent: 85.5,
    target: 0,
    format: 'currency',
  },
};

export const WithBudgetIcon: Story = {
  args: {
    label: 'Gesamt',
    spent: 450,
    target: 1200,
    format: 'currency',
    icon: SECTION_ICON_DEFS.budget,
    prominent: true,
  },
};

export const StressTest: Story = {
  render: () => ({
    components: { BudgetMeter },
    setup() {
      return { STRESS_STRINGS, STRESS_CONTAINERS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.narrow" style="display: flex; flex-direction: column; gap: 16px;">
        <BudgetMeter
          :label="STRESS_STRINGS.longWord"
          :spent="999999.99"
          :target="500000"
          color="#c1503f"
          format="currency"
        />
        <BudgetMeter
          :label="STRESS_STRINGS.specialChars"
          :spent="12345"
          :target="99999"
          color="#9141AC"
          format="count"
        />
      </div>
    `,
  }),
};
