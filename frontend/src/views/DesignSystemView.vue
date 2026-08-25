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

// Navigation Tabs in Showcase
const currentTab = ref('primitives');
const showcaseTabs = [
  { key: 'primitives', label: 'Primitives', icon: ACTION_ICONS.edit },
  { key: 'forms', label: 'Formulare & Inputs', icon: SECTION_ICON_DEFS.notes },
  { key: 'navigation', label: 'Navigation & Icons', icon: SECTION_ICON_DEFS.calendar },
  { key: 'feedback', label: 'Feedback & Badges', icon: ACTION_ICONS.shared },
  { key: 'overlays', label: 'Dialoge & Overlays', icon: ACTION_ICONS.close },
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
    <!-- Header & Meta Toolbar -->
    <header class="ds-header">
      <div class="ds-header-title">
        <h1>Reisotor Design System</h1>
        <p class="hint">Interaktive Vorschau aller UI-Primitives & Komponenten</p>
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
      <!-- 1. PRIMITIVES SECTION -->
      <section v-if="currentTab === 'primitives'" class="ds-section">
        <h2>1. Button Primitives (Button.vue)</h2>
        <Card class="ds-card">
          <h3>Interactive Playground</h3>
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
              <span>Disabled</span>
            </label>
          </div>

          <div class="playground-preview">
            <Button :variant="btnVariant" :size="btnSize" :disabled="btnDisabled">
              {{ btnText }}
            </Button>
          </div>
        </Card>

        <h3>Alle Button-Varianten & Größen</h3>
        <Card class="ds-card">
          <div class="grid-table">
            <div class="grid-header">Variante</div>
            <div class="grid-header">sm (Kompakt)</div>
            <div class="grid-header">md (Standard)</div>
            <div class="grid-header">lg (Groß)</div>

            <div><strong>Primary</strong></div>
            <div><Button variant="primary" size="sm">Aktion</Button></div>
            <div><Button variant="primary" size="md">Haupt-Aktion</Button></div>
            <div><Button variant="primary" size="lg">Große Aktion</Button></div>

            <div><strong>Secondary</strong></div>
            <div><Button variant="secondary" size="sm">Aktion</Button></div>
            <div><Button variant="secondary" size="md">Sekundär</Button></div>
            <div><Button variant="secondary" size="lg">Große Sekundär</Button></div>

            <div><strong>Danger</strong></div>
            <div><Button variant="danger" size="sm">Löschen</Button></div>
            <div><Button variant="danger" size="md">Gefahr / Löschen</Button></div>
            <div><Button variant="danger" size="lg">Endgültig Löschen</Button></div>

            <div><strong>Card Action</strong></div>
            <div><Button variant="card-action" size="sm">📌 Tag</Button></div>
            <div><Button variant="card-action" size="md">📌 Karte-Aktion</Button></div>
            <div><Button variant="card-action" size="lg">📌 Großes Tag</Button></div>

            <div><strong>Ghost</strong></div>
            <div><Button variant="ghost" size="sm">Option</Button></div>
            <div><Button variant="ghost" size="md">Dezent / Ghost</Button></div>
            <div><Button variant="ghost" size="lg">Großes Ghost</Button></div>
          </div>
        </Card>

        <h2>2. Icon Button Primitives (IconButton.vue)</h2>
        <Card class="ds-card">
          <div class="flex-row">
            <div class="demo-box">
              <span class="demo-title">Ghost (Default)</span>
              <div class="demo-inline">
                <IconButton size="sm">⚙️</IconButton>
                <IconButton size="md">⚙️</IconButton>
                <IconButton size="lg">⚙️</IconButton>
              </div>
            </div>

            <div class="demo-box">
              <span class="demo-title">Secondary (Border)</span>
              <div class="demo-inline">
                <IconButton variant="secondary" size="sm">✏️</IconButton>
                <IconButton variant="secondary" size="md">✏️</IconButton>
                <IconButton variant="secondary" size="lg">✏️</IconButton>
              </div>
            </div>

            <div class="demo-box">
              <span class="demo-title">Danger (Löschen)</span>
              <div class="demo-inline">
                <IconButton variant="danger" size="sm">🗑️</IconButton>
                <IconButton variant="danger" size="md">🗑️</IconButton>
                <IconButton variant="danger" size="lg">🗑️</IconButton>
              </div>
            </div>

            <div class="demo-box">
              <span class="demo-title">Active State</span>
              <div class="demo-inline">
                <IconButton :active="true" size="sm">⭐</IconButton>
                <IconButton :active="true" size="md">⭐</IconButton>
                <IconButton :active="true" size="lg">⭐</IconButton>
              </div>
            </div>
          </div>
        </Card>

        <h2>3. Card & Surface Primitives (Card.vue)</h2>
        <div class="grid-2col">
          <Card>
            <h3>Standard Card (.card)</h3>
            <p>Heller Hintergrund mit Squircle-Eckenrundung und sanftem Schatten (--shadow-sm).</p>
            <ButtonGroup align="end">
              <Button variant="secondary" size="sm">Abbrechen</Button>
              <Button variant="primary" size="sm">Bestätigen</Button>
            </ButtonGroup>
          </Card>

          <Card variant="muted">
            <h3>Muted Card (.card--muted)</h3>
            <p>Hinterlegter Hintergrund (--color-hover) für untergeordnete Panels oder Widgets.</p>
            <ButtonGroup align="end">
              <Button variant="card-action" size="sm">📌 Details</Button>
            </ButtonGroup>
          </Card>
        </div>

        <h2>4. Input Primitives (Input.vue)</h2>
        <Card class="ds-card">
          <div class="playground-controls">
            <label>
              <span>Größe:</span>
              <select v-model="inputSize" class="ds-select">
                <option value="sm">sm (36px)</option>
                <option value="md">md (44px)</option>
                <option value="lg">lg (50px)</option>
              </select>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="inputDisabled" />
              <span>Disabled</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="inputInvalid" />
              <span>Invalid</span>
            </label>
          </div>

          <div class="playground-preview">
            <Input
              v-model="inputValue"
              :size="inputSize"
              :disabled="inputDisabled"
              :invalid="inputInvalid"
              placeholder="Textfeld..."
            />
          </div>
        </Card>
      </section>

      <!-- 2. FORMS & INPUTS SECTION -->
      <section v-if="currentTab === 'forms'" class="ds-section">
        <h2>Formular-Komponenten (FormField.vue, SegmentedToggle.vue, Combobox.vue)</h2>

        <Card class="ds-card">
          <h3>Formularfeld Wrapper (FormField.vue)</h3>
          <p class="hint">Behält das Label und ein Icon oberhalb des Feldes sichtbar.</p>

          <div class="form-grid">
            <FormField label="Urlaubs-Titel" icon="title">
              <Input placeholder="z. B. Sommerurlaub 2026" />
            </FormField>

            <FormField label="Abreisedatum" icon="date">
              <Input type="date" model-value="2026-08-25" />
            </FormField>

            <FormField label="Budget" icon="amount">
              <Input type="number" placeholder="500 €" />
            </FormField>
          </div>
        </Card>

        <Card class="ds-card">
          <h3>Segmented Control (SegmentedToggle.vue)</h3>
          <p class="hint">Tactile Pill Toggle mit gleitendem Thumb und weichem Material-Schatten.</p>

          <div class="toggle-demo">
            <SegmentedToggle
              v-model="toggleValue"
              :options="[
                { value: 'spots', label: 'Spots', icon: SECTION_ICON_DEFS.excursions },
                { value: 'tours', label: 'Touren', icon: SECTION_ICON_DEFS.calendar },
              ]"
            />
            <p>Ausgewählter Wert: <strong>{{ toggleValue }}</strong></p>
          </div>
        </Card>

        <Card class="ds-card">
          <h3>Suchbare Combobox (Combobox.vue)</h3>
          <p class="hint">Auto-suggesting Dropdown mit Live-Filterung und Keyboard-Navigation.</p>

          <div style="max-width: 320px;">
            <Combobox v-model="comboboxValue" :options="comboboxOptions" placeholder="Kategorie wählen..." />
          </div>
        </Card>
      </section>

      <!-- 3. NAVIGATION & ICONS SECTION -->
      <section v-if="currentTab === 'navigation'" class="ds-section">
        <h2>Tab-Navigation (TabBar.vue)</h2>
        <Card class="ds-card">
          <TabBar :tabs="tabBarItems" :active-key="activeTabBarKey" @select="activeTabBarKey = $event" />
          <div style="padding: 16px 0;">
            Aktiver Tab: <strong>{{ activeTabBarKey }}</strong>
          </div>
        </Card>

        <h2>Icons & Entitäten (AppIcon.vue)</h2>

        <!-- Gruppe 1: Navigation & Dashboard -->
        <Card class="ds-card">
          <h3>Gruppe 1: Navigation & Dashboard</h3>
          <p class="hint">Hauptnavigation, Nav-Bar und Bereichs-Abschnitte (Emoji vs. Tabler Icon)</p>
          <div class="icon-triple-grid">
            <div v-for="(def, key) in SECTION_ICON_DEFS" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="def" :size="24" group="navigation" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="def" :size="24" group="navigation" force-style="icons" color="var(--color-text)" /></span>
              <span class="icon-label">{{ key }}</span>
            </div>
          </div>
        </Card>

        <!-- Gruppe 2: Kategorien (Kalender, Spots, Reise, Kartenmarker & Wetter) -->
        <Card class="ds-card">
          <h3>Gruppe 2: Kategorien & Wetter</h3>
          <p class="hint">
            Kalender-Einträge, Orte- / Spot-Kategorien, Kartenmarker & Wetter-Status.<br />
            Spalten: <strong>Emoji</strong> | <strong>Tabler Monochrom</strong> | <strong>Tabler Gefärbt</strong>
          </p>

          <h4 class="subgroup-title">Kalender-Kategorien</h4>
          <div class="icon-triple-grid">
            <div v-for="(meta, key) in SCHEDULE_CATEGORY_META" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="meta.tabler" :size="22" group="categories" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="meta.tabler" :size="22" group="categories" force-style="icons" color="var(--color-text)" /></span>
              <span class="col-colored"><AppIcon :icon="meta.tabler" :size="22" group="categories" force-style="icons" :color="meta.color" /></span>
              <span class="icon-label">{{ meta.label }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Spot- & Orte-Kategorien</h4>
          <div class="icon-triple-grid">
            <div v-for="cat in spotCategories" :key="cat.name" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="cat.meta.tabler" :size="22" group="categories" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="cat.meta.tabler" :size="22" group="categories" force-style="icons" color="var(--color-text)" /></span>
              <span class="col-colored"><AppIcon :icon="cat.meta.tabler" :size="22" group="categories" force-style="icons" :color="cat.meta.color" /></span>
              <span class="icon-label">{{ cat.name }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Wetter-Status Icons</h4>
          <div class="icon-triple-grid">
            <div v-for="w in weatherCodes" :key="w.code" class="icon-triple-item">
              <span class="col-emoji">{{ w.meta.icon }}</span>
              <span class="col-tabler"><AppIcon :icon="w.meta.tabler" :size="22" group="weather" force-style="icons" color="var(--color-text)" /></span>
              <span class="col-colored"><WeatherIcon :code="w.code" :size="22" /></span>
              <span class="icon-label">{{ w.meta.label }}</span>
            </div>
          </div>
        </Card>

        <!-- Gruppe 3: Buttons, Interaktionen, Formularfelder & Profil-Avatare -->
        <Card class="ds-card">
          <h3>Gruppe 3: Buttons, Interaktionen, Formularfelder & Profil-Avatare</h3>
          <p class="hint">Aktions-Buttons, Modals, Formularfelder & wählbare Nutzer-Avatare</p>

          <h4 class="subgroup-title">Aktions- & Status-Icons</h4>
          <div class="icon-triple-grid">
            <div v-for="(def, key) in ACTION_ICONS" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="def" :size="22" group="actions" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="def" :size="22" group="actions" force-style="icons" color="var(--color-text)" /></span>
              <span class="icon-label">{{ key }}</span>
            </div>
          </div>

          <h4 class="subgroup-title" style="margin-top: 20px;">Formularfeld-Icons</h4>
          <div class="icon-triple-grid">
            <div v-for="(def, key) in FORM_FIELD_ICONS" :key="key" class="icon-triple-item">
              <span class="col-emoji"><AppIcon :icon="def" :size="22" group="formFields" force-style="emoji" /></span>
              <span class="col-tabler"><AppIcon :icon="def" :size="22" group="formFields" force-style="icons" color="var(--color-text)" /></span>
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

      <!-- 4. FEEDBACK & BADGES SECTION -->
      <section v-if="currentTab === 'feedback'" class="ds-section">
        <h2>Status-Badges & Feedback-Elemente</h2>
        <Card class="ds-card">
          <h3>Badges & Chips</h3>
          <div class="flex-row">
            <CategoryChip category="Essen & Trinken" />
            <CategoryChip category="Sehenswürdigkeit" />
            <DraftBadge />
            <PendingSyncBadge />
          </div>

          <h3 style="margin-top: 24px;">Wetter-Icons (WeatherIcon.vue)</h3>
          <div class="flex-row">
            <WeatherIcon :code="0" :size="28" />
            <WeatherIcon :code="2" :size="28" />
            <WeatherIcon :code="61" :size="28" />
            <WeatherIcon :code="95" :size="28" />
          </div>

          <h3 style="margin-top: 24px;">Ladezustände</h3>
          <div class="flex-row">
            <LoadingIndicator size="sm" />
            <LoadingIndicator size="md" />
            <LoadingIndicator size="lg" />
          </div>
        </Card>
      </section>

      <!-- 5. DIALOGE & OVERLAYS SECTION -->
      <section v-if="currentTab === 'overlays'" class="ds-section">
        <h2>Dialoge & Modals (Modal.vue)</h2>
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
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-3);
}

