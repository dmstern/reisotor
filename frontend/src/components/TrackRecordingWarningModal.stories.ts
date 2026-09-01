import { ref } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import TrackRecordingWarningModal from './TrackRecordingWarningModal.vue';

const meta: Meta<typeof TrackRecordingWarningModal> = {
  title: 'Components/Modals/TrackRecordingWarningModal',
  component: TrackRecordingWarningModal,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'boolean' },
  },
  args: {
    modelValue: true,
  },
};

export default meta;
type Story = StoryObj<typeof TrackRecordingWarningModal>;

export const Default: Story = {
  render: (args) => ({
    components: { TrackRecordingWarningModal },
    setup() {
      const isOpen = ref(args.modelValue);
      return { args, isOpen };
    },
    template: `
      <div>
        <button type="button" @click="isOpen = true">Hinweis-Modal öffnen</button>
        <TrackRecordingWarningModal
          v-model="isOpen"
          @confirm="isOpen = false"
        />
      </div>
    `,
  }),
};
