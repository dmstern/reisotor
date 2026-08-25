import { setup, type Preview } from '@storybook/vue3';
import { createPinia } from 'pinia';
import '../src/style.css';

const pinia = createPinia();

setup((app) => {
  app.use(pinia);
});

const preview: Preview = {
  decorators: [
    (story, context) => {
      const bg = context.globals.backgrounds?.value;
      const isDark = bg === '#121619' || bg === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      return {
        template: '<div style="color: var(--color-text); background-color: var(--color-bg); font-family: var(--font-sans); padding: 16px; border-radius: 8px; transition: background-color 0.2s ease, color 0.2s ease;"><story /></div>',
      };
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#121619' },
      ],
    },
  },
};

export default preview;
