// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import BudgetMeter from './BudgetMeter.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

describe('BudgetMeter', () => {
  let pinia: Pinia;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountMeter(props: InstanceType<typeof BudgetMeter>['$props']) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetMeter, { ...props, animated: false }),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders fully filled (100%) and in success green when nothing is spent in drain mode', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Unterkunft',
      spent: 0,
      target: 200,
    });

    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('100%');
    expect(fill.style.background).toBe('var(--color-success)');
    expect(container.querySelector('.over-badge')).toBeNull();

    cleanUp();
  });

  it('drains the bar proportionally as spending increases', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Unterkunft',
      spent: 100,
      target: 200,
    });

    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('50%');
    expect(fill.style.background).toBe('var(--color-success)');

    cleanUp();
  });

  it('switches to warning orange when remaining budget is 20% or less', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Transport',
      spent: 170,
      target: 200,
    });

    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('15%');
    expect(fill.style.background).toBe('var(--color-warning)');

    cleanUp();
  });

  it('renders empty bar (0%) when budget is completely exhausted', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Aktivitäten',
      spent: 200,
      target: 200,
    });

    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('0%');
    expect(container.querySelector('.over-badge')).toBeNull();

    cleanUp();
  });

  it('renders full danger bar (100%) and warning badge when budget is exceeded', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Transport',
      spent: 230,
      target: 200,
    });

    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('100%');
    expect(fill.style.background).toBe('var(--color-danger)');
    expect(fill.classList.contains('fill-over')).toBe(true);

    const badge = container.querySelector('.over-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('30.00\u00A0€ über Budget');

    cleanUp();
  });

  it('supports fill mode for checklist counts', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Gepackt',
      spent: 3,
      target: 10,
      format: 'count',
      color: '#3b82f6',
    });

    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('30%');
    expect(fill.style.background).toBe('rgb(59, 130, 246)');

    cleanUp();
  });

  it('renders icon instead of dot when icon prop is provided', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Gesamt',
      spent: 50,
      target: 100,
      icon: SECTION_ICON_DEFS.budget,
    });

    expect(container.querySelector('.meter-icon')).not.toBeNull();
    expect(container.querySelector('.dot')).toBeNull();

    cleanUp();
  });

  it('renders dot when no icon is provided', () => {
    const { container, cleanUp } = mountMeter({
      label: 'Sonstiges',
      spent: 20,
      target: 100,
    });

    expect(container.querySelector('.meter-icon')).toBeNull();
    expect(container.querySelector('.dot')).not.toBeNull();

    cleanUp();
  });
});
