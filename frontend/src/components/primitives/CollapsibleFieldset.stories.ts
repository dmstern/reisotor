import type { Meta, StoryObj } from '@storybook/vue3';
import CollapsibleFieldset from './CollapsibleFieldset.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../../utils/formFieldIcons';

const meta: Meta<typeof CollapsibleFieldset> = {
  title: 'Primitives/CollapsibleFieldset',
  component: CollapsibleFieldset,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    count: { control: 'text' },
    openInitial: { control: 'boolean' },
  },
  args: {
    label: 'Optionale Angaben',
    openInitial: false,
  },
};

export default meta;
type Story = StoryObj<typeof CollapsibleFieldset>;

export const Default: Story = {
  render: (args) => ({
    components: { CollapsibleFieldset },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 440px; padding: 20px;">
        <CollapsibleFieldset v-bind="args">
          <p style="margin: 0; font-size: 0.9rem;">Hier können zusätzliche Optionen und Details angegeben werden.</p>
        </CollapsibleFieldset>
      </div>
    `,
  }),
};

export const WithIconAndCount: Story = {
  args: {
    label: 'Spots zuordnen',
    count: '(3 ausgewählt)',
    icon: FORM_FIELD_ICONS.location,
    iconGroup: 'formFields',
    openInitial: true,
  },
  render: (args) => ({
    components: { CollapsibleFieldset },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 440px; padding: 20px;">
        <CollapsibleFieldset v-bind="args">
          <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem;">
            <li>Strandbar</li>
            <li>Aussichtspunkt</li>
            <li>Altstadt-Café</li>
          </ul>
        </CollapsibleFieldset>
      </div>
    `,
  }),
};

export const LocationManualPicker: Story = {
  args: {
    label: 'Standort manuell setzen',
    icon: ACTION_ICONS.myLocation,
    iconGroup: 'actions',
    openInitial: false,
  },
  render: (args) => ({
    components: { CollapsibleFieldset },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 440px; padding: 20px;">
        <CollapsibleFieldset v-bind="args">
          <label style="display: block; font-size: 0.8rem; margin-bottom: 4px;">Breitengrad / Längengrad</label>
          <input type="text" placeholder="52.5200, 13.4050" style="width: 100%; box-sizing: border-box; padding: 6px 10px;" />
        </CollapsibleFieldset>
      </div>
    `,
  }),
};
