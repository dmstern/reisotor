import type { Meta, StoryObj } from '@storybook/vue3';
import WeatherAlertCard from './WeatherAlertCard.vue';

const meta: Meta<typeof WeatherAlertCard> = {
  title: 'Components/WeatherAlertCard',
  component: WeatherAlertCard,
  tags: ['autodocs'],
  argTypes: {
    severity: {
      control: 'select',
      options: ['warning', 'danger'],
    },
    title: {
      control: 'text',
    },
    description: {
      control: 'text',
    },
  },
  args: {
    severity: 'warning',
    title: 'Starkregenwarnung',
    description: 'Im Zeitraum von 14:00 bis 18:00 Uhr werden schwere Regenfälle erwartet.',
  },
};

export default meta;
type Story = StoryObj<typeof WeatherAlertCard>;

export const Warning: Story = {
  args: {
    severity: 'warning',
    title: 'Windböen',
    description: 'Böen bis zu 65 km/h möglich.',
  },
  render: (args) => ({
    components: { WeatherAlertCard },
    setup() {
      return { args };
    },
    template: '<WeatherAlertCard v-bind="args" />',
  }),
};

export const Danger: Story = {
  args: {
    severity: 'danger',
    title: 'Unwetterwarnung (Gewitter & Hagel)',
    description: 'Schwere Gewitter mit Hagelschlag erwartet. Aufenthalt im Freien vermeiden.',
  },
  render: (args) => ({
    components: { WeatherAlertCard },
    setup() {
      return { args };
    },
    template: '<WeatherAlertCard v-bind="args" />',
  }),
};
