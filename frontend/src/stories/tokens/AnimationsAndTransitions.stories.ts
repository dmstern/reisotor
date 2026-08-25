import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Button from '../../components/primitives/Button.vue';
import Card from '../../components/primitives/Card.vue';

const meta: Meta = {
  title: 'Design Tokens/Animations & Motion',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const TransitionsAndMotion: Story = {
  render: () => ({
    components: { Button, Card },
    setup() {
      const showFade = ref(true);
      const listItems = ref(['Tagebuch Eintrag 1', 'Tagebuch Eintrag 2', 'Tagebuch Eintrag 3']);
      let nextId = 4;

      function addItem() {
        listItems.value.unshift(`Tagebuch Eintrag ${nextId++}`);
      }

      function removeItem(index: number) {
        listItems.value.splice(index, 1);
      }

      return { showFade, listItems, addItem, removeItem };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Animationen & Bewegungssystem</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          App-weit einheitliche Übergänge für CRUD-Aktionen, Listen-Verschiebungen und Barrierefreiheit.
        </p>

        <!-- 1. List Transition (.list-move / .list-enter-active) -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">1. Listen-Übergänge (.list-move)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Sanftes Reinfliegen (<code>translateY(-6px) scale(0.98)</code>, 0.2s ease-in-out) und sanftes Gleiten beim Umsortieren.
        </p>
        <div style="margin-bottom: 32px;">
          <Button variant="secondary" size="sm" @click="addItem" style="margin-bottom: 12px;">+ Eintrag hinzufügen</Button>

          <TransitionGroup name="list" tag="div" style="display: flex; flex-direction: column; gap: 8px;">
            <Card v-for="(item, i) in listItems" :key="item" variant="muted" style="display: flex; justify-content: space-between; align-items: center;">
              <span>{{ item }}</span>
              <Button variant="danger" size="sm" @click="removeItem(i)">Entfernen</Button>
            </Card>
          </TransitionGroup>
        </div>

        <!-- 2. Fade Transition (.fade-enter-active) -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">2. Einfaches Ein- & Ausblenden (.fade)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Sanfter Opacity-Wechsel (0.2s ease-in-out) für Overlays & Modals.
        </p>
        <div style="margin-bottom: 32px;">
          <Button variant="secondary" size="sm" @click="showFade = !showFade" style="margin-bottom: 12px;">
            {{ showFade ? 'Ausblenden' : 'Einblenden' }}
          </Button>

          <Transition name="fade">
            <Card v-if="showFade" style="background: var(--color-primary-tint); border-color: var(--color-primary);">
              Sanft ein- und ausblendendes Inhalts-Element.
            </Card>
          </Transition>
        </div>

        <!-- 3. Barrierefreiheit -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">3. Barrierefreiheit (prefers-reduced-motion)</h3>
        <div style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface);">
          <code style="font-size: 0.85rem; color: var(--color-primary-dark); font-weight: bold; display: block; margin-bottom: 6px;">@media (prefers-reduced-motion: reduce)</code>
          <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-muted);">
            Deaktiviert Aufklapp- & Gleitanimationen für Personen, die reduzierte Bewegung im Betriebssystem bevorzugen (LoadingIndicator, SplashScreen, ReisotorRobot).
          </p>
        </div>
      </div>
    `,
  }),
};
