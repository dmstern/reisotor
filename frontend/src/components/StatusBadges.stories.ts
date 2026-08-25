import type { Meta, StoryObj } from '@storybook/vue3';
import DraftBadge from './DraftBadge.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';

const meta: Meta = {
  title: 'Components/Feedback & Badges/StatusBadges',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const AllStatusBadges: Story = {
  render: () => ({
    components: { DraftBadge, PendingSyncBadge },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px; max-width: 450px;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface);">
          <span>Notiz: Packliste Kreta</span>
          <DraftBadge />
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface);">
          <span>Ausgabe: Taverna Sunset (35€)</span>
          <PendingSyncBadge />
        </div>
      </div>
    `,
  }),
};
