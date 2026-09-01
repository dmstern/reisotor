import type { Meta, StoryObj } from '@storybook/vue3';
import SearchFilterBar from './SearchFilterBar.vue';

const meta: Meta<typeof SearchFilterBar> = {
  title: 'Components/SearchFilterBar',
  component: SearchFilterBar,
  tags: ['autodocs'],
  argTypes: {
    searchQuery: { control: 'text' },
    searchPlaceholder: { control: 'text' },
    sortMode: { control: { type: 'select', options: ['alpha', 'likes'] } },
  },
  args: {
    searchQuery: '',
    searchPlaceholder: 'Spots oder Touren suchen...',
    sortMode: 'alpha',
    categoryFilter: [],
    categoryOptions: ['Essen & Trinken', 'Sehenswürdigkeiten', 'Natur & Wandern', 'Unterkunft'],
    statusFilter: [],
  },
};

export default meta;
type Story = StoryObj<typeof SearchFilterBar>;

export const Default: Story = {
  render: (args) => ({
    components: { SearchFilterBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 400px; padding: 20px;">
        <SearchFilterBar
          v-bind="args"
          @update:searchQuery="args.searchQuery = $event"
          @update:sortMode="args.sortMode = $event"
          @update:categoryFilter="args.categoryFilter = $event"
          @update:statusFilter="args.statusFilter = $event"
        />
      </div>
    `,
  }),
};

export const ActiveFilters: Story = {
  args: {
    searchQuery: 'Strand',
    searchPlaceholder: 'Spots oder Touren suchen...',
    sortMode: 'likes',
    categoryFilter: ['Sehenswürdigkeiten'],
    categoryOptions: ['Essen & Trinken', 'Sehenswürdigkeiten', 'Natur & Wandern', 'Unterkunft'],
    statusFilter: ['planned'],
  },
  render: (args) => ({
    components: { SearchFilterBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 400px; padding: 20px;">
        <SearchFilterBar
          v-bind="args"
          @update:searchQuery="args.searchQuery = $event"
          @update:sortMode="args.sortMode = $event"
          @update:categoryFilter="args.categoryFilter = $event"
          @update:statusFilter="args.statusFilter = $event"
        />
      </div>
    `,
  }),
};
