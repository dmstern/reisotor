import type { Meta, StoryObj } from '@storybook/vue3';
import ButtonGroup from './ButtonGroup.vue';
import Button from './Button.vue';

const meta: Meta<typeof ButtonGroup> = {
  title: 'Primitives/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  argTypes: {
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch'],
    },
    noMargin: { control: 'boolean' },
  },
  args: {
    align: 'end',
    noMargin: false,
  },
};

export default meta;
type Story = StoryObj<typeof ButtonGroup>;

export const AlignEnd: Story = {
  args: { align: 'end' },
  render: (args) => ({
    components: { ButtonGroup, Button },
    setup() {
      return { args };
    },
    template: `
      <ButtonGroup v-bind="args">
        <Button variant="secondary">Abbrechen</Button>
        <Button variant="primary">Speichern</Button>
      </ButtonGroup>
    `,
  }),
};

export const Stretch: Story = {
  args: { align: 'stretch' },
  render: (args) => ({
    components: { ButtonGroup, Button },
    setup() {
      return { args };
    },
    template: `
      <ButtonGroup v-bind="args">
        <Button variant="secondary">Zurück</Button>
        <Button variant="primary">Weiter</Button>
      </ButtonGroup>
    `,
  }),
};
