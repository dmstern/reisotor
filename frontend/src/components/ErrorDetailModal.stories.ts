import { onMounted } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import ErrorDetailModal from './ErrorDetailModal.vue';
import ToastNotification from './ToastNotification.vue';
import Button from './primitives/Button.vue';
import { useErrorNotifier } from '../composables/useErrorNotifier';
import { ApiError } from '../api/client';

const meta: Meta<typeof ErrorDetailModal> = {
  title: 'Components/Modals/ErrorDetailModal',
  component: ErrorDetailModal,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorDetailModal>;

export const ApiErrorModal: Story = {
  render: () => ({
    components: { ErrorDetailModal, ToastNotification, Button },
    setup() {
      const { notifyError, openErrorModal, clearErrors } = useErrorNotifier();

      function showApiError() {
        clearErrors();
        const err = new ApiError(500, 'SQLITE_BUSY: database is locked', {
          method: 'PUT',
          path: '/diary/42',
        });
        const captured = notifyError(err, {
          context: 'Tagebucheintrag konnte nicht gespeichert werden',
          silent: true,
        });
        if (captured) openErrorModal(captured);
      }

      function triggerToastFlow() {
        clearErrors();
        const err = new ApiError(422, 'Titel darf nicht leer sein', {
          method: 'POST',
          path: '/spots',
        });
        notifyError(err, 'Spot konnte nicht angelegt werden');
      }

      onMounted(() => {
        showApiError();
      });

      return { showApiError, triggerToastFlow };
    },
    template: `
      <div style="padding: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
        <Button @click="showApiError">Diagnose-Modal öffnen (API 500)</Button>
        <Button variant="danger" @click="triggerToastFlow">Fehler-Toast mit „Details anzeigen“ feuern</Button>
        <ToastNotification />
        <ErrorDetailModal />
      </div>
    `,
  }),
};

export const RuntimeAndSyncErrors: Story = {
  render: () => ({
    components: { ErrorDetailModal, ToastNotification, Button },
    setup() {
      const { notifyError, notifyOutboxRejected, openErrorModal, clearErrors } = useErrorNotifier();

      function triggerRuntimeError() {
        clearErrors();
        const err = new TypeError("Cannot read properties of undefined (reading 'lat')");
        const captured = notifyError(err, {
          componentInfo: 'MapView · render',
        });
        if (captured) openErrorModal(captured);
      }

      function triggerOutboxConflict() {
        clearErrors();
        const err = new ApiError(404, 'Eintrag wurde zwischenzeitlich gelöscht', {
          method: 'PUT',
          path: '/schedule/19',
        });
        const captured = notifyOutboxRejected(
          {
            id: 'demo-outbox-1',
            method: 'PUT',
            path: '/schedule/19',
            body: { title: 'Fähre nach Sardinien' },
            createdAt: new Date().toISOString(),
          },
          err
        );
        if (captured) openErrorModal(captured);
      }

      return { triggerRuntimeError, triggerOutboxConflict };
    },
    template: `
      <div style="padding: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
        <Button variant="secondary" @click="triggerRuntimeError">Laufzeitfehler (TypeError)</Button>
        <Button variant="secondary" @click="triggerOutboxConflict">Offline-Sync-Konflikt (HTTP 404)</Button>
        <ToastNotification />
        <ErrorDetailModal />
      </div>
    `,
  }),
};
