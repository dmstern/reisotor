<script setup lang="ts">
import { ref } from 'vue';
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import Card from '../components/primitives/Card.vue';
import Input from '../components/primitives/Input.vue';
import ButtonGroup from '../components/primitives/ButtonGroup.vue';
import FormField from '../components/FormField.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import Combobox from '../components/Combobox.vue';
import TabBar from '../components/TabBar.vue';
import AppIcon from '../components/AppIcon.vue';
import CategoryChip from '../components/CategoryChip.vue';
import DraftBadge from '../components/DraftBadge.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import LoadingIndicator from '../components/LoadingIndicator.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import Modal from '../components/Modal.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SPOT_CATEGORY_SUGGESTIONS, spotCategoryMeta } from '../utils/spotCategory';
import { weatherCodeMeta } from '../utils/weather';
import { useIconStyleStore } from '../stores/iconStyle';
import { useThemeStore } from '../stores/theme';

// Stores & State
const themeStore = useThemeStore();
const iconStyleStore = useIconStyleStore();

function toggleTheme() {
  themeStore.mode = themeStore.mode === 'dark' ? 'light' : 'dark';
}

function toggleIconStyle() {
  const current = iconStyleStore.groups.navigation;
  iconStyleStore.setAllGroups(current === 'emoji' ? 'icons' : 'emoji');
}

function toggleCategoryColor() {
  iconStyleStore.colorizeCategories = !iconStyleStore.colorizeCategories;
}

function toggleWeatherColor() {
  iconStyleStore.colorizeWeather = !iconStyleStore.colorizeWeather;
}

// Toast Feedback for Token Copying
const copiedToken = ref<string | null>(null);
function copyToken(tokenStr: string) {
  navigator.clipboard.writeText(tokenStr);
  copiedToken.value = tokenStr;
  setTimeout(() => {
    if (copiedToken.value === tokenStr) copiedToken.value = null;
  }, 1800);
}

// Navigation Tabs in Showcase
const currentTab = ref('tokens');
const showcaseTabs = [
  { key: 'tokens', label: 'Tokens & Variablen', icon: ACTION_ICONS.filterSettings },
  { key: 'typography', label: 'Typografie & Text', icon: FORM_FIELD_ICONS.title },
  { key: 'primitives', label: 'Buttons & Cards', icon: ACTION_ICONS.edit },
  { key: 'forms', label: 'Formulare & Inputs', icon: SECTION_ICON_DEFS.notes },
  { key: 'navigation', label: 'Icons & Navigation', icon: SECTION_ICON_DEFS.calendar },
  { key: 'feedback', label: 'Badges & Feedback', icon: ACTION_ICONS.shared },
  { key: 'overlays', label: 'Dialoge & Overlays', icon: ACTION_ICONS.close },
];

// Token Data Definition
const colorTokens = [
  {
    category: 'Oberflächen & Ränder',
    items: [
      { var: '--color-bg', name: 'Hintergrund (App-BG)', light: '#faf8f5', dark: '#181715' },
      { var: '--color-surface', name: 'Karten & Panels (Surface)', light: '#ffffff', dark: '#232220' },
      { var: '--color-border', name: 'Standard Rahmen', light: '#e8e2d9', dark: '#38352f' },
      { var: '--color-border-strong', name: 'Eingabefeld/Button Rahmen', light: '#d5cabc', dark: '#4a453c' },
    ],
  },
  {
    category: 'Text & Neutral',
    items: [
      { var: '--color-text', name: 'Haupttext', light: '#2b2a28', dark: '#f2efe9' },
      { var: '--color-text-muted', name: 'Gedämpfter Text (Muted)', light: '#726e66', dark: '#a8a29a' },
      { var: '--color-hover', name: 'Hover & Muted Surface', light: '#f4f1ec', dark: '#2a2823' },
    ],
  },
  {
    category: 'Marke & Primär',
    items: [
      { var: '--color-primary', name: 'Primärfarbe (Brand Green)', light: '#2a7f74', dark: '#3da296' },
      { var: '--color-primary-dark', name: 'Primär Dunkel (Hover)', light: '#1f6059', dark: '#7dd0c1' },
      { var: '--color-primary-tint', name: 'Primär Tint (Leichtes Grün)', light: '#eaf3f1', dark: '#1c2e2a' },
    ],
  },
  {
    category: 'Akzente & Status',
    items: [
      { var: '--color-accent', name: 'Akzent (Sync/Echtzeit)', light: '#e08e45', dark: '#f0a05a' },
      { var: '--color-danger', name: 'Gefahr / Löschen', light: '#c1503f', dark: '#e0685a' },
      { var: '--color-success', name: 'Erfolg / Fertig', light: '#3f8f5c', dark: '#5cb37e' },
      { var: '--color-scheduled', name: 'Geplant (Kalender/Streifen)', light: '#1e96d1', dark: '#52b8ea' },
      { var: '--color-highlight', name: 'Highlight Hintergrund', light: '#fff4e8', dark: '#332a1c' },
      { var: '--color-accent-secondary', name: 'Sekundärer Akzent (Indigo)', light: '#5b6ee1', dark: '#8b98f0' },
    ],
  },
];

