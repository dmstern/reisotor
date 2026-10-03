import type { Meta, StoryObj } from '@storybook/vue3';
import CategoryChip from './CategoryChip.vue';
import { SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import { EXPENSE_CATEGORY_SUGGESTIONS } from '../utils/expenseCategory';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../stories/stressFixtures';

const ALL_CATEGORY_OPTIONS = [
  ...new Set([...SPOT_CATEGORY_SUGGESTIONS, ...EXPENSE_CATEGORY_SUGGESTIONS]),
].sort((a, b) => a.localeCompare(b, 'de'));

const meta: Meta<typeof CategoryChip> = {
  title: 'Components/Feedback & Badges/CategoryChip',
  component: CategoryChip,
  tags: ['autodocs'],
  argTypes: {
    category: {
      control: { type: 'select' },
      options: ALL_CATEGORY_OPTIONS,
    },
    type: {
      control: { type: 'radio' },
      options: ['spot', 'expense'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof CategoryChip>;

export const Default: Story = {
  args: {
    category: 'Restaurant',
    type: 'spot',
  },
};

export const ExpenseCategory: Story = {
  args: {
    category: 'Essen & Trinken',
    type: 'expense',
  },
};

export const IconOnly: Story = {
  args: {
    category: 'Sehenswürdigkeit',
    iconOnly: true,
  },
};

export const AllSpotCategoriesShowcase: Story = {
  render: () => ({
    components: { CategoryChip },
    setup() {
      const categories = SPOT_CATEGORY_SUGGESTIONS;
      return { categories };
    },
    template: `
      <div>
        <h4 style="margin: 0 0 12px; font-size: 0.95rem;">Spot-Kategorien ({{ categories.length }})</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 4px;">
          <CategoryChip v-for="cat in categories" :key="cat" :category="cat" type="spot" />
        </div>
      </div>
    `,
  }),
};

export const AllExpenseCategoriesShowcase: Story = {
  render: () => ({
    components: { CategoryChip },
    setup() {
      const categories = EXPENSE_CATEGORY_SUGGESTIONS;
      return { categories };
    },
    template: `
      <div>
        <h4 style="margin: 0 0 12px; font-size: 0.95rem;">Ausgaben-Kategorien ({{ categories.length }})</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 4px;">
          <CategoryChip v-for="cat in categories" :key="cat" :category="cat" type="expense" />
        </div>
      </div>
    `,
  }),
};

export const StressTest: Story = {
  render: () => ({
    components: { CategoryChip },
    setup() {
      return { STRESS_STRINGS, STRESS_CONTAINERS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.narrow" style="display: flex; flex-direction: column; gap: 8px;">
        <CategoryChip :category="STRESS_STRINGS.longWord" />
        <CategoryChip :category="STRESS_STRINGS.specialChars" />
      </div>
    `,
  }),
};
