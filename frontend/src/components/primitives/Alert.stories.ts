import type { Meta, StoryObj } from '@storybook/vue3';
import Alert from './Alert.vue';
import Button from './Button.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

const meta: Meta<typeof Alert> = {
  title: 'Primitives/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'warning', 'success', 'danger', 'neutral'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
    title: { control: 'text' },
    description: { control: 'text' },
    icon: { control: 'boolean' },
    reportable: { control: 'boolean' },
  },
  args: {
    variant: 'info',
    size: 'md',
    title: '',
    description:
      'Private Aufzeichnungen können jederzeit nachträglich für Mitreisende freigegeben werden.',
    icon: true,
    reportable: false,
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Hinweis zur Sichtbarkeit',
    description:
      'Private Aufzeichnungen können jederzeit nachträglich für Mitreisende freigegeben werden.',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Abweichendes Datum erkannt',
    description: 'Folgende ausgewählte Elemente sind für andere Tage geplant.',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Synchronisierung abgeschlossen',
    description: 'Alle lokalen Änderungen wurden erfolgreich gespeichert.',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    title: 'Verbindung fehlgeschlagen',
    description: 'Der Wetterdienst antwortet derzeit nicht. Bitte versuche es später erneut.',
  },
};

export const Neutral: Story = {
  args: {
    variant: 'neutral',
    description: 'Dieser Bereich enthält derzeit keine weiteren Einträge.',
  },
};

export const AllVariants: Story = {
  render: () => ({
    components: { Alert },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 560px;">
        <Alert variant="info" title="Info" description="Allgemeiner Hinweis oder erklärende Information." />
        <Alert variant="warning" title="Warnung" description="Etwas weicht vom erwarteten Zustand ab." />
        <Alert variant="success" title="Erfolg" description="Die Aktion wurde erfolgreich ausgeführt." />
        <Alert variant="danger" title="Fehler" description="Ein Vorgang konnte nicht abgeschlossen werden." />
        <Alert variant="neutral" title="Neutral" description="Dezenter Hinweis ohne semantische Hervorhebung." />
      </div>
    `,
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { Alert },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 560px;">
        <Alert variant="info" size="sm" description="Kompakte Variante (size='sm') für dichte Formulare." />
        <Alert variant="info" size="md" description="Standard-Variante (size='md') mit großzügigerem Innenabstand." />
      </div>
    `,
  }),
};

export const WithCustomIconAndActions: Story = {
  render: () => ({
    components: { Alert, Button },
    setup() {
      return { historyIcon: ACTION_ICONS.history };
    },
    template: `
      <div style="max-width: 560px;">
        <Alert
          variant="warning"
          size="md"
          title="Zeitdifferenz erkannt"
          description="Die gewählte Route weicht von den gespeicherten Etappenzeiten ab."
          :icon="historyIcon"
        >
          <template #actions>
            <Button size="sm" variant="secondary">Synchronisieren</Button>
          </template>
        </Alert>
      </div>
    `,
  }),
};

export const ReportableError: Story = {
  args: {
    variant: 'danger',
    size: 'sm',
    reportable: true,
    description: 'Drittanbieter antwortet nicht (HTTP 503).',
    errorContext: 'Storybook Demo',
  },
};
