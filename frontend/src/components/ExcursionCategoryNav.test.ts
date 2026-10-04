import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionCategoryNav from './ExcursionCategoryNav.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

describe('ExcursionCategoryNav', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const dummyGroups = [
    { category: 'Strand', iconDef: FORM_FIELD_ICONS.category },
    { category: 'Restaurant', iconDef: FORM_FIELD_ICONS.category },
    { category: 'Kultur', iconDef: FORM_FIELD_ICONS.category },
  ];

  function render(props: any) {
    const app = createApp({
      render: () => h(ExcursionCategoryNav, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders category items and active category styling', async () => {
    const html = await render({
      spotGroups: dummyGroups,
      activeCategory: 'Restaurant',
      isStuck: false,
      underlineLeft: 50,
      underlineWidth: 60,
      canScrollLeft: true,
      canScrollRight: false,
    });

    expect(html).toContain('category-nav-wrap');
    expect(html).toContain('Strand');
    expect(html).toContain('Restaurant');
    expect(html).toContain('Kultur');
    expect(html).toContain('active');
    expect(html).toContain('translateX(50px)');
    expect(html).toContain('60px');
    expect(html).toContain('category-nav-arrow left');
    expect(html).not.toContain('category-nav-arrow right');
  });

  it('applies is-stuck class when stuck', async () => {
    const html = await render({
      spotGroups: dummyGroups,
      activeCategory: 'Strand',
      isStuck: true,
      underlineLeft: 0,
      underlineWidth: 40,
      canScrollLeft: false,
      canScrollRight: true,
    });

    expect(html).toContain('is-stuck');
    expect(html).toContain('category-nav-arrow right');
    expect(html).not.toContain('category-nav-arrow left');
  });

  it('renders nothing when spotGroups has 1 or fewer items', async () => {
    const html = await render({
      spotGroups: [{ category: 'Solo', iconDef: FORM_FIELD_ICONS.category }],
      activeCategory: 'Solo',
      isStuck: false,
      underlineLeft: 0,
      underlineWidth: 0,
      canScrollLeft: false,
      canScrollRight: false,
    });

    expect(html).not.toContain('category-nav-wrap');
    expect(html).not.toContain('category-nav-sentinel');
  });
});
