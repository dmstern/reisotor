import type { Meta, StoryObj } from '@storybook/vue3';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import ListSettingsMenu from './ListSettingsMenu.vue';

const meta: Meta<typeof ListSettingsMenu> = {
  title: 'Components/ListSettingsMenu',
  component: ListSettingsMenu,
  tags: ['autodocs'],
  args: {
    groupBy: 'assignee',
    defaultGroupBy: 'assignee',
    groupByOptions: [
      { value: 'assignee', label: 'nach Bearbeiter:in', icon: FORM_FIELD_ICONS.person },
      { value: 'period', label: 'nach Zeitraum', icon: FORM_FIELD_ICONS.period },
    ],
    sortBy: 'priority',
    defaultSortBy: 'priority',
    sortByOptions: [
      { value: 'priority', label: 'nach Priorität', icon: FORM_FIELD_ICONS.priority },
      { value: 'due_date', label: 'nach Datum', icon: FORM_FIELD_ICONS.date },
      { value: 'assignee', label: 'nach Bearbeiter:in', icon: FORM_FIELD_ICONS.person },
    ],
    hideCompleted: false,
    hideCompletedLabel: 'Erledigte ausblenden',
  },
};

export default meta;
type Story = StoryObj<typeof ListSettingsMenu>;

export const Default: Story = {
  render: (args) => ({
    components: { ListSettingsMenu },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; justify-content: flex-end; padding: 20px;">
        <ListSettingsMenu
          v-bind="args"
          @update:groupBy="args.groupBy = $event"
          @update:sortBy="args.sortBy = $event"
          @update:hideCompleted="args.hideCompleted = $event"
        />
      </div>
    `,
  }),
};

export const ActiveFilters: Story = {
  args: {
    groupBy: 'period',
    sortBy: 'due_date',
    hideCompleted: true,
  },
  render: (args) => ({
    components: { ListSettingsMenu },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; justify-content: flex-end; padding: 20px;">
        <ListSettingsMenu
          v-bind="args"
          @update:groupBy="args.groupBy = $event"
          @update:sortBy="args.sortBy = $event"
          @update:hideCompleted="args.hideCompleted = $event"
        />
      </div>
    `,
  }),
};

export const VisibilityOnly: Story = {
  args: {
    groupByOptions: [],
    sortByOptions: [],
    hideCompleted: false,
    hideCompletedLabel: 'Gepackte ausblenden',
  },
  render: (args) => ({
    components: { ListSettingsMenu },
    setup() {
      return { args };
    },
    template: `
      <div style="display: flex; justify-content: flex-end; padding: 20px;">
        <ListSettingsMenu
          v-bind="args"
          @update:hideCompleted="args.hideCompleted = $event"
        />
      </div>
    `,
  }),
};
