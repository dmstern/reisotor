import type { Meta, StoryObj } from '@storybook/vue3';
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import DropdownMenu from '../components/primitives/DropdownMenu.vue';
import DoneToggle from '../components/primitives/DoneToggle.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import LinkedEntityButton from '../components/primitives/LinkedEntityButton.vue';
import InfoPopover from '../components/primitives/InfoPopover.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const meta: Meta = {
  title: 'Design System/Button & Trigger Matrix',
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
          <h3 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted);">Formen: Pill-Variante (<code>shape="pill"</code> / <code>btn--pill</code>)</h3>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
            <Button variant="primary" shape="pill" size="sm" :icon="ACTION_ICONS.add">Primary Pill</Button>
            <Button variant="secondary" shape="pill" size="sm" :icon="ACTION_ICONS.edit">Secondary Pill</Button>
            <Button variant="tonal" shape="pill" size="sm" :icon="ACTION_ICONS.myLocation">Tonal Pill</Button>
            <Button variant="ghost" shape="pill" size="sm" :icon="ACTION_ICONS.unliked">Ghost Pill</Button>
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
          Alle kompakten Card-Elemente und Trigger sind initial flach, teilen exakt 36px Höhe (sm) bzw. 30px (xs) und dieselbe 2-Stufen-Hover-Physik:
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
          <p style="margin: 0; font-size: 0.85rem;">Inhalt im CollapsibleFieldset (Toggle nutzt Button secondary pill sm = 36px).</p>
        </CollapsibleFieldset>
      </div>
    `,
  }),
};
