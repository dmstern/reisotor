import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import RadioCard from './RadioCard.vue';
import Badge from './Badge.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

const meta: Meta<typeof RadioCard> = {
  title: 'Primitives/RadioCard',
  component: RadioCard,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['card', 'muted', 'row'] },
    radioPosition: { control: 'select', options: ['left', 'right'] },
    radioSize: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    description: { control: 'text' },
  },
  args: {
    label: 'Nur für mich sichtbar',
    description: 'Nur du kannst diese Aufzeichnung sehen und verwalten.',
    variant: 'card',
    radioPosition: 'right',
    radioSize: 'sm',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof RadioCard>;

export const GroupExample: Story = {
  render: (args) => ({
    components: { RadioCard, Badge },
    setup() {
      const selected = ref<'private' | 'shared'>('private');
      return {
        args,
        selected,
        privateIcon: ACTION_ICONS.private,
        sharedIcon: ACTION_ICONS.shared,
      };
    },
    template: `
      <div style="max-width: 460px; display: flex; flex-direction: column; gap: 8px;" role="radiogroup" aria-label="Sichtbarkeit">
        <RadioCard
          v-bind="args"
          v-model="selected"
          name="sb-visibility"
          value="private"
          :icon="privateIcon"
          label="Nur für mich sichtbar"
          description="Nur du kannst diese Aufzeichnung sehen und verwalten. Mitreisende haben keinen Zugriff darauf."
        >
          <template #badge>
            <Badge :variant="selected === 'private' ? 'primary' : 'default'" size="sm">Privat</Badge>
          </template>
        </RadioCard>

        <RadioCard
          v-bind="args"
          v-model="selected"
          name="sb-visibility"
          value="shared"
          :icon="sharedIcon"
          label="Für alle Mitreisenden sichtbar"
          description="Alle Mitglieder dieses Urlaubs können diese Aufzeichnung auf der Karte und in Touren sehen."
        >
          <template #badge>
            <Badge :variant="selected === 'shared' ? 'primary' : 'default'" size="sm">Geteilt</Badge>
          </template>
        </RadioCard>
      </div>
    `,
  }),
};

export const RadioLeft: Story = {
  render: () => ({
    components: { RadioCard },
    setup() {
      const selected = ref('fastest');
      return { selected };
    },
    template: `
      <div style="max-width: 440px; display: flex; flex-direction: column; gap: 8px;" role="radiogroup" aria-label="Routenpräferenz">
        <RadioCard
          v-model="selected"
          name="sb-route"
          value="fastest"
          radio-position="left"
          label="Schnellste Route"
          description="Minimiert die reine Fahrzeit über Autobahnen und Schnellstraßen."
        />
        <RadioCard
          v-model="selected"
          name="sb-route"
          value="shortest"
          radio-position="left"
          label="Kürzeste Route"
          description="Wählt die geringste Kilometerzahl."
        />
      </div>
    `,
  }),
};

export const MutedVariant: Story = {
  render: () => ({
    components: { RadioCard },
    setup() {
      const selected = ref('a');
      return { selected };
    },
    template: `
      <div style="max-width: 440px; display: flex; flex-direction: column; gap: 8px;">
        <RadioCard
          v-model="selected"
          variant="muted"
          name="sb-muted"
          value="a"
          label="Kompakte Kachel A"
          description="Für dichte Dialoge und Popover-Menüs."
        />
        <RadioCard
          v-model="selected"
          variant="muted"
          name="sb-muted"
          value="b"
          label="Kompakte Kachel B"
          description="Mit taktilem 3D-Feedback."
        />
      </div>
    `,
  }),
};

export const RowVariant: Story = {
  render: () => ({
    components: { RadioCard },
    setup() {
      const selected = ref('a');
      return { selected };
    },
    template: `
      <div style="max-width: 440px; display: flex; flex-direction: column; gap: 4px;">
        <RadioCard
          v-model="selected"
          variant="row"
          radio-position="left"
          name="sb-row"
          value="a"
          label="Kompakte Zeile A"
          description="Ohne Kachel-Hintergrund."
        />
        <RadioCard
          v-model="selected"
          variant="row"
          radio-position="left"
          name="sb-row"
          value="b"
          label="Kompakte Zeile B"
          description="Für dichte Listen."
        />
      </div>
    `,
  }),
};

export const Disabled: Story = {
  render: () => ({
    components: { RadioCard },
    template: `
      <div style="max-width: 440px; display: flex; flex-direction: column; gap: 8px;">
        <RadioCard :checked="false" disabled label="Nicht gewählt & deaktiviert" description="Derzeit gesperrt." />
        <RadioCard :checked="true" disabled label="Gewählt & deaktiviert" description="Aktive, aber gesperrte Option." />
      </div>
    `,
  }),
};
