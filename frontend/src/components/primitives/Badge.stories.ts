import type { Meta, StoryObj } from '@storybook/vue3';
import Badge from './Badge.vue';
import { STRESS_STRINGS, STRESS_CONTAINERS } from '../../stories/stressFixtures';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'danger', 'accent', 'warning', 'accent-secondary'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
  args: {
    variant: 'default',
    size: 'sm',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Standard Badge</Badge>`,
  }),
};

export const Primary: Story = {
  args: { variant: 'primary' },
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Primary Status</Badge>`,
  }),
};

export const Success: Story = {
  args: { variant: 'success' },
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Aktiv</Badge>`,
  }),
};

export const Danger: Story = {
  args: { variant: 'danger' },
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Gefahr / Fehler</Badge>`,
  }),
};

export const Accent: Story = {
  args: { variant: 'accent' },
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Echtzeit-Update</Badge>`,
  }),
};

export const Warning: Story = {
  args: { variant: 'warning' },
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Ausstehend</Badge>`,
  }),
};

export const AccentSecondary: Story = {
  args: { variant: 'accent-secondary' },
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args };
    },
    template: `<Badge v-bind="args">Admin</Badge>`,
  }),
};

export const StressTest: Story = {
  render: (args) => ({
    components: { Badge },
    setup() {
      return { args, STRESS_STRINGS, STRESS_CONTAINERS };
    },
    template: `
      <div :style="STRESS_CONTAINERS.ultraNarrow" style="display: flex; flex-direction: column; gap: 8px;">
        <Badge v-bind="args">{{ STRESS_STRINGS.longWord }}</Badge>
        <Badge variant="accent" v-bind="args">{{ STRESS_STRINGS.specialChars }}</Badge>
      </div>
    `,
  }),
};