.ds-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.ds-header-title h1 {
  margin: 0 0 var(--space-1);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.ds-header-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ds-nav {
  margin-bottom: var(--space-4);
}

.ds-section h2 {
  font-size: 1.25rem;
  margin: var(--space-4) 0 var(--space-2);
  color: var(--color-text);
}

.ds-card {
  margin-bottom: var(--space-4);
  padding: var(--space-4);
}

.playground-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-hover);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  margin-bottom: var(--space-3);
}

.playground-controls label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.85rem;
  font-weight: 600;
}

.checkbox-label {
  cursor: pointer;
}

.ds-select {
  padding: 4px 8px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text);
}

.playground-preview {
  padding: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  margin-bottom: var(--space-3);
}

.grid-table {
  display: grid;
  grid-template-columns: 140px repeat(3, 1fr);
  gap: var(--space-2);
  align-items: center;
}

.grid-header {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-1);
}

.flex-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.demo-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.demo-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.demo-inline {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.grid-2col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-3);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.subgroup-title {
  margin: var(--space-3) 0 var(--space-2);
  font-size: 0.95rem;
  color: var(--color-primary-dark);
}

.icon-triple-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-2);
}

.icon-triple-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.82rem;
}

.col-emoji,
.col-tabler,
.col-colored {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
}

.icon-label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 2px;
}

.avatar-emoji-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.avatar-emoji-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1.15rem;
}
</style>
