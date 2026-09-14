import type { Meta, StoryObj } from '@storybook/vue3';
import DashboardNotesPreview from './DashboardNotesPreview.vue';
import DashboardTrashPreview from './DashboardTrashPreview.vue';
import DashboardAccommodationPreview from './DashboardAccommodationPreview.vue';
import DashboardDiaryPreview from './DashboardDiaryPreview.vue';
import DashboardSuitcasePreview from './DashboardSuitcasePreview.vue';
import DashboardShoppingPreview from './DashboardShoppingPreview.vue';
import DashboardTodoPreview from './DashboardTodoPreview.vue';
import DashboardBudgetPreview from './DashboardBudgetPreview.vue';
import DashboardTravelPreview from './DashboardTravelPreview.vue';
import DashboardCalendarPreview from './DashboardCalendarPreview.vue';
import DashboardSecurityPreview from './DashboardSecurityPreview.vue';

const meta: Meta = {
  title: 'Dashboard/3D Preview Cards',
  tags: ['autodocs'],
};

export default meta;

export const StickyNotesWithNotes: StoryObj = {
  render: () => ({
    components: { DashboardNotesPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardNotesPreview :notes="[
          { id: 1, trip_id: 1, title: 'Wanderschuhe imprägnieren', content: '', content_format: 'text', created_by: 1, created_at: '', updated_at: '', is_draft: 0 },
          { id: 2, trip_id: 1, title: 'Gipfel-Picknick planen', content: '', content_format: 'text', created_by: 1, created_at: '', updated_at: '', is_draft: 0 }
        ]" />
      </div>
    `,
  }),
};

export const StickyNotesEmpty: StoryObj = {
  render: () => ({
    components: { DashboardNotesPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardNotesPreview :notes="[]" />
      </div>
    `,
  }),
};

export const WastebasketStates: StoryObj = {
  render: () => ({
    components: { DashboardTrashPreview },
    template: `
      <div style="display: flex; gap: 20px; background: var(--color-surface); padding: 24px; border-radius: 12px;">
        <div>
          <p style="font-size: 12px; text-align: center;">Leer (0)</p>
          <DashboardTrashPreview :count="0" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">1 Objekt</p>
          <DashboardTrashPreview :count="1" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">3 Objekte</p>
          <DashboardTrashPreview :count="3" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">5+ Objekte (Voll)</p>
          <DashboardTrashPreview :count="6" />
        </div>
      </div>
    `,
  }),
};

export const AccommodationPolaroid: StoryObj = {
  render: () => ({
    components: { DashboardAccommodationPreview },
    template: `
      <div style="display: flex; gap: 20px; background: var(--color-surface); padding: 24px; border-radius: 12px;">
        <div>
          <p style="font-size: 12px; text-align: center;">Mit Foto</p>
          <DashboardAccommodationPreview :accommodation="{
            id: 1, trip_id: 1, title: 'Hotel Miramar', image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200',
            category: 'Unterkunft', note: null, note_format: 'text', maps_link: null, lat: 0, lng: 0, created_by: 1, is_home: 0,
            address: null, start_date: '2026-07-12', end_date: '2026-07-18', checkin: null, checkout: null, contact: null,
            amount: 0, paid_by_user_id: null, budget_expense_id: null, done: 0
          }" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">Ohne Foto (Illustration)</p>
          <DashboardAccommodationPreview :accommodation="{
            id: 2, trip_id: 1, title: 'Alpen-Chalet', image_url: null,
            category: 'Unterkunft', note: null, note_format: 'text', maps_link: null, lat: 0, lng: 0, created_by: 1, is_home: 0,
            address: null, start_date: '2026-07-12', end_date: '2026-07-18', checkin: null, checkout: null, contact: null,
            amount: 0, paid_by_user_id: null, budget_expense_id: null, done: 0
          }" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">Keine Buchung</p>
          <DashboardAccommodationPreview :accommodation="null" />
        </div>
      </div>
    `,
  }),
};

export const OpenDiary: StoryObj = {
  render: () => ({
    components: { DashboardDiaryPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardDiaryPreview
          :entries="[
            { id: 1, trip_id: 1, date: '2026-07-14', title: 'Ankunft in Rom', content: '', created_by: 1, created_at: '' }
          ]"
          :latest-entry="{ id: 1, trip_id: 1, date: '2026-07-14', title: 'Ankunft in Rom', content: '', created_by: 1, created_at: '' }"
        />
      </div>
    `,
  }),
};

export const SuitcasePackingProgress: StoryObj = {
  render: () => ({
    components: { DashboardSuitcasePreview },
    template: `
      <div style="display: flex; gap: 20px; background: var(--color-surface); padding: 24px; border-radius: 12px;">
        <div>
          <p style="font-size: 12px; text-align: center;">0% (Leer)</p>
          <DashboardSuitcasePreview :packed="0" :total="10" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">25%</p>
          <DashboardSuitcasePreview :packed="2" :total="8" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">60%</p>
          <DashboardSuitcasePreview :packed="6" :total="10" />
        </div>
        <div>
          <p style="font-size: 12px; text-align: center;">100% (Ready)</p>
          <DashboardSuitcasePreview :packed="10" :total="10" />
        </div>
      </div>
    `,
  }),
};

export const ShoppingBagReceipt: StoryObj = {
  render: () => ({
    components: { DashboardShoppingPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardShoppingPreview :checked="3" :total="5" />
      </div>
    `,
  }),
};

export const ClipboardTodos: StoryObj = {
  render: () => ({
    components: { DashboardTodoPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardTodoPreview
          :todos="[
            { id: 1, trip_id: 1, title: 'Reisepass prüfen', done: 1, priority: 'high', note: null, due_date: null, assigned_to_user_id: null },
            { id: 2, trip_id: 1, title: 'Vignette kaufen', done: 0, priority: 'medium', note: null, due_date: null, assigned_to_user_id: null }
          ]"
          :done="1"
          :total="2"
        />
      </div>
    `,
  }),
};

export const TravelWallet: StoryObj = {
  render: () => ({
    components: { DashboardBudgetPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardBudgetPreview :spent="450" :target="1000" />
      </div>
    `,
  }),
};

export const BoardingPassTicket: StoryObj = {
  render: () => ({
    components: { DashboardTravelPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardTravelPreview
          :next-item="{
            id: 1, trip_id: 1, title: 'Flug nach Rom', type: 'Flug',
            from_location: 'MUC', to_location: 'FCO', date: '2026-07-12',
            departure_time: '10:30', arrival_time: '12:05', checkin_info: null,
            amount: null, paid_by_user_id: null, luggage: null, seat: '12A',
            link: null, note: null, note_format: 'text', budget_expense_id: null,
            from_maps_link: null, from_lat: null, from_lng: null, to_maps_link: null,
            to_lat: null, to_lng: null, role: 'arrival', from_place_id: null, to_place_id: null
          }"
          :count="1"
        />
      </div>
    `,
  }),
};

export const DeskCalendar: StoryObj = {
  render: () => ({
    components: { DashboardCalendarPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardCalendarPreview :upcoming="[]" />
      </div>
    `,
  }),
};

export const SecurityRadarScanner: StoryObj = {
  render: () => ({
    components: { DashboardSecurityPreview },
    template: `
      <div style="background: var(--color-surface); padding: 24px; border-radius: 12px; width: 260px;">
        <DashboardSecurityPreview destination="Rom" />
      </div>
    `,
  }),
};
