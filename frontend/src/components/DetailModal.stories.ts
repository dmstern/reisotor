import { ref } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import DetailModal from './DetailModal.vue';
import DetailRow from './primitives/DetailRow.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SCHEDULE_CATEGORY_META, TOUR_COLOR } from '../utils/scheduleCategory';

const meta: Meta<typeof DetailModal> = {
  title: 'Components/Modals/DetailModal',
  component: DetailModal,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'boolean' },
    title: { control: 'text' },
    imageUrl: { control: 'text' },
    categoryLabel: { control: 'text' },
    editable: { control: 'boolean' },
    themeColor: { control: 'color' },
    themeTint: { control: 'text' },
  },
  args: {
    modelValue: true,
    title: 'Tour durch den Nationalpark',
    categoryLabel: 'Tour',
    categoryIcon: SCHEDULE_CATEGORY_META.excursion.tabler,
    themeColor: TOUR_COLOR,
    themeTint: 'var(--color-tour-tint)',
    editable: true,
  },
};

export default meta;
type Story = StoryObj<typeof DetailModal>;

export const WithPhoto: Story = {
  render: (args) => ({
    components: { DetailModal, DetailRow, AppIcon, Button },
    setup() {
      const open = ref(true);
      return { args, open, FORM_FIELD_ICONS, ACTION_ICONS };
    },
    template: `
      <div>
        <Button @click="open = true">Modal öffnen</Button>
        <DetailModal v-bind="args" :model-value="open" @update:model-value="v => open = v">
          <template #meta>
            <span class="detail-badge">
              <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
              Di., 29.09.2026
            </span>
            <span class="detail-badge weather-badge">
              ☀️ 24° / 17°
            </span>
          </template>
          <DetailRow label="Zeit">
            <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" /> 10:00 – 16:30
          </DetailRow>
          <DetailRow label="Treffpunkt">
            <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" /> Haupteingang Nationalpark
          </DetailRow>
          <p style="margin: 8px 0 0; font-size: 0.92rem; line-height: 1.5; color: var(--color-text);">
            Wunderschöner Wanderweg entlang der Steilküste. Feste Wanderschuhe und ausreichend Wasser mitbringen!
          </p>
        </DetailModal>
      </div>
    `,
  }),
  args: {
    title: 'Klippenwanderung & Panoramablick',
    imageUrl:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    categoryLabel: 'Tour',
    categoryIcon: SCHEDULE_CATEGORY_META.excursion.tabler,
    themeColor: TOUR_COLOR,
    themeTint: 'var(--color-tour-tint)',
  },
};

export const WithCollage: Story = {
  render: (args) => ({
    components: { DetailModal, DetailRow, AppIcon, Button },
    setup() {
      const open = ref(true);
      return { args, open, FORM_FIELD_ICONS };
    },
    template: `
      <div>
        <Button @click="open = true">Modal öffnen</Button>
        <DetailModal v-bind="args" :model-value="open" @update:model-value="v => open = v">
          <template #meta>
            <span class="detail-badge">
              <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
              Mi., 30.09.2026
            </span>
          </template>
          <DetailRow label="Stationen">
            3 Orte eingeplant
          </DetailRow>
        </DetailModal>
      </div>
    `,
  }),
  args: {
    title: 'Highlights der Altstadt',
    imageUrl: null,
    collageImages: [
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520986606214-8b456906c813?w=400&auto=format&fit=crop&q=80',
    ],
    categoryLabel: 'Ausflug',
    categoryIcon: SCHEDULE_CATEGORY_META.excursion.tabler,
    themeColor: TOUR_COLOR,
  },
};

export const PlaceholderHero: Story = {
  render: (args) => ({
    components: { DetailModal, DetailRow, AppIcon, Button },
    setup() {
      const open = ref(true);
      return { args, open, FORM_FIELD_ICONS };
    },
    template: `
      <div>
        <Button @click="open = true">Modal öffnen</Button>
        <DetailModal v-bind="args" :model-value="open" @update:model-value="v => open = v">
          <template #meta>
            <span class="detail-badge">
              <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
              Do., 01.10.2026
            </span>
          </template>
          <DetailRow label="Zeit">
            <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" /> 19:30 Uhr
          </DetailRow>
          <DetailRow label="Ort">
            <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" /> Osteria del Sole
          </DetailRow>
        </DetailModal>
      </div>
    `,
  }),
  args: {
    title: 'Abendessen mit Freunden',
    imageUrl: null,
    placeholderIcon: SCHEDULE_CATEGORY_META.other.tabler,
    categoryLabel: 'Termin',
    categoryIcon: SCHEDULE_CATEGORY_META.other.tabler,
    themeColor: '#8a8a86',
  },
};
