import type { Meta, StoryObj } from '@storybook/vue3';
import Dropdown from './Dropdown.vue';
import PickerMenu from './PickerMenu.vue';
import DropdownItem from './DropdownItem.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { ref } from 'vue';

const meta: Meta<typeof Dropdown> = {
  title: 'Primitives/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    disabled: { control: 'boolean' },
    open: { control: 'boolean' },
  },
  args: {
    label: 'Option auswählen',
    disabled: false,
    open: false,
  },
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Default: Story = {
  render: (args) => ({
    components: { Dropdown, PickerMenu, DropdownItem },
    setup() {
      const open = ref(false);
      const selected = ref('Option A');
      const select = (val: string) => {
        selected.value = val;
        open.value = false;
      };
      return { args, open, selected, select, ACTION_ICONS };
    },
    template: `
      <Dropdown
        v-bind="args"
        :label="selected"
        :open="open"
        :icon="ACTION_ICONS.filter"
        @toggle="open = !open"
      >
        <PickerMenu v-if="open" position="absolute" @close="open = false">
          <DropdownItem label="Option A" :active="selected === 'Option A'" @click="select('Option A')" />
          <DropdownItem label="Option B" :active="selected === 'Option B'" @click="select('Option B')" />
          <DropdownItem label="Option C" :active="selected === 'Option C'" @click="select('Option C')" />
        </PickerMenu>
      </Dropdown>
    `,
  }),
};
