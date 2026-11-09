import type { Meta, StoryObj } from '@storybook/vue3';
import PickerMenu from './PickerMenu.vue';
import DropdownMenuItem from './DropdownMenuItem.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../../utils/formFieldIcons';

const meta: Meta<typeof PickerMenu> = {
  title: 'Primitives/PickerMenu',
  component: PickerMenu,
  tags: ['autodocs'],
  argTypes: {
    backdrop: { control: 'boolean' },
    wide: { control: 'boolean' },
    position: { control: 'select', options: ['fixed', 'absolute'] },
    zIndex: { control: 'number' },
    backdropZIndex: { control: 'number' },
  },
  args: {
    backdrop: false,
    wide: false,
    position: 'absolute',
  },
};

export default meta;
type Story = StoryObj<typeof PickerMenu>;

export const Default: Story = {
  render: (args) => ({
    components: { PickerMenu, DropdownMenuItem },
    setup() {
      return { args, ACTION_ICONS };
    },
    template: `
      <div style="position: relative; width: 260px; height: 180px;">
        <PickerMenu v-bind="args">
          <DropdownMenuItem :icon="ACTION_ICONS.edit" label="Eintrag bearbeiten" />
          <DropdownMenuItem :icon="ACTION_ICONS.duplicate" label="Duplizieren" />
          <DropdownMenuItem :icon="ACTION_ICONS.delete" label="Löschen" />
        </PickerMenu>
      </div>
    `,
  }),
};

export const Wide: Story = {
  render: (args) => ({
    components: { PickerMenu, DropdownMenuItem },
    setup() {
      return { args, ACTION_ICONS, FORM_FIELD_ICONS };
    },
    template: `
      <div style="position: relative; width: 300px; height: 200px;">
        <PickerMenu v-bind="args" wide>
          <DropdownMenuItem :icon="ACTION_ICONS.fitAll" label="Alle eingetragenen Orte auf der Karte anzeigen" />
          <DropdownMenuItem :icon="ACTION_ICONS.mapsApp" label="In Maps-App öffnen" />
          <DropdownMenuItem :icon="ACTION_ICONS.share" label="Mit Mitreisenden teilen" />
        </PickerMenu>
      </div>
    `,
  }),
};

export const WithBackdrop: Story = {
  render: (args) => ({
    components: { PickerMenu, DropdownMenuItem },
    setup() {
      return { args, ACTION_ICONS };
    },
    template: `
      <div style="position: relative; width: 260px; height: 180px;">
        <PickerMenu v-bind="args" backdrop>
          <DropdownMenuItem :icon="ACTION_ICONS.apple" label="Apple Maps" />
          <DropdownMenuItem :icon="ACTION_ICONS.googleMaps" label="Google Maps" />
        </PickerMenu>
      </div>
    `,
  }),
};
