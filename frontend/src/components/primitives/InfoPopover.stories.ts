import type { Meta, StoryObj } from '@storybook/vue3';
import InfoPopover from './InfoPopover.vue';

const meta: Meta<typeof InfoPopover> = {
  title: 'Primitives/InfoPopover',
  component: InfoPopover,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    ariaLabel: { control: 'text' },
    iconSize: { control: 'number' },
    menuWidth: { control: 'number' },
    placement: { control: 'select', options: ['auto', 'bottom', 'top'] },
    align: { control: 'select', options: ['left', 'right'] },
  },
  args: {
    title: 'Hinweise anzeigen',
    menuWidth: 280,
  },
};

export default meta;
type Story = StoryObj<typeof InfoPopover>;

export const Default: Story = {
  render: (args) => ({
    components: { InfoPopover },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 40px; display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600;">Bereich</span>
        <InfoPopover v-bind="args">
          <p>
            <strong>Urlaubsort:</strong> z. B. Ausflugsziele, Restaurants oder Unterkünfte am Reiseziel.
          </p>
          <p>
            <strong>Heimat-Seite:</strong> z. B. der heimische Flughafen/Bahnhof/Zuhause für Reise-Etappen.
          </p>
          <p class="popover-tip">
            🗺️ Wird für das Auswählen des passenden Kartenausschnitts verwendet.
          </p>
        </InfoPopover>
      </div>
    `,
  }),
};

export const CustomContent: Story = {
  render: (args) => ({
    components: { InfoPopover },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 40px; display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600;">Touren</span>
        <InfoPopover v-bind="args" title="Was sind Touren?">
          <p>
            <strong>Touren</strong> fassen mehrere Spots zu einer gemeinsamen Route oder einem Tagesausflug zusammen.
          </p>
          <p class="popover-tip">
            💡 <strong>Tipp:</strong> Klicke auf eine Tour-Kachel, um deren Route anzuzeigen.
          </p>
        </InfoPopover>
      </div>
    `,
  }),
};
