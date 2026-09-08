import type { Meta, StoryObj } from '@storybook/vue3';
import CheckableListItem from './CheckableListItem.vue';
import Checkbox from './Checkbox.vue';
import EditButton from '../EditButton.vue';
import DeleteButton from '../DeleteButton.vue';
import { ref } from 'vue';

const meta: Meta<typeof CheckableListItem> = {
  title: 'Primitives/CheckableListItem',
  component: CheckableListItem,
  tags: ['autodocs'],
  argTypes: {
    done: { control: 'boolean' },
    highlighted: { control: 'boolean' },
    tag: { control: 'text' },
  },
  args: {
    done: false,
    highlighted: false,
    tag: 'li',
  },
};

export default meta;
type Story = StoryObj<typeof CheckableListItem>;

export const Default: Story = {
  render: (args) => ({
    components: { CheckableListItem, Checkbox, EditButton, DeleteButton },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `
      <ul style="list-style: none; padding: 0; margin: 0; max-width: 480px;">
        <CheckableListItem v-bind="args" :done="checked">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
            <Checkbox v-model="checked" />
            <span :class="{ 'row__text--done': checked }">Reisepässe einpacken</span>
          </label>
          <template #actions>
            <EditButton small />
            <DeleteButton small />
          </template>
        </CheckableListItem>
      </ul>
    `,
  }),
};

export const Done: Story = {
  args: {
    done: true,
  },
  render: (args) => ({
    components: { CheckableListItem, Checkbox, EditButton, DeleteButton },
    setup() {
      const checked = ref(true);
      return { args, checked };
    },
    template: `
      <ul style="list-style: none; padding: 0; margin: 0; max-width: 480px;">
        <CheckableListItem v-bind="args" :done="checked">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
            <Checkbox v-model="checked" />
            <span :class="{ 'row__text--done': checked }">Kreditkarte sperren lassen</span>
          </label>
          <template #actions>
            <EditButton small />
            <DeleteButton small />
          </template>
        </CheckableListItem>
      </ul>
    `,
  }),
};

export const Highlighted: Story = {
  args: {
    highlighted: true,
  },
  render: (args) => ({
    components: { CheckableListItem, Checkbox, EditButton, DeleteButton },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `
      <ul style="list-style: none; padding: 0; margin: 0; max-width: 480px;">
        <CheckableListItem v-bind="args" :done="checked">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
            <Checkbox v-model="checked" />
            <span :class="{ 'row__text--done': checked }">Neuer Eintrag (Echtzeit-Update)</span>
          </label>
          <template #actions>
            <EditButton small />
            <DeleteButton small />
          </template>
        </CheckableListItem>
      </ul>
    `,
  }),
};
