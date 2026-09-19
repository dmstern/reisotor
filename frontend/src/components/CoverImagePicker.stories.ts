import type { Meta, StoryObj } from '@storybook/vue3';
import CoverImagePicker from './CoverImagePicker.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

const meta: Meta<typeof CoverImagePicker> = {
  title: 'Components/CoverImagePicker',
  component: CoverImagePicker,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'text' },
    previewImage: { control: 'text' },
    modalTitle: { control: 'text' },
  },
  args: {
    modelValue: '',
    previewImage: null,
    placeholderIcon: ACTION_ICONS.vacation,
    modalTitle: 'Dashboard-Banner bearbeiten',
  },
};

export default meta;
type Story = StoryObj<typeof CoverImagePicker>;

export const DefaultVacationFallback: Story = {
  render: (args) => ({
    components: { CoverImagePicker },
    setup() {
      return { args };
    },
    template: '<CoverImagePicker v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const WithImage: Story = {
  args: {
    modelValue:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  },
  render: (args) => ({
    components: { CoverImagePicker },
    setup() {
      return { args };
    },
    template: '<CoverImagePicker v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};

export const SpotCategoryFallback: Story = {
  args: {
    placeholderIcon: SECTION_ICON_DEFS.excursions,
    iconGroup: 'categories',
    modalTitle: 'Spot-Bild bearbeiten',
  },
  render: (args) => ({
    components: { CoverImagePicker },
    setup() {
      return { args };
    },
    template: '<CoverImagePicker v-bind="args" @update:modelValue="args.modelValue = $event" />',
  }),
};
