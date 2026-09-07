import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Accordion from './Accordion.vue';
import Button from './Button.vue';
import Card from './Card.vue';

const meta: Meta<typeof Accordion> = {
  title: 'Primitives/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  argTypes: {
    expanded: { control: 'boolean' },
    inertWhenClosed: { control: 'boolean' },
    stagger: { control: 'boolean' },
  },
  args: {
    expanded: true,
    inertWhenClosed: true,
    stagger: true,
  },
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: (args) => ({
    components: { Accordion, Button, Card },
    setup() {
      const isOpen = ref(args.expanded);
      return { args, isOpen };
    },
    template: `
      <div style="max-width: 450px; font-family: var(--font-sans);">
        <Button variant="secondary" size="sm" @click="isOpen = !isOpen" style="margin-bottom: 12px;">
          {{ isOpen ? 'Zuklappen' : 'Aufklappen' }}
        </Button>
        <Accordion :expanded="isOpen" :inert-when-closed="args.inertWhenClosed" :stagger="args.stagger">
          <Card variant="muted" style="padding: 16px;">
            <p style="margin: 0; color: var(--color-text);">
              Dieser Inhalt wird sanft über die CSS-Grid-Animation (0fr -> 1fr) ein- und ausgeblendet.
            </p>
          </Card>
        </Accordion>
      </div>
    `,
  }),
};

export const WithStaggeredList: Story = {
  render: () => ({
    components: { Accordion, Button, Card },
    setup() {
      const isOpen = ref(false);
      const items = [
        'Station 1: Aussichtsplattform',
        'Station 2: Bergcafé & Rastplatz',
        'Station 3: Wasserfall-Rundweg',
        'Station 4: Talstation',
      ];
      return { isOpen, items };
    },
    template: `
      <div style="max-width: 450px; font-family: var(--font-sans);">
        <Button variant="primary" size="sm" @click="isOpen = !isOpen" style="margin-bottom: 12px;">
          {{ isOpen ? 'Stationen verbergen' : 'Stationen anzeigen (Stagger)' }}
        </Button>
        <Accordion :expanded="isOpen" :stagger="true">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <Card
              v-for="(item, idx) in items"
              :key="idx"
              variant="muted"
              :style="{ '--stagger-idx': idx, '--stagger-total': items.length }"
              style="padding: 12px 16px; border-left: 3px solid var(--color-primary);"
            >
              <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-text);">{{ item }}</span>
            </Card>
          </div>
        </Accordion>
      </div>
    `,
  }),
};
