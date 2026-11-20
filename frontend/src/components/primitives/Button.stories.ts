import type { Meta, StoryObj } from '@storybook/vue3';
import Button from './Button.vue';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../../stories/stressFixtures';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tonal', 'ghost', 'danger', 'overlay'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
    },
    shape: {
      control: 'select',
      options: ['squircle', 'circle', 'pill'],
    },
    disabled: {
      control: 'boolean',
    },
    active: {
      control: 'boolean',
    },
  },
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    active: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Primary Button</Button>',
  }),
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Secondary Button</Button>',
  }),
};

export const Tonal: Story = {
  args: {
    variant: 'tonal',
    size: 'sm',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Tonal Action</Button>',
  }),
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Ghost Button</Button>',
  }),
};

export const Danger: Story = {
  args: {
    variant: 'danger',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Danger Button</Button>',
  }),
};

export const DangerSecondary: Story = {
  args: {
    variant: 'danger',
    secondary: true,
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Danger Secondary</Button>',
  }),
};

export const Overlay: Story = {
  args: {
    variant: 'overlay',
    shape: 'pill',
    size: 'sm',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 24px; border-radius: 16px; background: linear-gradient(135deg, #2d5a7b 0%, #3c6e58 100%);">
        <Button v-bind="args">Bild ändern</Button>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Disabled Button</Button>',
  }),
};

export const Active: Story = {
  args: {
    variant: 'secondary',
    active: true,
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args">Aktiver Button</Button>',
  }),
};

export const StressTest: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args, STRESS_STRINGS, STRESS_CONTAINERS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.narrow" style="display: flex; flex-direction: column; gap: 8px;">
        <Button v-bind="args">{{ STRESS_STRINGS.longWord }}</Button>
        <Button variant="secondary" v-bind="args">{{ STRESS_STRINGS.specialChars }}</Button>
      </div>
    `,
  }),
};
