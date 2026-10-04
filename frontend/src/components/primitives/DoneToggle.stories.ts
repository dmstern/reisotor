import type { Meta, StoryObj } from '@storybook/vue3';
import DoneToggle from './DoneToggle.vue';
import WeatherIcon from '../WeatherIcon.vue';
import AppIcon from '../AppIcon.vue';
import { FORM_FIELD_ICONS } from '../../utils/formFieldIcons';

const meta: Meta<typeof DoneToggle> = {
  title: 'Primitives/DoneToggle',
  component: DoneToggle,
  tags: ['autodocs'],
  argTypes: {
    done: { control: 'boolean' },
    partiallyDone: { control: 'boolean' },
    planned: { control: 'boolean' },
    showIcon: { control: 'boolean' },
    title: { control: 'text' },
  },
  args: {
    done: false,
    partiallyDone: false,
    planned: false,
    showIcon: true,
  },
};

export default meta;
type Story = StoryObj<typeof DoneToggle>;

export const Default: Story = {
  render: (args) => ({
    components: { DoneToggle },
    setup() {
      return { args };
    },
    template: `<DoneToggle v-bind="args">Gemacht</DoneToggle>`,
  }),
};

export const PlannedWithDate: Story = {
  args: {
    planned: true,
  },
  render: (args) => ({
    components: { DoneToggle, AppIcon },
    setup() {
      return { args, FORM_FIELD_ICONS };
    },
    template: `
      <DoneToggle v-bind="args">
        <span class="done-toggle-prefix">Geplant für </span>
        <span class="done-toggle-date">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" class="done-toggle-calendar-icon" />
          03.10.
        </span>
      </DoneToggle>
    `,
  }),
};

export const PlannedWithWeather: Story = {
  args: {
    planned: true,
  },
  render: (args) => ({
    components: { DoneToggle, WeatherIcon, AppIcon },
    setup() {
      return { args, FORM_FIELD_ICONS };
    },
    template: `
      <DoneToggle v-bind="args">
        <span class="done-toggle-prefix">Geplant für </span>
        <span class="done-toggle-date">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" class="done-toggle-calendar-icon" />
          03.10.
        </span>
        <span class="done-toggle-weather">
          · <WeatherIcon :code="3" :size="14" /> 25°
        </span>
      </DoneToggle>
    `,
  }),
};

export const Completed: Story = {
  args: {
    done: true,
  },
  render: (args) => ({
    components: { DoneToggle, WeatherIcon },
    setup() {
      return { args };
    },
    template: `
      <DoneToggle v-bind="args">
        Gemacht am 03.10. · <WeatherIcon :code="1" :size="14" /> 24°
      </DoneToggle>
    `,
  }),
};

export const PartiallyCompleted: Story = {
  args: {
    partiallyDone: true,
  },
  render: (args) => ({
    components: { DoneToggle },
    setup() {
      return { args };
    },
    template: `<DoneToggle v-bind="args">Besucht an 1 von 3 Tagen</DoneToggle>`,
  }),
};
