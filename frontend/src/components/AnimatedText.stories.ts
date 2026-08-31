import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import AnimatedText from './AnimatedText.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const meta: Meta<typeof AnimatedText> = {
  title: 'Components/AnimatedText',
  component: AnimatedText,
  tags: ['autodocs'],
  argTypes: {
    text: { control: 'text' },
    direction: { control: { type: 'select' }, options: ['up', 'down', 'auto'] },
  },
  args: {
    text: 'Spots',
    options: ['Spots', 'Touren'],
    direction: 'up',
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedText>;

export const Default: Story = {
  render: (args) => ({
    components: { AnimatedText },
    setup() {
      return { args };
    },
    template: '<AnimatedText v-bind="args" />',
  }),
};

export const ToggleDrawerHeading: Story = {
  render: () => ({
    components: { AnimatedText, Button },
    setup() {
      const mode = ref<'spots' | 'tours'>('spots');
      const toggle = () => {
        mode.value = mode.value === 'spots' ? 'tours' : 'spots';
      };
      return { mode, toggle };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start; padding: 16px; background: var(--bg-surface, #1e1e1e); color: var(--text-color, #fff); border-radius: 8px;">
        <Button size="sm" variant="secondary" @click="toggle">
          Umschalten (Aktuell: {{ mode }})
        </Button>
        <h2 style="font-size: 1.5rem; margin: 0;">
          <AnimatedText
            :text="mode === 'tours' ? 'Touren' : 'Spots'"
            :options="['Spots', 'Touren']"
            :direction="mode === 'tours' ? 'up' : 'down'"
          />
        </h2>
      </div>
    `,
  }),
};

export const ButtonWithAnimatedLabel: Story = {
  render: () => ({
    components: { AnimatedText, Button, AppIcon },
    setup() {
      const mode = ref<'spots' | 'tours'>('spots');
      const lastClicked = ref<string>('Keiner');
      const ACTION_ICONS_ADD = ACTION_ICONS.add;

      const handleClick = () => {
        if (mode.value === 'tours') {
          lastClicked.value = 'Neue Tour anlegen';
        } else {
          lastClicked.value = 'Neuer Spot anlegen';
        }
      };

      const toggleMode = () => {
        mode.value = mode.value === 'spots' ? 'tours' : 'spots';
      };

      return { mode, lastClicked, handleClick, toggleMode, ACTION_ICONS_ADD };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start; padding: 16px;">
        <Button size="sm" variant="secondary" @click="toggleMode">
          Drawer-State wechseln (Aktuell: {{ mode }})
        </Button>

        <Button
          :aria-label="mode === 'tours' ? 'Neue Tour' : 'Neuer Spot'"
          @click="handleClick"
        >
          <AppIcon :icon="ACTION_ICONS_ADD" :size="14" group="actions" />
          <span>
            <AnimatedText
              :text="mode === 'tours' ? 'Neue Tour' : 'Neuer Spot'"
              :options="['Neuer Spot', 'Neue Tour']"
              :direction="mode === 'tours' ? 'up' : 'down'"
            />
          </span>
        </Button>

        <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">
          Aktion ausgeführt: {{ lastClicked }}
        </p>
      </div>
    `,
  }),
};
