import type { Meta, StoryObj } from '@storybook/vue3';
import TabBar from './TabBar.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

const meta: Meta<typeof TabBar> = {
  title: 'Components/TabBar',
  component: TabBar,
  tags: ['autodocs'],
  argTypes: {
    activeKey: { control: 'text' },
  },
  args: {
    activeKey: 'packing',
    tabs: [
      { key: 'packing', label: 'Packliste', icon: SECTION_ICON_DEFS.excursions },
      { key: 'shopping', label: 'Einkauf', icon: SECTION_ICON_DEFS.notes },
      { key: 'todo', label: 'ToDo', icon: SECTION_ICON_DEFS.calendar },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof TabBar>;

export const Default: Story = {
  render: (args) => ({
    components: { TabBar },
    setup() {
      return { args };
    },
    template: '<TabBar v-bind="args" @select="args.activeKey = $event" />',
  }),
};
