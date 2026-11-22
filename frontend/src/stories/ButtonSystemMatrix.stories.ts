import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import DropdownMenu from '../components/primitives/DropdownMenu.vue';
import DropdownMenuItem from '../components/primitives/DropdownMenuItem.vue';
import PickerMenu from '../components/primitives/PickerMenu.vue';
import DoneToggle from '../components/primitives/DoneToggle.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import LinkedEntityButton from '../components/primitives/LinkedEntityButton.vue';
import InfoPopover from '../components/primitives/InfoPopover.vue';
import Input from '../components/primitives/Input.vue';
import Textarea from '../components/primitives/Textarea.vue';
import Select from '../components/primitives/Select.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import CheckboxCard from '../components/primitives/CheckboxCard.vue';
import Radio from '../components/primitives/Radio.vue';
import RadioCard from '../components/primitives/RadioCard.vue';
import ToggleSwitch from '../components/primitives/ToggleSwitch.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const meta: Meta = {
  title: 'Design System/Button, Form & Trigger Matrix',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const AllVariantsAndStates: Story = {
  name: '1. Basis-Varianten × Zustände',
  render: () => ({
    components: { Button, IconButton },
    setup() {
      return { ACTION_ICONS };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 900px;">
        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">6 kanonische Varianten (Default · Active · Disabled · Loading)</h3>
          <div style="display: grid; grid-template-columns: 120px repeat(4, max-content); gap: 10px 12px; align-items: center;">
            <strong style="font-size: 0.8rem;">primary</strong>
            <Button variant="primary" :icon="ACTION_ICONS.add">Speichern</Button>
            <Button variant="primary" active>Aktiv</Button>
            <Button variant="primary" disabled>Deaktiviert</Button>
            <Button variant="primary" loading>Lädt…</Button>

            <strong style="font-size: 0.8rem;">secondary</strong>
            <Button variant="secondary" :icon="ACTION_ICONS.edit">Abbrechen</Button>
            <Button variant="secondary" active>Aktiv</Button>
            <Button variant="secondary" disabled>Deaktiviert</Button>
            <Button variant="secondary" loading>Lädt…</Button>

            <strong style="font-size: 0.8rem;">tonal</strong>
            <Button variant="tonal" size="sm" :icon="ACTION_ICONS.myLocation">Auf Karte</Button>
            <Button variant="tonal" size="sm" active>Aktiv</Button>
            <Button variant="tonal" size="sm" disabled>Deaktiviert</Button>
            <Button variant="tonal" size="sm" loading>Lädt…</Button>

            <strong style="font-size: 0.8rem;">ghost</strong>
            <Button variant="ghost" size="sm" :icon="ACTION_ICONS.edit">Bearbeiten</Button>
            <Button variant="ghost" size="sm" active>Aktiv</Button>
            <Button variant="ghost" size="sm" disabled>Deaktiviert</Button>
            <Button variant="ghost" size="sm" loading>Lädt…</Button>

            <strong style="font-size: 0.8rem;">danger</strong>
            <Button variant="danger" :icon="ACTION_ICONS.delete">Löschen</Button>
            <Button variant="danger" secondary :icon="ACTION_ICONS.delete">Entfernen</Button>
            <Button variant="danger" disabled>Deaktiviert</Button>
            <Button variant="danger" loading>Lädt…</Button>
          </div>
        </section>

        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">Formen &amp; Slots: Pill-Variante (<code>shape="pill"</code>) &amp; Gestrichelt (<code>dashed</code>)</h3>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
            <Button variant="primary" shape="pill" size="sm" :icon="ACTION_ICONS.add">Primary Pill</Button>
            <Button variant="secondary" shape="pill" size="sm" :icon="ACTION_ICONS.edit">Secondary Pill</Button>
            <Button variant="tonal" shape="pill" size="sm" :icon="ACTION_ICONS.myLocation">Tonal Pill</Button>
            <Button variant="ghost" shape="pill" size="sm" :icon="ACTION_ICONS.unliked">Ghost Pill</Button>
            <Button variant="secondary" dashed size="sm" :icon="ACTION_ICONS.add">Slot (Squircle)</Button>
            <Button variant="secondary" dashed shape="pill" size="sm" :icon="ACTION_ICONS.add">Slot (Pill)</Button>
          </div>
        </section>

        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">overlay (auf Foto / Banner — initial schattenlos, Hover mit --shadow-sm)</h3>
          <div style="padding: 20px; border-radius: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; background: radial-gradient(circle at 22% 28%, rgba(255, 224, 150, 0.72) 0%, transparent 45%), linear-gradient(155deg, #2d5a7b 0%, #4b869e 38%, #3c6e58 72%, #243b30 100%);">
            <Button variant="overlay" shape="pill" size="sm" :icon="ACTION_ICONS.edit">Bild ändern</Button>
            <IconButton variant="overlay" shape="circle" size="sm" :icon="ACTION_ICONS.edit" aria-label="Bearbeiten" />
            <IconButton variant="overlay" shape="circle" size="sm" :icon="ACTION_ICONS.delete" aria-label="Löschen" />
            <Button variant="overlay" shape="pill" size="sm" disabled>Deaktiviert</Button>
          </div>
        </section>
      </div>
    `,
  }),
};

export const SizeScaleAndTouchTargets: Story = {
  name: '2. Größen-Skala (xs 30px · sm 36px · md 46px · lg 52px)',
  render: () => ({
    components: { Button, IconButton },
    setup() {
      return { ACTION_ICONS };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
          <Button variant="secondary" size="xs" :icon="ACTION_ICONS.edit">xs (30px)</Button>
          <Button variant="secondary" size="sm" :icon="ACTION_ICONS.edit">sm (36px)</Button>
          <Button variant="secondary" size="md" :icon="ACTION_ICONS.edit">md (46px)</Button>
          <Button variant="secondary" size="lg" :icon="ACTION_ICONS.edit">lg (52px)</Button>
        </div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
          <IconButton variant="ghost" size="xs" :icon="ACTION_ICONS.edit" aria-label="xs" />
          <IconButton variant="ghost" size="sm" :icon="ACTION_ICONS.edit" aria-label="sm" />
          <IconButton variant="ghost" size="md" :icon="ACTION_ICONS.edit" aria-label="md" />
          <IconButton variant="ghost" size="lg" :icon="ACTION_ICONS.edit" aria-label="lg" />
        </div>
      </div>
    `,
  }),
};

export const TriggerFamilyBaseline: Story = {
  name: '3. Trigger-Familie auf gemeinsamer sm-Grundlinie (36px)',
  render: () => ({
    components: {
      Button,
      IconButton,
      DropdownMenu,
      DoneToggle,
      CollapsibleFieldset,
      LinkedEntityButton,
      InfoPopover,
    },
    setup() {
      return { ACTION_ICONS };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 960px;">
        <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">
          Alle kompakten Card-Elemente und Trigger teilen exakt 36px Höhe (sm) bzw. 30px (xs) und dieselbe 2-Stufen-Hover-Physik (<code>DropdownMenu</code>, <code>DoneToggle</code> und <code>LinkedEntityButton</code> initial 3D-erhaben; <code>tonal</code>, <code>ghost</code> und <code>CollapsibleFieldset</code> initial flach):
        </p>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px; border: 1px dashed var(--color-border-strong); border-radius: 14px; background: var(--color-surface);">
          <DropdownMenu label="Sortieren" size="sm" :icon="ACTION_ICONS.sort" />
          <DoneToggle :done="true" :dropdown="true">14. Aug</DoneToggle>
          <LinkedEntityButton label="Tagebuch" :icon="ACTION_ICONS.order" />
          <Button variant="tonal" size="sm" :icon="ACTION_ICONS.myLocation">Auf Karte</Button>
          <Button variant="ghost" size="sm" :icon="ACTION_ICONS.unliked">3</Button>
          <IconButton variant="ghost" size="sm" :icon="ACTION_ICONS.edit" aria-label="Bearbeiten" />
          <InfoPopover title="Hinweis">
            <p>Alle Trigger folgen derselben einheitlichen Hover-Physik.</p>
          </InfoPopover>
        </div>

        <CollapsibleFieldset label="Erweiterte Optionen" :count="3" :icon="ACTION_ICONS.filterSettings">
          <p style="margin: 0; font-size: 0.85rem;">Inhalt im CollapsibleFieldset (Toggle nutzt Button secondary pill sm flat = 36px).</p>
        </CollapsibleFieldset>
      </div>
    `,
  }),
};

export const FormInputsAndControls: Story = {
  name: '4. Formular-Controls & Auswahl-Primitives',
  render: () => ({
    components: {
      Input,
      Textarea,
      Select,
      DropdownMenu,
      DropdownMenuItem,
      PickerMenu,
      Checkbox,
      CheckboxCard,
      Radio,
      RadioCard,
      ToggleSwitch,
      CollapsibleFieldset,
    },
    setup() {
      const textValue = ref('Lissabon');
      const notesValue = ref('Aussichtspunkt bei Sonnenuntergang besuchen.');
      const selectValue = ref('train');
      const dropdownOpen = ref(false);
      const selectedMode = ref('auto');
      const checkboxValue = ref(true);
      const checkboxCardValue = ref(true);
      const radioValue = ref('car');
      const radioCardValue = ref('shared');
      const switchValue = ref(true);

      const selectOptions = [
        { value: 'train', label: 'Zug / Bahn' },
        { value: 'car', label: 'Auto' },
        { value: 'bike', label: 'Fahrrad' },
      ];

      return {
        ACTION_ICONS,
        textValue,
        notesValue,
        selectValue,
        selectOptions,
        dropdownOpen,
        selectedMode,
        checkboxValue,
        checkboxCardValue,
        radioValue,
        radioCardValue,
        switchValue,
      };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 960px;">
        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">
            Eingabefelder (initial flach · Inset-Schacht bei Fokus) vs. DropdownMenu (initial 3D-erhaben)
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; align-items: start;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted);">Input (Standard · Pill · Zustände)</span>
              <Input v-model="textValue" placeholder="Reiseziel…" aria-label="Standard Input" />
              <Input model-value="Suche…" shape="pill" size="sm" aria-label="Pill Input" />
              <Input model-value="Ungültig" invalid aria-label="Ungültiger Input" />
              <Input model-value="Geändert" modified aria-label="Geänderter Input" />
              <Input model-value="Deaktiviert" disabled aria-label="Deaktivierter Input" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted);">Select (flach) vs. DropdownMenu (3D)</span>
              <Select v-model="selectValue" :options="selectOptions" aria-label="Standard Select" />
              <Select v-model="selectValue" :options="selectOptions" size="sm" aria-label="Kleiner Select" />
              <Select v-model="selectValue" :options="selectOptions" invalid aria-label="Ungültiger Select" />
              <Select v-model="selectValue" :options="selectOptions" disabled aria-label="Deaktivierter Select" />
              <DropdownMenu
                block
                :open="dropdownOpen"
                :label="selectedMode === 'auto' ? 'Automatisch (System)' : 'Hell'"
                :icon="ACTION_ICONS.filter"
                @toggle="dropdownOpen = !dropdownOpen"
              >
                <PickerMenu position="absolute" @close="dropdownOpen = false">
                  <DropdownMenuItem
                    label="Automatisch (System)"
                    :active="selectedMode === 'auto'"
                    @click="selectedMode = 'auto'; dropdownOpen = false"
                  />
                  <DropdownMenuItem
                    label="Hell"
                    :active="selectedMode === 'light'"
                    @click="selectedMode = 'light'; dropdownOpen = false"
                  />
                </PickerMenu>
              </DropdownMenu>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted);">Textarea (Standard · Invalid · Modified · Disabled)</span>
              <Textarea v-model="notesValue" :rows="2" placeholder="Notizen…" aria-label="Standard Textarea" />
              <Textarea model-value="Fehlerhafte Eingabe" :rows="2" invalid aria-label="Ungültige Textarea" />
              <Textarea model-value="Bearbeiteter Text" :rows="2" modified aria-label="Geänderte Textarea" />
              <Textarea model-value="Nur lesbar / deaktiviert" :rows="2" disabled aria-label="Deaktivierte Textarea" />
            </div>
          </div>
        </section>

        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">
            Checkbox, Radio &amp; ToggleSwitch
          </h3>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 20px; padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface);">
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
              <Checkbox v-model="checkboxValue" aria-label="Checkbox aktiv" />
              <span style="font-size: 0.875rem;">Checkbox ({{ checkboxValue ? 'an' : 'aus' }})</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: not-allowed; opacity: 0.6;">
              <Checkbox :model-value="true" disabled aria-label="Checkbox deaktiviert" />
              <span style="font-size: 0.875rem;">Deaktiviert</span>
            </label>

            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
              <Radio v-model="radioValue" value="car" name="matrix-radio" aria-label="Auto" />
              <span style="font-size: 0.875rem;">Radio Auto</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
              <Radio v-model="radioValue" value="train" name="matrix-radio" aria-label="Bahn" />
              <span style="font-size: 0.875rem;">Radio Bahn</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: not-allowed; opacity: 0.6;">
              <Radio :model-value="'disabled'" value="disabled" disabled name="matrix-radio-dis" aria-label="Radio deaktiviert" />
              <span style="font-size: 0.875rem;">Deaktiviert</span>
            </label>

            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
              <ToggleSwitch v-model="switchValue" aria-label="Toggle Switch" />
              <span style="font-size: 0.875rem;">Switch ({{ switchValue ? 'an' : 'aus' }})</span>
            </label>
            <ToggleSwitch :model-value="false" disabled aria-label="Switch deaktiviert" />
          </div>
        </section>

        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">
            CheckboxCard &amp; RadioCard (3D-Referenz für Light- &amp; Dark-Mode)
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
            <div>
              <CheckboxCard
                v-model="checkboxCardValue"
                variant="card"
                label="CheckboxCard (card)"
                description="Referenz für klare Kanten & 3D-Tiefe in Light & Dark Mode."
                :icon="ACTION_ICONS.done"
              />
              <CheckboxCard
                :model-value="false"
                variant="muted"
                label="CheckboxCard (muted)"
                description="Kompakte Variante für Dialoge & Popovers."
              />
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <RadioCard
                v-model="radioCardValue"
                value="shared"
                name="matrix-radiocard"
                variant="card"
                label="RadioCard (ausgewählt)"
                description="Für alle Mitreisenden sichtbar."
                :icon="ACTION_ICONS.shared"
              />
              <RadioCard
                v-model="radioCardValue"
                value="private"
                name="matrix-radiocard"
                variant="muted"
                label="RadioCard (muted)"
                description="Nur für mich sichtbar."
                :icon="ACTION_ICONS.private"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">
            CollapsibleFieldset (geschlossen &amp; geöffnet — Toggle bleibt flach)
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <CollapsibleFieldset label="Geschlossenes Fieldset" :icon="ACTION_ICONS.filterSettings">
              <Input model-value="Eingebettetes Feld" aria-label="Eingebettetes Feld" />
            </CollapsibleFieldset>
            <CollapsibleFieldset label="Geöffnetes Fieldset" :open-initial="true" count="(2 Felder)" :icon="ACTION_ICONS.edit">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <Input model-value="Feld im Fieldset" aria-label="Feld im Fieldset" />
                <Select v-model="selectValue" :options="selectOptions" aria-label="Select im Fieldset" />
              </div>
            </CollapsibleFieldset>
          </div>
        </section>
      </div>
    `,
  }),
};
