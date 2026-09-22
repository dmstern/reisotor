import type { Meta, StoryObj } from '@storybook/vue3';
import DropdownItem from './DropdownItem.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../../utils/formFieldIcons';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../../stories/stressFixtures';

const meta: Meta<typeof DropdownItem> = {
  title: 'Primitives/DropdownItem',
  component: DropdownItem,
  tags: ['autodocs'],
  argTypes: {
    active: { control: 'boolean' },
    disabled: { control: 'boolean' },
    multiselect: { control: 'boolean' },
    checked: { control: 'boolean' },
  },
  args: {
    label: 'Menüeintrag',
    icon: ACTION_ICONS.edit,
    active: false,
    disabled: false,
    multiselect: false,
    checked: false,
  },
};

export default meta;
type Story = StoryObj<typeof DropdownItem>;

export const Default: Story = {
  args: { label: 'Eintrag bearbeiten', icon: ACTION_ICONS.edit },
};

export const Active: Story = {
  args: { label: 'Aktiver Urlaub', icon: ACTION_ICONS.done, active: true },
};

export const Link: Story = {
  args: {
    label: 'In Apple Maps öffnen ↗',
    icon: ACTION_ICONS.apple,
    href: 'https://maps.apple.com',
    target: '_blank',
  },
};

export const Multiselect: Story = {
  args: {
    label: 'Kategorie Kultur',
    icon: FORM_FIELD_ICONS.note,
    iconGroup: 'formFields',
    multiselect: true,
    checked: true,
  },
};

export const WithTrailingIcon: Story = {
  args: {
    label: 'nach Zeitraum',
    icon: FORM_FIELD_ICONS.period,
    iconGroup: 'formFields',
    active: true,
    trailingIcon: ACTION_ICONS.done,
  },
};

export const StressTest: Story = {
  render: (args) => ({
    components: { DropdownItem },
    setup() {
      return { args, STRESS_STRINGS, STRESS_CONTAINERS, ACTION_ICONS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.narrow" style="display: flex; flex-direction: column; gap: 4px;">
        <DropdownItem
          :label="STRESS_STRINGS.longWord"
          :icon="ACTION_ICONS.edit"
        />
        <DropdownItem
          :label="STRESS_STRINGS.longSentence"
          :icon="ACTION_ICONS.done"
          :trailingIcon="ACTION_ICONS.done"
          active
        />
        <DropdownItem
          :label="STRESS_STRINGS.specialChars"
          :icon="ACTION_ICONS.apple"
        />
      </div>
    `,
  }),
};
