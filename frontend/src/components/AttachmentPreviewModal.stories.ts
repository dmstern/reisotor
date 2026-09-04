import { ref } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import AttachmentPreviewModal from './AttachmentPreviewModal.vue';
import type { Attachment } from '../api/types';

const sampleImageAttachment: Attachment = {
  id: 1,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'test-image.jpg',
  original_name: 'Strandpromenade.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 1024 * 450,
  uploaded_by: 1,
  created_at: '2026-06-01T12:00:00Z',
  url: 'https://picsum.photos/800/600',
};

const samplePdfAttachment: Attachment = {
  id: 2,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'booking.pdf',
  original_name: 'Hotelbuchung_Bestaetigung.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024 * 1024 * 2.3,
  uploaded_by: 1,
  created_at: '2026-06-01T12:30:00Z',
  url: '/api/uploads/booking.pdf',
};

const sampleSecondImage: Attachment = {
  id: 3,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'sunset.jpg',
  original_name: 'Sonnenuntergang.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 1024 * 850,
  uploaded_by: 1,
  created_at: '2026-06-01T13:00:00Z',
  url: 'https://picsum.photos/900/600',
};

const meta: Meta<typeof AttachmentPreviewModal> = {
  title: 'Components/Modals/AttachmentPreviewModal',
  component: AttachmentPreviewModal,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'boolean' },
    initialIndex: { control: 'number' },
  },
  args: {
    modelValue: true,
    initialIndex: 0,
    attachments: [sampleImageAttachment, samplePdfAttachment, sampleSecondImage],
  },
};

export default meta;
type Story = StoryObj<typeof AttachmentPreviewModal>;

export const Default: Story = {
  render: (args) => ({
    components: { AttachmentPreviewModal },
    setup() {
      const isOpen = ref(args.modelValue);
      return { args, isOpen };
    },
    template: `
      <div>
        <button type="button" @click="isOpen = true">Anhang-Vorschau öffnen</button>
        <AttachmentPreviewModal
          v-model="isOpen"
          :attachments="args.attachments"
          :initial-index="args.initialIndex"
        />
      </div>
    `,
  }),
};

export const SingleImage: Story = {
  args: {
    attachments: [sampleImageAttachment],
  },
  render: (args) => ({
    components: { AttachmentPreviewModal },
    setup() {
      const isOpen = ref(args.modelValue);
      return { args, isOpen };
    },
    template: `
      <div>
        <button type="button" @click="isOpen = true">Einzelnes Bild öffnen</button>
        <AttachmentPreviewModal
          v-model="isOpen"
          :attachments="args.attachments"
        />
      </div>
    `,
  }),
};

export const UnsupportedType: Story = {
  args: {
    attachments: [samplePdfAttachment],
  },
  render: (args) => ({
    components: { AttachmentPreviewModal },
    setup() {
      const isOpen = ref(args.modelValue);
      return { args, isOpen };
    },
    template: `
      <div>
        <button type="button" @click="isOpen = true">PDF-Anhang öffnen</button>
        <AttachmentPreviewModal
          v-model="isOpen"
          :attachments="args.attachments"
        />
      </div>
    `,
  }),
};
