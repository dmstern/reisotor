import type { Meta, StoryObj } from '@storybook/vue3';
import PolaroidStack from './PolaroidStack.vue';
import { spotCategoryMeta } from '../../utils/spotCategory';
import type { Attachment } from '../../api/types';

const samplePhoto1: Attachment = {
  id: 1,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'strand.jpg',
  original_name: 'Strandpromenade.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 1024 * 450,
  uploaded_by: 1,
  created_at: '2026-06-01T12:00:00Z',
  url: 'https://picsum.photos/seed/strand/400/300',
};

const samplePhoto2: Attachment = {
  id: 2,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'sunset.jpg',
  original_name: 'Sonnenuntergang.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 1024 * 850,
  uploaded_by: 1,
  created_at: '2026-06-01T13:00:00Z',
  url: 'https://picsum.photos/seed/sunset/400/300',
};

const samplePdf: Attachment = {
  id: 3,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'tickets.pdf',
  original_name: 'Faehre_Ticket.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024 * 1024 * 1.5,
  uploaded_by: 1,
  created_at: '2026-06-01T13:30:00Z',
  url: '/api/uploads/tickets.pdf',
};

const sampleDoc: Attachment = {
  id: 4,
  trip_id: 1,
  domain: 'spots',
  entity_id: 10,
  filename: 'info.doc',
  original_name: 'Wanderroute_Notizen.doc',
  mime_type: 'application/msword',
  size_bytes: 1024 * 320,
  uploaded_by: 1,
  created_at: '2026-06-01T14:00:00Z',
  url: '/api/uploads/info.doc',
};

const samplePhoto3 = 'https://picsum.photos/seed/alps/400/300';
const samplePhoto4 = 'https://picsum.photos/seed/cafe/400/300';
const samplePhoto5 = 'https://picsum.photos/seed/harbor/400/300';

const meta: Meta<typeof PolaroidStack> = {
  title: 'Components/Primitives/PolaroidStack',
  component: PolaroidStack,
  tags: ['autodocs'],
  argTypes: {
    clipped: { control: 'boolean' },
    interactive: { control: 'boolean' },
    fanned: { control: 'boolean' },
    size: { control: 'select', options: ['sm', 'md'] },
    maxVisible: { control: 'number' },
  },
  args: {
    clipped: true,
    interactive: true,
    fanned: false,
    size: 'sm',
    maxVisible: 4,
  },
};

export default meta;
type Story = StoryObj<typeof PolaroidStack>;

export const SinglePhoto: Story = {
  args: {
    items: [samplePhoto1],
    clipped: false,
  },
};

export const PhotoStackWithClip: Story = {
  args: {
    items: [samplePhoto1, samplePhoto2, samplePhoto3],
    clipped: true,
  },
};

export const FannedOutStack: Story = {
  args: {
    items: [samplePhoto1, samplePhoto2, samplePhoto3],
    clipped: true,
    fanned: true,
  },
};

export const DocumentPrintoutWithClip: Story = {
  args: {
    items: [samplePdf],
    clipped: true,
  },
};

export const MixedAttachmentsWithClip: Story = {
  args: {
    items: [samplePhoto1, samplePdf, sampleDoc, samplePhoto2],
    clipped: true,
  },
};

export const OverflowBadge: Story = {
  args: {
    items: [samplePhoto1, samplePhoto2, samplePdf, samplePhoto3, samplePhoto4, samplePhoto5],
    clipped: true,
    maxVisible: 3,
  },
};

export const TourStationsPreview: Story = {
  args: {
    clipped: false,
    items: [
      { key: 1, title: 'Miradouro', imageUrl: samplePhoto1.url },
      {
        key: 2,
        title: 'Pastéis de Belém',
        tabler: spotCategoryMeta('Restaurant').tabler,
        color: spotCategoryMeta('Restaurant').color,
      },
      {
        key: 3,
        title: 'Castelo de S. Jorge',
        tabler: spotCategoryMeta('Sehenswürdigkeit').tabler,
        color: spotCategoryMeta('Sehenswürdigkeit').color,
      },
    ],
  },
};
