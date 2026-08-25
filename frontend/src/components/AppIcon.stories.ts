import type { Meta, StoryObj } from '@storybook/vue3';
import AppIcon from './AppIcon.vue';
import WeatherIcon from './WeatherIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SPOT_CATEGORY_SUGGESTIONS, spotCategoryMeta } from '../utils/spotCategory';
import { weatherCodeMeta } from '../utils/weather';

const meta: Meta<typeof AppIcon> = {
  title: 'Components/AppIcon',
  component: AppIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Zentrale Render-Stelle für alle Konzept-Icons der App. Das Icon-System gliedert sich in 3 kanonische Gruppen:

1. **Navigation & Dashboard** (\`group="navigation"\`) – Hauptnavigation, Nav-Bar & Bereichs-Abschnitte
2. **Kategorien & Wetter** (\`group="categories"\` / \`group="weather"\`) – Kalender-Kategorien, Spot- / Reise-Kategorien, Kartenmarker & Wetter
3. **Aktionen, Formularfelder & Avatare** (\`group="actions"\` / \`group="formFields"\`) – Buttons, Interaktionen, Formularfelder & Profil-Avatare

💡 **Tipp:** Verwende das **Controls Panel** unten (\`forceStyle\`, \`forceVariant\`, \`size\`, \`color\`), um alle Icons einer Galerie dynamisch umzuschalten.

🔗 **Tabler Icons Katalog:** [tabler.io/icons](https://tabler.io/icons) – Alle 5.000+ verfügbaren Tabler-Icons können als \`IconDef\` eingebunden werden.
`,
      },
    },
  },
  argTypes: {
    group: {
      control: 'select',
      options: ['navigation', 'categories', 'weather', 'formFields', 'actions'],
      description: 'Icon-Gruppe/Bereich',
    },
    forceStyle: {
      control: 'select',
      options: [undefined, 'emoji', 'icons'],
      description: 'Stil erzwingen (Emoji vs. Tabler Icons)',
    },
    forceVariant: {
      control: 'select',
      options: [undefined, 'outline', 'filled'],
      description: 'Variante erzwingen (Outline vs. Gefüllt)',
    },
    size: {
      control: 'number',
      description: 'Größe in Pixeln',
    },
    color: {
      control: 'color',
      description: 'Icon-Farbe (Standard: var(--color-text))',
    },
  },
  args: {
    icon: SECTION_ICON_DEFS.excursions,
    group: 'navigation',
    size: 24,
    color: 'var(--color-text)',
    forceStyle: undefined,
    forceVariant: undefined,
  },
};

export default meta;
type Story = StoryObj<typeof AppIcon>;

export const Default: Story = {
  render: (args) => ({
    components: { AppIcon },
    setup() {
      return { args };
    },
    template: '<AppIcon v-bind="args" />',
  }),
};

export const Group1_NavigationAndDashboard: Story = {
  name: 'Gruppe 1: Navigation & Dashboard',
  render: (args) => ({
    components: { AppIcon },
    setup() {
      return { args, SECTION_ICON_DEFS };
    },
    template: `
      <div>
        <h3>Gruppe 1: Navigation & Dashboard (sectionIcons.ts)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">
          Hauptnavigation, Nav-Bar und Bereichs-Abschnitte. Verwende <code>forceStyle</code> oder andere Controls im Panel unten, um den Stil aller Kästchen umzuschalten.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 12px;">
          <div v-for="(def, key) in SECTION_ICON_DEFS" :key="key" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.85rem;">
            <AppIcon :icon="def" group="navigation" :force-style="args.forceStyle" :force-variant="args.forceVariant" :size="args.size" :color="args.color" />
            <span style="font-weight: 600;">{{ key }}</span>
          </div>
        </div>
      </div>
    `,
  }),
};

