import { setup, type Preview } from '@storybook/vue3';
import { createPinia } from 'pinia';
import '../src/style.css';

const pinia = createPinia();

setup((app) => {
  app.use(pinia);
});

// Grid-Overlay Fix: Sorgt dafür, dass das Storybook-Raster-Overlay sich per pseudo-element (z-index: 999999)
// über ALLE Komponenten (auch mit deckendem Karten-Hintergrund wie Card.vue, Button.vue) legt, statt darunter zu verschwinden.
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.id = 'storybook-grid-overlay-fix';
  styleTag.innerHTML = `
    body::after,
    #storybook-root::after {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 999999;
      background-image: inherit;
      background-size: inherit;
      background-position: inherit;
      background-repeat: inherit;
      mix-blend-mode: multiply;
      opacity: 0.85;
    }
    :root[data-theme='dark'] body::after,
    :root[data-theme='dark'] #storybook-root::after {
      mix-blend-mode: screen;
      opacity: 0.65;
    }
  `;
  document.head.appendChild(styleTag);
}

const preview: Preview = {
  decorators: [
    (story, context) => {
      const bg = context.globals.backgrounds?.value;
      const isDark = bg === '#181d20' || bg === '#121619' || bg === 'dark';
      const theme = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      document.body.style.backgroundColor = isDark ? '#181d20' : '#f9f8f6';
      document.body.style.color = isDark ? '#f2efe9' : '#2b2a28';

      return {
        template: '<div style="font-family: var(--font-sans); padding: 16px; border-radius: 8px;"><story /></div>',
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
        { name: 'light', value: '#f9f8f6' },
        { name: 'dark', value: '#181d20' },
      ],
    },
  },
};

export default preview;
