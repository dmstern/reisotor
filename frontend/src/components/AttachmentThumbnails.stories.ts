import type { Meta, StoryObj } from '@storybook/vue3';
import AttachmentThumbnails from './AttachmentThumbnails.vue';
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

const meta: Meta<typeof AttachmentThumbnails> = {
  title: 'Components/Primitives/AttachmentThumbnails',
  component: AttachmentThumbnails,
  tags: ['autodocs'],
  argTypes: {
    editable: { control: 'boolean' },
  },
  args: {
    editable: true,
    items: [sampleImageAttachment, samplePdfAttachment, sampleSecondImage],
  },
};

export default meta;
type Story = StoryObj<typeof AttachmentThumbnails>;

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    editable: false,
  },
};

export const StringUrls: Story = {
  args: {
    items: [
      'https://picsum.photos/400/400?1',
      'https://picsum.photos/400/400?2',
      'https://picsum.photos/400/400?3',
    ],
  },
};