const spaceTokens = [
  { var: '--space-1', px: '4px', usage: 'Mikro-Abstände (Icon-Gaps, Badges, Chips)' },
  { var: '--space-2', px: '8px', usage: 'Dichte Flex-Zeilen (Formularfelder, Button-Gruppen)' },
  { var: '--space-3', px: '16px', usage: 'Standard Card-Padding (Mobil), Listen-Gaps, Fließtext-Margin' },
  { var: '--space-4', px: '24px', usage: 'Großzügiges Card-Padding (Desktop), Dialoge, Sektionen' },
  { var: '--space-5', px: '32px', usage: 'Große Trennabstände zwischen Haupt-Sektionen' },
  { var: '--space-6', px: '48px', usage: 'Maximale Außenabstände / Hero-Layouts' },
];

const fontSizeTokens = [
  { var: '--font-size-xs', val: '0.75rem (12px)', usage: 'Kicker, Badges, Formular-Meta' },
  { var: '--font-size-sm', val: '0.85rem (13.6px)', usage: 'Sekundärtexte, Card-Actions, Hinweise' },
  { var: '--font-size-md', val: '1rem (16px)', usage: 'Standard Fließtext, Inputs, Haupt-Buttons' },
  { var: '--font-size-lg', val: '1.15rem (18.4px)', usage: 'H3 Überschriften, Subheadings, Dialog-Titel' },
  { var: '--font-size-xl', val: '1.3rem (20.8px)', usage: 'H2 Sektions-Überschriften, Kachel-Titel' },
  { var: '--font-size-2xl', val: '1.6rem (25.6px)', usage: 'H1 Haupt-Seitentitel (Apples SF-Pro Stil)' },
];

const radiusTokens = [
  { var: '--radius-sm', px: '10px', usage: 'Kleine Chips, Badges, innere Anordnung' },
  { var: '--radius-md', px: '16px', usage: 'Standard-Radius (Circle-Fallbacks)' },
  { var: '--radius-lg', px: '26px', usage: 'Große Modals & Schubladen' },
  { var: '--radius-xl', px: '32px', usage: 'Maximale Rundung / Bottom-Sheets' },
  { var: '--radius-sm-squircle', px: '17.5px (Squircle)', usage: 'Card-Action Buttons & kleine Tags' },
  { var: '--radius-md-squircle', px: '28px (Squircle)', usage: 'Standard Cards, Buttons, Inputs & Modals' },
];

const shadowTokens = [
  { var: '--shadow-sm', spec: '0 2px 6px rgba(...)', usage: 'Standard Cards, Buttons, Dropdowns' },
  { var: '--shadow-md', spec: '0 8px 24px rgba(...)', usage: 'Erhöhte Overlays, Modals, Popovers' },
  { var: '--shadow-inset', spec: 'inset 0 1px 2px rgba(...)', usage: 'Track-Rinne für taktile SegmentedToggles' },
  { var: '--shadow-pill-raised', spec: '0 1px 2px..., 0 2px 6px...', usage: 'Schwebender Thumb auf SegmentedToggle' },
];

// Interactive Controls for Playground
const btnVariant = ref<'primary' | 'secondary' | 'danger' | 'card-action' | 'ghost'>('primary');
const btnSize = ref<'sm' | 'md' | 'lg'>('md');
const btnDisabled = ref(false);
const btnText = ref('Aktionsbutton');

const inputSize = ref<'sm' | 'md' | 'lg'>('md');
const inputDisabled = ref(false);
const inputInvalid = ref(false);
const inputValue = ref('Beispiel Text');

const toggleValue = ref('spots');
const comboboxValue = ref('');
const comboboxOptions = ['Essen & Trinken', 'Sehenswürdigkeiten', 'Natur & Wandern', 'Unterkunft', 'Transport'];

const activeTabBarKey = ref('packing');
const tabBarItems = [
  { key: 'packing', label: 'Packliste', icon: SECTION_ICON_DEFS.excursions },
  { key: 'shopping', label: 'Einkauf', icon: SECTION_ICON_DEFS.notes },
  { key: 'todo', label: 'ToDo', icon: SECTION_ICON_DEFS.calendar, unseen: true },
];

const modalOpen = ref(false);

const spotCategories = SPOT_CATEGORY_SUGGESTIONS.map((cat) => ({
  name: cat,
  meta: spotCategoryMeta(cat),
}));

const weatherCodes = [0, 2, 61, 71, 95].map((code) => ({
  code,
  meta: weatherCodeMeta(code),
}));

const avatarCategories = [
  {
    label: 'Menschen',
    emojis: ['🙂', '😎', '🥳', '😄', '🤓', '🥸', '🧑', '👩', '👨', '🧑‍🦱', '👩‍🦰', '🧑‍🦳', '🧔', '👵', '👴'],
  },
  {
    label: 'Tiere',
    emojis: ['🐨', '🦊', '🐢', '🦁', '🐸', '🐧', '🐶', '🐱', '🐼', '🐰', '🦄', '🐙', '🦉', '🐝', '🦋', '🐬'],
  },
  {
    label: 'Fabelwesen & Berufe',
    emojis: ['🧙‍♀️', '🧙‍♂️', '🧚', '🧝', '🧞', '🧜', '🦸', '🧑‍⚕️', '🧑‍🚒', '👮', '🧑‍💻', '🧑‍🎨', '🧑‍✈️'],
  },
];
</script>

