import type { Meta, StoryObj } from '@storybook/vue3';
import QuickAddRow from './QuickAddRow.vue';
import Select from './primitives/Select.vue';
import Combobox from './Combobox.vue';
import { ref } from 'vue';

const meta: Meta<typeof QuickAddRow> = {
  title: 'Components/QuickAddRow',
  component: QuickAddRow,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    placeholder: 'Artikel hinzufügen…',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof QuickAddRow>;

export const Default: Story = {
  render: (args) => ({
    components: { QuickAddRow },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <QuickAddRow class="card" v-bind="args" @submit="console.log('submit:', $event)" />
      </div>
    `,
  }),
};

export const WithExtraFields: Story = {
  render: (args) => ({
    components: { QuickAddRow, Select, Combobox },
    setup() {
      const assignee = ref('');
      const period = ref('');
      const shop = ref('');
      return { args, assignee, period, shop };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <QuickAddRow class="card" v-bind="args" @submit="console.log('submit:', $event)">
          <template #extra>
            <Select v-model="assignee" aria-label="Zuweisung" size="sm">
              <option value="">Nicht zugewiesen</option>
              <option value="1">👤 Alex</option>
              <option value="2">👩 Maria</option>
            </Select>
            <Combobox
              v-model="shop"
              :options="['Supermarkt', 'Drogerie', 'Bäcker', 'Apotheke']"
              placeholder="Shop"
              size="sm"
            />
            <Select v-model="period" aria-label="Zeitraum" size="sm">
              <option value="">Zeitraum</option>
              <option value="before">Vor dem Urlaub</option>
              <option value="during">Im Urlaub</option>
            </Select>
          </template>
        </QuickAddRow>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    placeholder: 'Deaktiviert…',
    disabled: true,
  },
  render: (args) => ({
    components: { QuickAddRow },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <QuickAddRow class="card" v-bind="args" />
      </div>
    `,
  }),
};
