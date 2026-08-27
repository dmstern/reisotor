import type { Meta, StoryObj } from '@storybook/vue3';
import DropdownItem from './DropdownItem.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../../utils/formFieldIcons';

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
