import type { Meta, StoryObj } from '@storybook/vue3';
import DropdownMenu from './DropdownMenu.vue';
import PickerMenu from './PickerMenu.vue';
import DropdownMenuItem from './DropdownMenuItem.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { ref } from 'vue';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenu,
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
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: (args) => ({
    components: { DropdownMenu, PickerMenu, DropdownMenuItem },
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
      <DropdownMenu
        v-bind="args"
        :label="selected"
        :open="open"
        :icon="ACTION_ICONS.filter"
        @toggle="open = !open"
      >
        <PickerMenu v-if="open" position="absolute" @close="open = false">
          <DropdownMenuItem label="Option A" :active="selected === 'Option A'" @click="select('Option A')" />
          <DropdownMenuItem label="Option B" :active="selected === 'Option B'" @click="select('Option B')" />
          <DropdownMenuItem label="Option C" :active="selected === 'Option C'" @click="select('Option C')" />
        </PickerMenu>
      </DropdownMenu>
    `,
  }),
};