<template>
  <div class="design-system-view">
    <!-- Toast Feedback -->
    <div v-if="copiedToken" class="toast-feedback">
      📋 <code>{{ copiedToken }}</code> in Zwischenablage kopiert!
    </div>

    <!-- Header & Meta Toolbar -->
    <header class="ds-header">
      <div class="ds-header-title">
        <span class="kicker">Design System</span>
        <h1>Reisotor Design System</h1>
        <p class="hint">Vollständiges Abbild aller Design-Tokens, Typografie, Primitives & Komponenten</p>
      </div>

      <div class="ds-header-tools">
        <Button variant="secondary" size="sm" @click="toggleTheme">
          {{ themeStore.mode === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode' }}
        </Button>
        <Button variant="secondary" size="sm" @click="toggleIconStyle">
          {{ iconStyleStore.groups.navigation === 'emoji' ? '🎨 Tabler Icons' : '😀 Emoji Icons' }}
        </Button>
        <Button variant="secondary" size="sm" @click="toggleCategoryColor">
          {{ iconStyleStore.colorizeCategories ? '🎨 Kat-Farben: An' : '⚪ Kat-Farben: Aus' }}
        </Button>
        <Button variant="secondary" size="sm" @click="toggleWeatherColor">
          {{ iconStyleStore.colorizeWeather ? '🌦️ Wetter-Farben: An' : '⚪ Wetter-Farben: Aus' }}
        </Button>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="ds-nav">
      <TabBar :tabs="showcaseTabs" :active-key="currentTab" @select="currentTab = $event" />
    </nav>

    <!-- Content Sections -->
    <main class="ds-main">
      <!-- 1. TOKENS & VARIABLEN SECTION -->
      <section v-if="currentTab === 'tokens'" class="ds-section">
        <h2>1. Design-Tokens & CSS-Variablen</h2>
        <p class="hint">Klicke auf einen Token, um seine CSS-Variable (<code>var(--...)</code>) in die Zwischenablage zu kopieren.</p>

        <!-- Farbpalette -->
        <h3>Farbpalette (Theme & Akzente)</h3>
        <div v-for="cat in colorTokens" :key="cat.category" class="token-group">
          <span class="token-group-title">{{ cat.category }}</span>
          <div class="swatch-grid">
            <div
              v-for="item in cat.items"
              :key="item.var"
              class="swatch-card"
              @click="copyToken(`var(${item.var})`)"
              title="Klicken zum Kopieren"
            >
              <div class="swatch-preview" :style="{ background: `var(${item.var})` }"></div>
              <div class="swatch-info">
                <strong>{{ item.name }}</strong>
                <code>{{ item.var }}</code>
                <span class="swatch-hex">Light: {{ item.light }} | Dark: {{ item.dark }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Abstände & Gaps -->
        <h3 style="margin-top: 32px;">Abstände & Gaps (--space-1 bis --space-6)</h3>
        <Card class="ds-card">
          <div class="space-list">
            <div v-for="space in spaceTokens" :key="space.var" class="space-item" @click="copyToken(`var(${space.var})`)">
              <div class="space-label">
                <code>{{ space.var }}</code>
                <span>({{ space.px }})</span>
              </div>
              <div class="space-bar-container">
                <div class="space-bar" :style="{ width: space.px }"></div>
              </div>
              <span class="space-usage">{{ space.usage }}</span>
            </div>
          </div>
        </Card>

        <!-- Schriftgrößen-Skala -->
        <h3 style="margin-top: 32px;">Schriftgrößen-Skala (--font-size-*)</h3>
        <Card class="ds-card">
          <div class="font-size-list">
            <div v-for="fs in fontSizeTokens" :key="fs.var" class="font-size-item" @click="copyToken(`var(${fs.var})`)">
              <div class="font-size-meta">
                <code>{{ fs.var }}</code>
                <span>{{ fs.val }}</span>
              </div>
              <div class="font-size-sample" :style="{ fontSize: `var(${fs.var})` }">
                Reisotor Reisepartner
              </div>
              <span class="font-size-usage">{{ fs.usage }}</span>
            </div>
          </div>
        </Card>

        <!-- Eckenrundung: Squircle-Prinzip -->
        <h3 style="margin-top: 32px;">Eckenrundung & Squircle-Prinzip</h3>
        <Card class="ds-card">
          <p>Nirgends ganz eckige 90°-Ecken. Buttons, Cards, Inputs & Modals binden <code>corner-shape: squircle</code> mit den `-squircle`-Kompensationsvariablen.</p>
          <div class="radius-grid">
            <div v-for="r in radiusTokens" :key="r.var" class="radius-card" @click="copyToken(`var(${r.var})`)">
              <div
                class="radius-box"
                :style="`border-radius: var(${r.var}); ${r.var.includes('squircle') ? 'corner-shape: squircle;' : ''}`"
              ></div>
              <code>{{ r.var }}</code>
              <span class="radius-px">{{ r.px }}</span>
              <span class="radius-usage">{{ r.usage }}</span>
            </div>
          </div>
        </Card>

        <!-- Schatten & Material -->
        <h3 style="margin-top: 32px;">Schatten & Weiches Material</h3>
        <Card class="ds-card">
          <div class="shadow-grid">
            <div v-for="s in shadowTokens" :key="s.var" class="shadow-card" @click="copyToken(`var(${s.var})`)">
              <div class="shadow-box" :style="{ boxShadow: `var(${s.var})` }"></div>
              <code>{{ s.var }}</code>
              <span class="shadow-usage">{{ s.usage }}</span>
            </div>
          </div>
        </Card>

        <!-- Grid & Masonry Layouts -->
        <h3 style="margin-top: 32px;">Grid, Page-Container & Layout-Spalten</h3>
        <Card class="ds-card">
          <p>Reisotor definiert klare Standards für Gesamt-Page Containerbreiten (<code>max-width</code>), Layout-Spalten und Responsivität:</p>

          <h4 style="margin-top: 16px; margin-bottom: 12px;">Container-Breiten (max-width)</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 24px;">
            <div style="padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-hover);">
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark);">.page (960px)</code>
              <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--color-text-muted);">Standard für einspaltige Lesbarkeit (Tagebuch, Notizen, Einstellungen, Dashboard).</p>
            </div>
            <div style="padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-hover);">
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark);">Wide Page (1400px)</code>
              <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--color-text-muted);">Für breite Tabellen & mehrspaltige Übersichten (BudgetView, ListenView).</p>
            </div>
            <div style="padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-hover);">
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark);">Full-Split (1600px)</code>
              <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--color-text-muted);">Maximale Breite für Karte & Spot-Listen Split-Screen (ExcursionsView).</p>
            </div>
            <div style="padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-hover);">
              <code style="font-size: 0.85rem; font-weight: bold; color: var(--color-primary-dark);">Modals (480px / 900px)</code>
              <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--color-text-muted);">Standard-Modals (480px) & breite Formular-Modals (900px).</p>
            </div>
          </div>

          <h4 style="margin-bottom: 12px;">Raster-Systeme (.grid & .masonry)</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-hover);">
              <h4 style="margin: 0 0 6px;">1. Responsive Auto-Fit Grid (<code>.grid</code>)</h4>
              <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">
                Nutzt <code>display: grid; gap: var(--space-3)</code> mit <code>repeat(auto-fit, minmax(280px, 1fr))</code> für gleichmäßige Kachel-Raste (Dashboard, Budget, Touren).
              </p>
            </div>
            <div style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-hover);">
              <h4 style="margin: 0 0 6px;">2. Masonry Multi-Column (<code>.masonry</code>)</h4>
              <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">
                Nutzt CSS Multi-Column (<code>column-width: 280px; column-gap: var(--space-3)</code>) für Notizen & Karten variabler Höhe. Verhindert unschöne vertikale Zeilen-Lücken.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <!-- 2. TYPOGRAFIE & SEMANTISCHE TEXTBAUSTEINE SECTION -->
      <section v-if="currentTab === 'typography'" class="ds-section">
        <h2>2. Typografie & Semantische Textbausteine</h2>
        <p class="hint">Fira Sans Schriftfamilie (selbstgehostet) in allen Gewichten (400, 500, 600, 700) und Kursiv-Schnitten.</p>

        <Card class="ds-card">
          <span class="kicker">Kicker / Pre-Heading Label</span>
          <h1>H1 Seitentitel (700 Bold, -0.01em Tracking)</h1>
          <h2>H2 Sektions-Überschrift (600 Semi-Bold)</h2>
          <h3>H3 Kompakter Gruppen-Titel (600 Semi-Bold)</h3>
          <h4>H4 Subheading / Unterüberschrift (600 Semi-Bold)</h4>

          <p style="margin-top: 16px;">
            Standard-Fließtext (<code>p</code>) in gedämpfter Schriftfarbe (<code>var(--color-text-muted)</code>). Text kann <strong>fett hervorgehoben (700)</strong>, <em>kursiv betont (400 Italic)</em> oder <strong><em>fett-kursiv kombiniert (700 Italic)</em></strong> dargestellt werden.
          </p>

          <p class="hint">
            <strong>Hinweistext (.hint / .muted):</strong> Dezenter Erklärtext für Formulare oder Seiten-Einleitungen mit sichtbarem Freiraum nach unten.
          </p>

          <div style="margin-top: 20px;">
            <span class="kicker">Monospace & Code-Bausteine</span>
            <p>Code-Bausteine werden in dezentem <code>code</code>-Span mit hellbepolstertem Hintergrund hervorgehoben.</p>
          </div>

          <div style="margin-top: 20px;" class="flex-row">
            <div>
              <span class="kicker">Button-Label Typografie</span>
              <Button variant="primary" size="md">Haupt-Button Text (600)</Button>
            </div>
            <div>
              <span class="kicker">Badge-Label Typografie</span>
              <span class="badge badge--primary">Primary Badge Text (600)</span>
            </div>
          </div>
        </Card>

        <h3 style="margin-top: 24px;">Fira Sans Schriftgewichte & Schnitte</h3>
        <Card class="ds-card">
          <div class="font-weight-list">
            <div class="fw-item" style="font-weight: 400;">Fira Sans 400 Regular – Normaler Fließtext & Absätze</div>
            <div class="fw-item" style="font-weight: 400; font-style: italic;">Fira Sans 400 Italic – Kursiver Text & Zitate</div>
            <div class="fw-item" style="font-weight: 500;">Fira Sans 500 Medium – Dezent betonte Formularfeld-Labels</div>
            <div class="fw-item" style="font-weight: 600;">Fira Sans 600 Semi-Bold – Buttons, Badges, H2/H3 Überschriften</div>
            <div class="fw-item" style="font-weight: 700;">Fira Sans 700 Bold – H1 Seitentitel & prägnante Kacheln</div>
          </div>
        </Card>
      </section>

      <!-- 3. BUTTONS & CARDS PRIMITIVES SECTION -->
      <section v-if="currentTab === 'primitives'" class="ds-section">
        <h2>3. Buttons & Cards Primitives</h2>

        <!-- Interactive Playground -->
        <Card class="ds-card">
          <h3>Interactive Button Playground</h3>
          <div class="playground-controls">
            <label>
              <span>Variant:</span>
              <select v-model="btnVariant" class="ds-select">
                <option value="primary">primary</option>
                <option value="secondary">secondary</option>
                <option value="danger">danger</option>
                <option value="card-action">card-action</option>
                <option value="ghost">ghost</option>
              </select>
            </label>

            <label>
              <span>Size:</span>
              <select v-model="btnSize" class="ds-select">
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
              </select>
            </label>

            <label class="checkbox-label">
              <input type="checkbox" v-model="btnDisabled" />
              <span>Disabled State</span>
            </label>
          </div>

          <div class="playground-preview">
            <Button :variant="btnVariant" :size="btnSize" :disabled="btnDisabled">
              {{ btnText }}
            </Button>
          </div>
        </Card>

        <!-- Alle Button-Varianten inkl. Disabled -->
        <h3>Alle Button-Varianten (Aktiv & Disabled)</h3>
        <Card class="ds-card">
          <div class="grid-table">
            <div class="grid-header">Variante</div>
            <div class="grid-header">sm (Kompakt)</div>
            <div class="grid-header">md (Standard)</div>
            <div class="grid-header">Disabled State</div>

            <div><strong>Primary</strong></div>
            <div><Button variant="primary" size="sm">Aktion</Button></div>
            <div><Button variant="primary" size="md">Haupt-Aktion</Button></div>
            <div><Button variant="primary" size="md" :disabled="true">Deaktiviert</Button></div>

            <div><strong>Secondary</strong></div>
            <div><Button variant="secondary" size="sm">Aktion</Button></div>
            <div><Button variant="secondary" size="md">Sekundär</Button></div>
            <div><Button variant="secondary" size="md" :disabled="true">Deaktiviert</Button></div>

            <div><strong>Danger</strong></div>
            <div><Button variant="danger" size="sm">Löschen</Button></div>
            <div><Button variant="danger" size="md">Gefahr / Löschen</Button></div>
            <div><Button variant="danger" size="md" :disabled="true">Deaktiviert</Button></div>

            <div><strong>Card Action</strong></div>
            <div><Button variant="card-action" size="sm">📌 Tag</Button></div>
            <div><Button variant="card-action" size="md">📌 Karte-Aktion</Button></div>
            <div><Button variant="card-action" size="md" :disabled="true">📌 Deaktiviert</Button></div>

            <div><strong>Ghost</strong></div>
            <div><Button variant="ghost" size="sm">Option</Button></div>
            <div><Button variant="ghost" size="md">Dezent / Ghost</Button></div>
            <div><Button variant="ghost" size="md" :disabled="true">Deaktiviert</Button></div>
          </div>
        </Card>

        <!-- Icon Buttons & Button Groups -->
        <h3 style="margin-top: 32px;">IconButtons & ButtonGroups</h3>
        <Card class="ds-card">
          <div class="flex-row">
            <div class="demo-box">
              <span class="demo-title">IconButton Ghost</span>
              <div class="demo-inline">
                <IconButton :icon="ACTION_ICONS.filterSettings" size="sm" />
                <IconButton :icon="ACTION_ICONS.filterSettings" size="md" />
                <IconButton :icon="ACTION_ICONS.filterSettings" size="lg" />
              </div>
            </div>

            <div class="demo-box">
              <span class="demo-title">IconButton Secondary</span>
              <div class="demo-inline">
                <IconButton :icon="ACTION_ICONS.edit" variant="secondary" size="sm" />
                <IconButton :icon="ACTION_ICONS.edit" variant="secondary" size="md" />
                <IconButton :icon="ACTION_ICONS.edit" variant="secondary" size="lg" />
              </div>
            </div>

            <div class="demo-box">
              <span class="demo-title">IconButton Danger</span>
              <div class="demo-inline">
                <IconButton :icon="ACTION_ICONS.delete" variant="danger" size="sm" />
                <IconButton :icon="ACTION_ICONS.delete" variant="danger" size="md" />
                <IconButton :icon="ACTION_ICONS.delete" variant="danger" size="lg" />
              </div>
            </div>
          </div>

          <h4 style="margin-top: 20px;">ButtonGroup (Ausrichtung & Abstände)</h4>
          <ButtonGroup align="start">
            <Button variant="secondary">Abbrechen</Button>
            <Button variant="primary">Speichern</Button>
          </ButtonGroup>
        </Card>

        <!-- Cards Showcase -->
        <h3 style="margin-top: 32px;">Card Varianten & Zustände (Card.vue)</h3>
        <div class="card-showcase-grid">
          <!-- Standard Card -->
          <Card variant="default">
            <h3>Standard Karte (Default)</h3>
            <p>Weißer Hintergrund mit weichem Schatten (<code>--shadow-sm</code>) und Squircle-Ecken.</p>
            <template #footer>
              <Button variant="card-action" size="sm">Details ↗</Button>
            </template>
          </Card>

          <!-- Interaktive Aufklapp-Karte (SpotCard / ExcursionCard Muster) -->
          <Card
            :expandable="true"
            banner-url="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop"
            banner-alt="Strand"
          >
            <h3 style="margin: 0 0 4px;">Interaktive Karte (Aufklappbar)</h3>
            <p style="font-size: 0.85rem; margin: 0;">Wechselt per Klick zwischen komprimiertem (Condensed) und aufgeklapptem Zustand.</p>
            <template #condensed>
              <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 600;">👆 Klicke zum Aufklappen</span>
            </template>
            <template #expanded>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border); font-size: 0.85rem;">
                <p style="margin: 0;"><strong>Details & Notizen:</strong> Hier erscheinen zusätzliche Infos, Kommentare und Aktionen beim Aufklappen.</p>
              </div>
            </template>
          </Card>

          <!-- Muted Card -->
          <Card variant="muted">
            <h3>Hinterlegte Karte (Muted)</h3>
            <p>Hinterlegter Hintergrund (<code>--color-hover</code>) für Sekundär-Sektionen oder Inaktives.</p>
          </Card>

          <!-- Flat Card -->
          <Card variant="flat">
            <h3>Flache Karte (Flat)</h3>
            <p>Kein Schatten, nur mit dezentem Rand. Ideal für verschachtelte Container.</p>
          </Card>

          <!-- Elevated Card -->
          <Card variant="elevated">
            <h3>Erhöhte Karte (Elevated)</h3>
            <p>Prägnanterer Schatten (<code>--shadow-md</code>) für schwebende Panels.</p>
          </Card>

          <!-- Dashboard Tile Card -->
          <Card variant="tile" tile-color="#2a7f74" :tile-icon="SECTION_ICON_DEFS.calendar">
            <h3 style="margin: 12px 0 6px; text-align: center;">Dashboard Kachel</h3>
            <p style="margin: 0; font-size: 0.85rem; text-align: center;">Transparenter Tönungs-Hintergrund, buntes Schwebelogo am oberen Rand & Hover-Lift.</p>
          </Card>

          <!-- Card mit Live-Sync Highlight -->
          <Card :highlight="true">
            <h3>Karte mit Highlight-Rand</h3>
            <p>Echtzeit-Akzentrand (<code>.new-highlight</code>) signalisiert frisch aktualisierte Inhalte.</p>
          </Card>

          <!-- Card mit Banner-Bild oben -->
          <Card banner-url="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop" banner-alt="Strand" banner-position="top">
            <h3>Karte mit Banner oben</h3>
            <p>Nahtlos integriertes Vorschaubild am oberen Rand der Karte.</p>
          </Card>

          <!-- Card mit Miniatur-Banner links (Horizontal Layout) -->
          <Card banner-url="https://images.unsplash.com/photo-1476514525535-ce74f45814ce?w=600&auto=format&fit=crop" banner-alt="See" banner-position="left" :condensed="true">
            <h3>Mini-Karte (Banner links)</h3>
            <p style="font-size: 0.85rem; margin: 0;">Kompakter Zustand für Listenansichten mit schmaler Bildminiatur links.</p>
          </Card>
        </div>
      </section>

      <!-- 4. FORMULARE & INPUTS SECTION -->
      <section v-if="currentTab === 'forms'" class="ds-section">
        <h2>4. Formulare, Inputs & Controls</h2>

        <!-- FormField & Input -->
        <Card class="ds-card">
          <h3>FormField Wrapper (Label + Icon + Input)</h3>
          <div class="form-demo-grid">
            <FormField label="Reisezieltitel" icon="title">
              <Input v-model="inputValue" placeholder="Titel eingeben..." :size="inputSize" :disabled="inputDisabled" :invalid="inputInvalid" />
            </FormField>

            <FormField label="Anreisedatum" icon="date">
              <Input type="date" value="2026-08-25" :size="inputSize" :disabled="inputDisabled" />
            </FormField>

            <FormField label="Kategorie" icon="category">
              <Combobox v-model="comboboxValue" :options="comboboxOptions" placeholder="Kategorie wählen..." />
            </FormField>
          </div>
        </Card>

        <!-- SegmentedToggle & Controls -->
        <h3 style="margin-top: 32px;">SegmentedToggle (Taktile Umschalt-Pille)</h3>
        <Card class="ds-card">
          <p>Weiches Material (<code>--shadow-inset</code> / <code>--shadow-pill-raised</code>) mit gleitender Daumen-Animation.</p>
          <div class="flex-row" style="margin-top: 16px;">
            <SegmentedToggle
              v-model="toggleValue"
              :options="[
                { value: 'spots', label: 'Spots' },
                { value: 'tours', label: 'Touren' },
              ]"
            />

            <SegmentedToggle
              v-model="toggleValue"
              :options="[
                { value: 'spots', label: 'Alle' },
                { value: 'active', label: 'Aktiv' },
                { value: 'done', label: 'Erledigt' },
              ]"
            />
          </div>
        </Card>
      </section>

      <!-- 5. ICONS & NAVIGATION SECTION -->
      <section v-if="currentTab === 'navigation'" class="ds-section">
        <h2>5. Icon-System (3 Kanonische Gruppen)</h2>
        <p class="hint">Reisotor Icon-System gliedert sich in 3 fest definierte Hauptgruppen. Tabler.io bietet über 5.000 verknüpfbare Symbol-Icons.</p>

        <!-- Gruppe 1 -->
        <Card class="ds-card">
          <h3>Gruppe 1: Navigation & Dashboard (sectionIcons.ts)</h3>
          <div class="icon-gallery-grid">
            <div v-for="(def, key) in SECTION_ICON_DEFS" :key="key" class="icon-card-box">
              <AppIcon :icon="def" group="navigation" :size="24" />
              <span class="icon-box-label">{{ key }}</span>
            </div>
          </div>
        </Card>

        <!-- Gruppe 2 -->
        <Card class="ds-card" style="margin-top: 24px;">
          <h3>Gruppe 2: Kategorien & Wetter</h3>
          <p class="hint">Kalender, Spot- & Wetter-Kategorien in 3 Spalten (Emoji, Tabler Monochrom, Tabler Gefärbt).</p>

          <h4 class="subgroup-title">Kalender-Kategorien (scheduleCategory.ts)</h4>
          <div class="icon-triple-grid">
            <div v-for="(meta, key) in SCHEDULE_CATEGORY_META" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="meta.tabler" group="categories" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="meta.tabler" group="categories" force-style="icons" color="var(--color-text)" /></span>
              <span class="col-colored"><AppIcon :icon="meta.tabler" group="categories" force-style="icons" :color="meta.color" /></span>
              <span class="icon-label">{{ meta.label }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Spot- & Orte-Kategorien (spotCategory.ts)</h4>
          <div class="icon-triple-grid">
            <div v-for="cat in spotCategories" :key="cat.name" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="cat.meta.tabler" group="categories" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="cat.meta.tabler" group="categories" force-style="icons" color="var(--color-text)" /></span>
              <span class="col-colored"><AppIcon :icon="cat.meta.tabler" group="categories" force-style="icons" :color="cat.meta.color" /></span>
              <span class="icon-label">{{ cat.name }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Wetter-Status Icons (WeatherIcon.vue)</h4>
          <div class="icon-triple-grid">
            <div v-for="w in weatherCodes" :key="w.code" class="icon-triple-item">
              <span class="col-emoji" style="font-size: 1.2rem;">{{ w.meta.icon }}</span>
              <span class="col-tabler"><WeatherIcon :code="w.code" :size="22" /></span>
              <span class="col-colored"><WeatherIcon :code="w.code" :size="22" /></span>
              <span class="icon-label">{{ w.meta.label }}</span>
            </div>
          </div>
        </Card>

        <!-- Gruppe 3 -->
        <Card class="ds-card" style="margin-top: 24px;">
          <h3>Gruppe 3: Aktionen, Formularfelder & Profil-Avatare</h3>

          <h4 class="subgroup-title">Aktions- & Status-Icons (actionIcons.ts)</h4>
          <div class="icon-triple-grid">
            <div v-for="(def, key) in ACTION_ICONS" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="def" group="actions" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="def" group="actions" force-style="icons" color="var(--color-text)" /></span>
              <span class="icon-label">{{ key }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Formularfeld-Icons (formFieldIcons.ts)</h4>
          <div class="icon-triple-grid">
            <div v-for="(def, key) in FORM_FIELD_ICONS" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="def" group="formFields" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="def" group="formFields" force-style="icons" color="var(--color-text)" /></span>
              <span class="icon-label">{{ key }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Profil-Avatare (Emoji-Katalog)</h4>
          <div v-for="cat in avatarCategories" :key="cat.label" style="margin-top: 10px;">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted);">{{ cat.label }}</span>
            <div class="avatar-emoji-row">
              <span v-for="emoji in cat.emojis" :key="emoji" class="avatar-emoji-chip">{{ emoji }}</span>
            </div>
          </div>
        </Card>
      </section>

      <!-- 6. BADGES & FEEDBACK SECTION -->
      <section v-if="currentTab === 'feedback'" class="ds-section">
        <h2>6. Badges, Indikatoren & Feedback</h2>
        <Card class="ds-card">
          <h3>Status Badges & Chips</h3>
          <div class="flex-row" style="margin-top: 12px;">
            <span class="badge">Standard Badge</span>
            <span class="badge badge--primary">Primary Badge</span>
            <span class="badge badge--success">Erfolg / Fertig</span>
            <span class="badge badge--danger">Gefahr / Offen</span>
            <span class="badge badge--accent">Akzent / Neu</span>
          </div>

          <h3 style="margin-top: 24px;">Sichtbarkeits-Indikatoren</h3>
          <div class="flex-row">
            <span class="badge">🔒 Privat (Nur Ich)</span>
            <span class="badge badge--primary">🤝 Geteilt (Mitreisende)</span>
          </div>

          <h3 style="margin-top: 24px;">Spezifische App Badges</h3>
          <div class="flex-row">
            <CategoryChip category="Essen & Trinken" />
            <CategoryChip category="Sehenswürdigkeit" />
            <DraftBadge />
            <PendingSyncBadge />
          </div>

          <h3 style="margin-top: 24px;">Ladezustände (LoadingIndicator.vue)</h3>
          <div class="flex-row">
            <LoadingIndicator size="sm" />
            <LoadingIndicator size="md" />
            <LoadingIndicator size="lg" />
          </div>
        </Card>
      </section>

      <!-- 7. DIALOGE & OVERLAYS SECTION -->
      <section v-if="currentTab === 'overlays'" class="ds-section">
        <h2>7. Dialoge & Overlays (Modal.vue)</h2>
        <Card class="ds-card">
          <p>Klicke den Button unten, um einen Beispiel-Modal-Dialog mit Backdrop und Squircle-Radius zu testen.</p>
          <Button variant="primary" @click="modalOpen = true">Modal Öffnen</Button>
        </Card>

        <Modal v-model="modalOpen" title="Beispiel Modal">
          <p>Dies ist ein voll funktionsfähiger Modal-Dialog mit smooth Fade-In Animation, Escape-Taste Support und Backdrop-Blur.</p>
          <template #footer>
            <ButtonGroup align="end">
              <Button variant="secondary" @click="modalOpen = false">Schließen</Button>
              <Button variant="primary" @click="modalOpen = false">Bestätigen</Button>
            </ButtonGroup>
          </template>
        </Modal>
      </section>
    </main>
  </div>
</template>

<style scoped>
.design-system-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-4);
  padding-bottom: calc(var(--navbar-bottom-offset, 88px) + var(--space-5));
}

.toast-feedback {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: 10px 16px;
  box-shadow: var(--shadow-md);
  font-size: 0.9rem;
  font-weight: 600;
}

.ds-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.ds-header-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ds-nav {
  margin-bottom: var(--space-4);
}

.ds-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ds-card {
  margin-bottom: var(--space-3);
}

/* Tokens Grid & Swatches */
.token-group {
  margin-top: 16px;
}

.token-group-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  display: block;
  margin-bottom: 8px;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.swatch-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.swatch-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.swatch-preview {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--color-border-strong);
  flex-shrink: 0;
}