export const Group2_CategoriesAndWeather: Story = {
  name: 'Gruppe 2: Kategorien & Wetter',
  render: (args) => ({
    components: { AppIcon, WeatherIcon },
    setup() {
      const spotCategories = SPOT_CATEGORY_SUGGESTIONS.map((cat) => ({
        name: cat,
        meta: spotCategoryMeta(cat),
      }));
      const weatherCodes = [0, 2, 61, 71, 95].map((code) => ({
        code,
        meta: weatherCodeMeta(code),
      }));
      return { args, SCHEDULE_CATEGORY_META, spotCategories, weatherCodes };
    },
    template: `
      <div>
        <h3>Gruppe 2: Kategorien & Wetter</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">
          Kalender-Einträge, Spot- / Reise-Kategorien, Kartenmarker & Wetter-Status. Reagiert dynamisch auf Storybook Controls (z. B. <code>forceStyle</code>).
        </p>

        <h4 style="margin: 16px 0 8px;">Kalender-Kategorien (scheduleCategory.ts)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
          <div v-for="(meta, key) in SCHEDULE_CATEGORY_META" :key="key" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.85rem;">
            <AppIcon :icon="meta.tabler" group="categories" :force-style="args.forceStyle" :force-variant="args.forceVariant" :size="args.size" :color="args.color !== 'var(--color-text)' ? args.color : meta.color" />
            <span style="font-weight: 600;">{{ meta.label }}</span>
          </div>
        </div>

        <h4 style="margin: 20px 0 8px;">Spot- & Orte-Kategorien (spotCategory.ts)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
          <div v-for="cat in spotCategories" :key="cat.name" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.85rem;">
            <AppIcon :icon="cat.meta.tabler" group="categories" :force-style="args.forceStyle" :force-variant="args.forceVariant" :size="args.size" :color="args.color !== 'var(--color-text)' ? args.color : cat.meta.color" />
            <span style="font-weight: 600;">{{ cat.name }}</span>
          </div>
        </div>

        <h4 style="margin: 20px 0 8px;">Wetter-Status Icons (WeatherIcon.vue)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
          <div v-for="w in weatherCodes" :key="w.code" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.85rem;">
            <span v-if="args.forceStyle === 'emoji'" style="font-size: 1.2rem;">{{ w.meta.icon }}</span>
            <WeatherIcon v-else :code="w.code" :size="args.size || 22" />
            <span style="font-weight: 600;">{{ w.meta.label }}</span>
          </div>
        </div>
      </div>
    `,
  }),
};

export const Group3_ActionsFormAndAvatars: Story = {
  name: 'Gruppe 3: Aktionen, Formulare & Avatare',
  render: (args) => ({
    components: { AppIcon },
    setup() {
      const avatarCategories = [
        {
          label: 'Menschen',
          emojis: [
            '🙂',
            '😎',
            '🥳',
            '😄',
            '🤓',
            '🥸',
            '🧑',
            '👩',
            '👨',
            '🧑‍🦱',
            '👩‍🦰',
            '🧑‍🦳',
            '🧔',
            '👵',
            '👴',
          ],
        },
        {
          label: 'Tiere',
          emojis: [
            '🐨',
            '🦊',
            '🐢',
            '🦁',
            '🐸',
            '🐧',
            '🐶',
            '🐱',
            '🐼',
            '🐰',
            '🦄',
            '🐙',
            '🦉',
            '🐝',
            '🦋',
            '🐬',
          ],
        },
        {
          label: 'Fabelwesen & Berufe',
          emojis: ['🧙‍♀️', '🧙‍♂️', '🧚', '🧝', '🧞', '🧜', '🦸', '🧑‍⚕️', '🧑‍🚒', '👮', '🧑‍💻', '🧑‍🎨', '🧑‍✈️'],
        },
      ];
      return { args, ACTION_ICONS, FORM_FIELD_ICONS, avatarCategories };
    },
    template: `
      <div>
        <h3>Gruppe 3: Aktionen, Formularfelder & Profil-Avatare</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">
          Buttons, Interaktionen, Formularfelder & wählbare Nutzer-Avatare. Reagiert dynamisch auf Storybook Controls (z. B. <code>forceStyle</code>).
        </p>

        <h4 style="margin: 16px 0 8px;">Aktions- & Status-Icons (actionIcons.ts)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">
          <div v-for="(def, key) in ACTION_ICONS" :key="key" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.85rem;">
            <AppIcon :icon="def" group="actions" :force-style="args.forceStyle" :force-variant="args.forceVariant" :size="args.size" :color="args.color" />
            <span>{{ key }}</span>
          </div>
        </div>

        <h4 style="margin: 20px 0 8px;">Formularfeld-Icons (formFieldIcons.ts)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">
          <div v-for="(def, key) in FORM_FIELD_ICONS" :key="key" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.85rem;">
            <AppIcon :icon="def" group="formFields" :force-style="args.forceStyle" :force-variant="args.forceVariant" :size="args.size" :color="args.color" />
            <span>{{ key }}</span>
          </div>
        </div>

        <h4 style="margin: 20px 0 8px;">Profil-Avatare (SettingsView.vue)</h4>
        <div v-for="cat in avatarCategories" :key="cat.label" style="margin-top: 10px;">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted);">{{ cat.label }}</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
            <span v-for="emoji in cat.emojis" :key="emoji" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 1.15rem;">
              {{ emoji }}
            </span>
          </div>
        </div>
      </div>
    `,
  }),
};
