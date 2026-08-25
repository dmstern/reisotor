import { ref } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import LikeButton from './LikeButton.vue';

const meta: Meta = {
  title: 'Components/Primitives & Actions/ActionButtons',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const AllActionButtons: Story = {
  render: () => ({
    components: { EditButton, DeleteButton, LikeButton },
    setup() {
      const liked = ref(false);
      return { liked };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px; max-width: 500px;">
        <!-- Standard Row Buttons -->
        <div>
          <h4 style="margin: 0 0 12px;">Standard & Small Action Buttons</h4>
          <div style="display: flex; gap: 12px; align-items: center;">
            <EditButton />
            <EditButton small />
            <DeleteButton />
            <DeleteButton small />
            <LikeButton :liked="liked" @click="liked = !liked" />
          </div>
        </div>

        <!-- Floating Over Image Buttons -->
        <div>
          <h4 style="margin: 0 0 12px;">Floating Action Buttons (über Bildern)</h4>
          <div style="position: relative; width: 220px; height: 120px; background: linear-gradient(135deg, #1e96d1, #2a7f74); border-radius: var(--radius-md-squircle); padding: 12px;">
            <EditButton floating />
            <DeleteButton floating style="top: 8px; right: 8px;" />
            <span style="position: absolute; bottom: 12px; left: 12px; color: white; font-weight: bold; font-size: 0.85rem;">Strand Elafonisi</span>
          </div>
        </div>
      </div>
    `,
  }),
};
