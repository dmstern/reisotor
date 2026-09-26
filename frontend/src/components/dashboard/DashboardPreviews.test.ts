// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
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

function createTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  return app;
}

describe('Dashboard 3D Preview Components', () => {
  describe('DashboardNotesPreview', () => {
    it('renders note preview text when notes exist', async () => {
      const app = createTestApp(DashboardNotesPreview, {
        notes: [
          {
            id: 1,
            trip_id: 1,
            title: 'Wanderkarte besorgen',
            content: '',
            content_format: 'text',
            created_by: 1,
            created_at: '',
            updated_at: '',
            is_draft: 0,
          },
        ],
      });
      const html = await renderToString(app);
      expect(html).toContain('Wanderkarte besorgen');
      expect(html).toContain('sticky-note');
      expect(html).toContain('washi-tape');
    });

    it('strips HTML tags and renders plain text when notes lack a title', async () => {
      const app = createTestApp(DashboardNotesPreview, {
        notes: [
          {
            id: 1,
            trip_id: 1,
            title: '',
            content: '<p>Wanderroute planen</p><p>Zweiter Absatz</p>',
            content_format: 'html',
            created_by: 1,
            created_at: '',
            updated_at: '',
            is_draft: 0,
          },
          {
            id: 2,
            trip_id: 1,
            title: '',
            content: '<p>Sonnencreme kaufen</p>',
            content_format: 'html',
            created_by: 1,
            created_at: '',
            updated_at: '',
            is_draft: 0,
          },
        ],
      });
      const html = await renderToString(app);
      expect(html).toContain('Wanderroute planen');
      expect(html).toContain('Sonnencreme kaufen');
      expect(html).not.toContain('<p>');
      expect(html).not.toContain('&lt;p&gt;');
    });

    it('renders placeholder when no notes exist', async () => {
      const app = createTestApp(DashboardNotesPreview, { notes: [] });
      const html = await renderToString(app);
      expect(html).toContain('Notiz schreiben');
    });
  });

  describe('DashboardTrashPreview', () => {
    it('renders empty wastebasket when count is 0', async () => {
      const app = createTestApp(DashboardTrashPreview, { count: 0 });
      const html = await renderToString(app);
      expect(html).toContain('tier-0');
      expect(html).not.toContain('ball-bottom-center');
    });

    it('renders crumpled paper balls when count > 0', async () => {
      const app = createTestApp(DashboardTrashPreview, { count: 5 });
      const html = await renderToString(app);
      expect(html).toContain('tier-3');
      expect(html).toContain('ball-bottom-center');
      expect(html).toContain('ball-top-overflow');
    });
  });

  describe('DashboardAccommodationPreview', () => {
    it('renders polaroid with photo when accommodation has image_url', async () => {
      const app = createTestApp(DashboardAccommodationPreview, {
        accommodation: {
          id: 1,
          trip_id: 1,
          title: 'Strandvilla',
          image_url: 'https://example.com/villa.jpg',
          category: 'Unterkunft',
          note: null,
          note_format: 'text',
          maps_link: null,
          lat: 0,
          lng: 0,
          created_by: 1,
          is_home: 0,
          address: null,
          start_date: null,
          end_date: null,
          checkin: null,
          checkout: null,
          contact: null,
          amount: null,
          paid_by_user_id: null,
          budget_expense_id: null,
          done: 0,
        },
      });
      const html = await renderToString(app);
      expect(html).toContain('Strandvilla');
      expect(html).toContain('src="https://example.com/villa.jpg"');
      expect(html).toContain('polaroid-card');
    });

    it('renders empty sketch when accommodation is null', async () => {
      const app = createTestApp(DashboardAccommodationPreview, { accommodation: null });
      const html = await renderToString(app);
      expect(html).toContain('is-empty');
      expect(html).toContain('Freie Wahl');
    });
  });

  describe('DashboardDiaryPreview', () => {
    it('renders open book with latest entry title', async () => {
      const app = createTestApp(DashboardDiaryPreview, {
        entries: [
          {
            id: 1,
            trip_id: 1,
            date: '2026-07-15',
            title: 'Tag am Meer',
            content: '',
            created_by: 1,
            created_at: '',
          },
        ],
        latestEntry: {
          id: 1,
          trip_id: 1,
          date: '2026-07-15',
          title: 'Tag am Meer',
          content: '',
          created_by: 1,
          created_at: '',
        },
      });
      const html = await renderToString(app);
      expect(html).toContain('Tag am Meer');
      expect(html).toContain('bookmark-ribbon');
      expect(html).toContain('travel-stamp');
    });

    it('strips HTML tags and renders plain text when diary entry lacks a title', async () => {
      const app = createTestApp(DashboardDiaryPreview, {
        entries: [],
        latestEntry: {
          id: 1,
          trip_id: 1,
          date: '2026-07-15',
          title: '',
          content: '<p>Erster Reisetag am Strand</p>',
          created_by: 1,
          created_at: '',
        },
      });
      const html = await renderToString(app);
      expect(html).toContain('Erster Reisetag am Strand');
      expect(html).not.toContain('<p>');
      expect(html).not.toContain('&lt;p&gt;');
    });
  });

  describe('DashboardSuitcasePreview', () => {
    it('renders packing layers based on percentage', async () => {
      const app = createTestApp(DashboardSuitcasePreview, { packed: 10, total: 10 });
      const html = await renderToString(app);
      expect(html).toContain('tier-4');
      expect(html).toContain('luggage-tag');
      expect(html).toContain('READY');
    });

    it('renders empty suitcase with straps when 0%', async () => {
      const app = createTestApp(DashboardSuitcasePreview, { packed: 0, total: 5 });
      const html = await renderToString(app);
      expect(html).toContain('tier-0');
      expect(html).toContain('interior-straps');
    });
  });

  describe('DashboardShoppingPreview', () => {
    it('renders grocery bag with receipt checkmarks', async () => {
      const app = createTestApp(DashboardShoppingPreview, { checked: 2, total: 4 });
      const html = await renderToString(app);
      expect(html).toContain('paper-bag');
      expect(html).toContain('receipt');
      expect(html).toContain('50% ERLEDIGT');
    });
  });

  describe('DashboardTodoPreview', () => {
    it('renders clipboard with task titles', async () => {
      const app = createTestApp(DashboardTodoPreview, {
        todos: [
          {
            id: 1,
            trip_id: 1,
            title: 'Kamera laden',
            done: 1,
            priority: 'high',
            note: null,
            due_date: null,
            assigned_to_user_id: null,
          },
        ],
        done: 1,
        total: 1,
      });
      const html = await renderToString(app);
      expect(html).toContain('Kamera laden');
      expect(html).toContain('metal-clip');
      expect(html).toContain('is-done');
    });
  });

  describe('DashboardBudgetPreview', () => {
    it('renders wallet with card and cash', async () => {
      const app = createTestApp(DashboardBudgetPreview, { spent: 200, target: 500 });
      const html = await renderToString(app);
      expect(html).toContain('credit-card');
      expect(html).toContain('bill-green');
      expect(html).toContain('coin');
    });
  });

  describe('DashboardTravelPreview', () => {
    it('renders boarding pass with route', async () => {
      const app = createTestApp(DashboardTravelPreview, {
        nextItem: {
          id: 1,
          trip_id: 1,
          title: 'Flug',
          type: 'Flug',
          from_location: 'Berlin',
          to_location: 'Lissabon',
          date: '2026-08-01',
          departure_time: '14:30',
          arrival_time: '17:00',
          checkin_info: null,
          amount: null,
          paid_by_user_id: null,
          luggage: null,
          seat: null,
          link: null,
          note: null,
          note_format: 'text',
          budget_expense_id: null,
          from_maps_link: null,
          from_lat: null,
          from_lng: null,
          to_maps_link: null,
          to_lat: null,
          to_lng: null,
          role: 'arrival',
          from_place_id: null,
          to_place_id: null,
        },
        count: 1,
      });
      const html = await renderToString(app);
      expect(html).toContain('Berlin');
      expect(html).toContain('Lissabon');
      expect(html).toContain('14:30');
      expect(html).toContain('ticket-stub');
    });
  });

  describe('DashboardCalendarPreview', () => {
    it('renders desk calendar', async () => {
      const app = createTestApp(DashboardCalendarPreview, { upcoming: [] });
      const html = await renderToString(app);
      expect(html).toContain('desk-calendar');
      expect(html).toContain('spiral-rings');
      expect(html).toContain('day-number');
    });
  });

  describe('DashboardSecurityPreview', () => {
    it('renders radar scanner with robot', async () => {
      const app = createTestApp(DashboardSecurityPreview, { destination: 'Paris' });
      const html = await renderToString(app);
      expect(html).toContain('radar-dish');
      expect(html).toContain('radar-sweep');
      expect(html).toContain('robot-wrap');
    });
  });
});
