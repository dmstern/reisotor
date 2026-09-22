import type { Meta, StoryObj } from '@storybook/vue3';
import CategoryChip from './CategoryChip.vue';
import { SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../stories/stressFixtures';

const meta: Meta<typeof CategoryChip> = {
  title: 'Components/Feedback & Badges/CategoryChip',
  component: CategoryChip,
  tags: ['autodocs'],
  argTypes: {
    category: {
      control: { type: 'select' },
      options: SPOT_CATEGORY_SUGGESTIONS,
    },
  },
};

export default meta;
type Story = StoryObj<typeof CategoryChip>;

export const Default: Story = {
  args: {
    category: 'Essen & Trinken',
  },
};

export const IconOnly: Story = {
  args: {
    category: 'Sehenswürdigkeit',
    iconOnly: true,
  },
};

export const AllCategoriesShowcase: Story = {
  render: () => ({
    components: { CategoryChip },
    setup() {
      const categories = SPOT_CATEGORY_SUGGESTIONS;
      return { categories };
    },
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 16px;">
        <CategoryChip v-for="cat in categories" :key="cat" :category="cat" />
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
