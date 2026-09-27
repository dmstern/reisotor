import type { Meta, StoryObj } from '@storybook/vue3';
import ImageUrlInput from './ImageUrlInput.vue';

const meta: Meta<typeof ImageUrlInput> = {
  title: 'Components/ImageUrlInput',
  component: ImageUrlInput,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'text' },
    placeholder: { control: 'text' },
  },
  args: {
    modelValue: '',
    placeholder: 'Bild-URL eingeben oder Bild hochladen…',
  },
};

export default meta;
type Story = StoryObj<typeof ImageUrlInput>;

export const Default: Story = {
  render: (args) => ({
    components: { ImageUrlInput },
    setup() {
      return { args };
    },
    template:
      '<div style="max-width: 400px;"><ImageUrlInput v-bind="args" @update:modelValue="args.modelValue = $event" /></div>',
  }),
};

export const WithUrl: Story = {
  args: {
    modelValue:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  },
  render: (args) => ({
    components: { ImageUrlInput },
    setup() {
      return { args };
    },
    template:
      '<div style="max-width: 400px;"><ImageUrlInput v-bind="args" @update:modelValue="args.modelValue = $event" /></div>',
  }),
};
