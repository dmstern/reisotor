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

  it('drains the bar proportionally as spending increases and stays green above 50% remaining', () => {
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

  it('smoothly transitions from green to yellow between 50% and 15% remaining', () => {
    // 32.5 % Restbudget (Halbwert zwischen 50 % und 15 %): 50 % Grün / 50 % Gelb Mix
    const meterMix = mountMeter({
      label: 'Transport',
      spent: 135,
      target: 200,
    });
    const fillMix = meterMix.container.querySelector('.fill') as HTMLElement;
    expect(fillMix.style.width).toBe('32.5%');
    expect(fillMix.style.background).toBe(
      'color-mix(in srgb, var(--color-success) 50%, var(--color-meter-yellow, #eab308))'
    );
    meterMix.cleanUp();

    // Exakt 15 % Restbudget: Reines Warn-Gelb
    const meterYellow = mountMeter({
      label: 'Transport',
      spent: 170,
      target: 200,
    });
    const fillYellow = meterYellow.container.querySelector('.fill') as HTMLElement;
    expect(fillYellow.style.width).toBe('15%');
    expect(fillYellow.style.background).toBe('var(--color-meter-yellow, #eab308)');
    meterYellow.cleanUp();
  });

  it('smoothly transitions from yellow to orange between 15% and 0% remaining', () => {
    // 7.5 % Restbudget (Halbwert zwischen 15 % und 0 %): 50 % Gelb / 50 % Orange Mix
    const meterMix = mountMeter({
      label: 'Essen',
      spent: 185,
      target: 200,
    });
    const fillMix = meterMix.container.querySelector('.fill') as HTMLElement;
    expect(fillMix.style.width).toBe('7.5%');
    expect(fillMix.style.background).toBe(
      'color-mix(in srgb, var(--color-meter-yellow, #eab308) 50%, var(--color-meter-orange, #ea580c))'
    );
    meterMix.cleanUp();

    // 0 % Restbudget (vollständig ausgeschöpft): Reines Orange
    const meterExhausted = mountMeter({
      label: 'Aktivitäten',
      spent: 200,
      target: 200,
    });
    const fillExhausted = meterExhausted.container.querySelector('.fill') as HTMLElement;
    expect(fillExhausted.style.width).toBe('0%');
    expect(fillExhausted.style.background).toBe('var(--color-meter-orange, #ea580c)');
    expect(meterExhausted.container.querySelector('.over-badge')).toBeNull();
    meterExhausted.cleanUp();
  });

  it('smoothly transitions from orange to danger red for slight overspend (up to 20%)', () => {
    // 10 % Überschreitung: Halbwert zwischen Orange (0%) und Danger-Rot (20%)
    const meter10 = mountMeter({
      label: 'Transport',
      spent: 220,
      target: 200,
    });
    const fill10 = meter10.container.querySelector('.fill') as HTMLElement;
    expect(fill10.style.width).toBe('10%');
    expect(fill10.style.background).toBe(
      'color-mix(in srgb, var(--color-danger) 50%, var(--color-meter-orange, #ea580c))'
    );
    expect(fill10.classList.contains('fill-over')).toBe(true);
    const badge10 = meter10.container.querySelector('.over-badge');
    expect(badge10?.textContent).toContain('20.00\u00A0€ über Budget');
    meter10.cleanUp();

    // Exakt 20 % Überschreitung: Reines Danger-Rot
    const meter20 = mountMeter({
      label: 'Transport',
      spent: 240,
      target: 200,
    });
    const fill20 = meter20.container.querySelector('.fill') as HTMLElement;
    expect(fill20.style.width).toBe('20%');
    expect(fill20.style.background).toBe('var(--color-danger)');
    meter20.cleanUp();
  });

  it('smoothly transitions from danger red to dark red for heavy overspend (above 20% up to 50%+)', () => {
    // 35 % Überschreitung: Halbwert zwischen Danger-Rot (20%) und Dunkelrot (50%)
    const meter35 = mountMeter({
      label: 'Hotel',
      spent: 135,
      target: 100,
    });
    const fill35 = meter35.container.querySelector('.fill') as HTMLElement;
    expect(fill35.style.width).toBe('35%');
    expect(fill35.style.background).toBe(
      'color-mix(in srgb, var(--color-meter-dark-red, #7f1d1d) 50%, var(--color-danger))'
    );
    meter35.cleanUp();

    // 50 % Überschreitung: Vollständiges Dunkelrot
    const meter50 = mountMeter({
      label: 'Hotel',
      spent: 150,
      target: 100,
    });
    const fill50 = meter50.container.querySelector('.fill') as HTMLElement;
    expect(fill50.style.width).toBe('50%');
    expect(fill50.style.background).toBe('var(--color-meter-dark-red, #7f1d1d)');
    meter50.cleanUp();

    // 100 % Überschreitung: Dunkelrot, auf 100 % Füllung gedeckelt
    const meter100 = mountMeter({
      label: 'Hotel',
      spent: 200,
      target: 100,
    });
    const fill100 = meter100.container.querySelector('.fill') as HTMLElement;
    expect(fill100.style.width).toBe('100%');
    expect(fill100.style.background).toBe('var(--color-meter-dark-red, #7f1d1d)');
    meter100.cleanUp();

    // 150 % Überschreitung: Gedeckelt auf 100 %
    const meter150 = mountMeter({
      label: 'Hotel',
      spent: 250,
      target: 100,
    });
    const fill150 = meter150.container.querySelector('.fill') as HTMLElement;
    expect(fill150.style.width).toBe('100%');
    expect(fill150.style.background).toBe('var(--color-meter-dark-red, #7f1d1d)');
    meter150.cleanUp();
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
