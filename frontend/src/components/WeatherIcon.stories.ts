import type { Meta, StoryObj } from '@storybook/vue3';
import WeatherIcon from './WeatherIcon.vue';

const meta: Meta<typeof WeatherIcon> = {
  title: 'Components/Media & Icons/WeatherIcon',
  component: WeatherIcon,
  tags: ['autodocs'],
  argTypes: {
    code: {
      control: { type: 'number' },
      description: 'Open-Meteo Weather Code (0: Sonne, 1-3: Bewölkt, 61: Regen, 95: Gewitter, 71: Schnee)',
    },
    size: {
      control: { type: 'number' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WeatherIcon>;

export const ClearSky: Story = {
  args: {
    code: 0,
    size: 32,
    title: 'Sonnig',
  },
};

export const Rain: Story = {
  args: {
    code: 61,
    size: 32,
    title: 'Mäßiger Regen',
  },
};

export const Thunderstorm: Story = {
  args: {
    code: 95,
    size: 32,
    title: 'Gewitter',
  },
};

export const Snow: Story = {
  args: {
    code: 71,
    size: 32,
    title: 'Schneefall',
  },
};

export const AllWeatherCodesShowcase: Story = {
  render: () => ({
    components: { WeatherIcon },
    setup() {
      const weatherSamples = [
        { code: 0, label: 'Klar / Sonnig' },
        { code: 2, label: 'Teilweise bewölkt' },
        { code: 3, label: 'Bedeckt' },
        { code: 45, label: 'Nebel' },
        { code: 51, label: 'Sprühregen' },
        { code: 63, label: 'Starker Regen' },
        { code: 71, label: 'Schneefall' },
        { code: 95, label: 'Gewitter' },
      ];
      return { weatherSamples };
    },
    template: `
      <div style="display: flex; gap: 20px; flex-wrap: wrap; padding: 16px;">
        <div
          v-for="w in weatherSamples"
          :key="w.code"
          style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-surface); width: 110px;"
        >
          <WeatherIcon :code="w.code" :size="32" />
          <span style="font-size: 0.75rem; text-align: center; color: var(--color-text-muted);">{{ w.label }}</span>
        </div>
      </div>
    `,
  }),
};