.swatch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.swatch-info strong {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.swatch-info code {
  font-size: 0.75rem;
  color: var(--color-primary);
}

.swatch-hex {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

/* Space List */
.space-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-item {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.space-item:hover {
  background: var(--color-hover);
}

.space-label {
  width: 140px;
  display: flex;
  flex-direction: column;
}

.space-bar-container {
  width: 120px;
  background: var(--color-hover);
  border-radius: 4px;
  height: 16px;
  display: flex;
  align-items: center;
}

.space-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
}

.space-usage {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

/* Font Size List */
.font-size-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.font-size-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}

.font-size-item:hover {
  background: var(--color-hover);
}

.font-size-meta {
  display: flex;
  gap: 10px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.font-size-sample {
  font-weight: 600;
  color: var(--color-text);
}

.font-size-usage {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* Radius & Shadow Grids */
.radius-grid,
.shadow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.radius-card,
.shadow-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  text-align: center;
}

.radius-box,
.shadow-box {
  width: 60px;
  height: 60px;
  background: var(--color-primary-tint);
  border: 1px solid var(--color-primary);
}

.radius-px,
.shadow-usage,
.radius-usage {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Font Weight List */
.font-weight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fw-item {
  font-size: 1.05rem;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

/* Card Showcase Grid */
.card-showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

/* Playground Controls */
.playground-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.ds-select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
}

.playground-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-hover);
  border-radius: 12px;
}

/* Tables & Flex Utilities */
.grid-table {
  display: grid;
  grid-template-columns: 140px repeat(3, 1fr);
  gap: 12px;
  align-items: center;
}

.grid-header {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 8px;
}

.flex-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.demo-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.demo-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.demo-inline {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Icon Grids */
.icon-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.icon-card-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.85rem;
}

.subgroup-title {
  margin: 16px 0 8px;
  font-size: 0.95rem;
}

.icon-triple-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}

.icon-triple-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.85rem;
}

.icon-label {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar-emoji-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.avatar-emoji-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1.15rem;
}
</style>
