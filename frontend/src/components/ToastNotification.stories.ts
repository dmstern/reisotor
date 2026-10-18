import type { Meta, StoryObj } from '@storybook/vue3';
import ToastNotification from './ToastNotification.vue';
import { useToast } from '../composables/useToast';
import Button from './primitives/Button.vue';

const meta: Meta<typeof ToastNotification> = {
  title: 'Components/ToastNotification',
  component: ToastNotification,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ToastNotification>;

export const InteractiveDemo: Story = {
  render: () => ({
    components: { ToastNotification, Button },
    setup() {
      const { showToast } = useToast();

      function triggerInfo() {
        showToast({
          message: 'Element gelöscht. Es befindet sich nun im Papierkorb.',
          type: 'info',
        });
      }

      function triggerSuccess() {
        showToast({ message: 'Änderungen erfolgreich gespeichert!', type: 'success' });
      }

      function triggerWarning() {
        showToast({
          message: 'Achtung: Eingaben sind noch nicht synchronisiert.',
          type: 'warning',
        });
      }

      function triggerError() {
        showToast({
          message: 'Speichern fehlgeschlagen: Datenbank-Verbindung unterbrochen (HTTP 500)',
          type: 'error',
          action: {
            label: 'Details anzeigen',
            onClick: () => {
              showToast({ message: 'Diagnose-Ansicht geöffnet.', type: 'info' });
            },
          },
        });
      }

      return { triggerInfo, triggerSuccess, triggerWarning, triggerError };
    },
    template: `
      <div style="padding: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
        <Button @click="triggerInfo">Toast (Info - Papierkorb)</Button>
        <Button variant="secondary" @click="triggerSuccess">Toast (Erfolg)</Button>
        <Button variant="secondary" @click="triggerWarning">Toast (Warnung)</Button>
        <Button variant="danger" @click="triggerError">Toast (Fehler + Action)</Button>
        <ToastNotification />
      </div>
    `,
  }),
};
