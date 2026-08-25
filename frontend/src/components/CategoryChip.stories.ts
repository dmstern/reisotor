import type { Meta, StoryObj } from '@storybook/vue3';
import CategoryChip from './CategoryChip.vue';
import { SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';

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
