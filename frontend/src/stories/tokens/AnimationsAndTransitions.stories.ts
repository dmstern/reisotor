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

      function shuffleItems() {
        listItems.value = [...listItems.value].sort(() => Math.random() - 0.5);
      }

      return { showFade, listItems, addItem, removeItem, shuffleItems };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 750px;">
        <h2 style="margin: 0 0 8px;">Animationen & Bewegungssystem</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 28px;">
          App-weit einheitliche Übergänge für CRUD-Aktionen, Listen-Verschiebungen und Mikro-Interaktionen.
        </p>

        <!-- 1. List Transition (.list-move / .list-enter-active) -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">1. FLIP Listen-Übergänge (.list-move & .list-leave-active)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Sanftes Einblenden (<code>translateY(-6px) scale(0.98)</code>) und sanftes Gleiten beim Entfernen oder Umsortieren (FLIP via <code>position: absolute</code> in <code>.list-leave-active</code>).
        </p>
        <div style="margin-bottom: 36px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface);">
          <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <Button variant="primary" size="sm" @click="addItem">+ Eintrag oben hinzufügen</Button>
            <Button variant="secondary" size="sm" @click="shuffleItems">🔀 Listenreihenfolge mischen</Button>
          </div>

          <div style="position: relative; min-height: 180px;">
            <TransitionGroup name="list" tag="div" style="display: flex; flex-direction: column; gap: 10px; position: relative;">
              <Card
                v-for="(item, i) in listItems"
                :key="item"
                variant="muted"
                style="display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;"
              >
                <strong style="font-size: 0.9rem; color: var(--color-text);">{{ item }}</strong>
                <Button variant="danger" size="sm" @click="removeItem(i)">Löschen</Button>
              </Card>
            </TransitionGroup>
          </div>
        </div>

        <!-- 2. Fade & Scale Transition (.fade-enter-active) -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">2. Modal & Card Einblenden (.fade)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Sanftes Ein- und Ausblenden (<code>opacity: 0</code> + <code>scale(0.96)</code>) für Dialoge, Overlays und Tooltips.
        </p>
        <div style="margin-bottom: 36px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface);">
          <Button variant="secondary" size="sm" @click="showFade = !showFade" style="margin-bottom: 16px;">
            {{ showFade ? 'Card ausblenden' : 'Card einblenden' }}
          </Button>

          <div style="min-height: 80px; position: relative;">
            <Transition name="fade">
              <div v-if="showFade" class="fade-demo-wrapper" style="transition: all 0.25s ease;">
                <Card style="background: var(--color-primary-tint); border-color: var(--color-primary); color: var(--color-primary-dark);">
                  <strong>Sanft blendende Vorschau-Card:</strong> Klicke den Button oben, um die <code>.fade</code> Vue-Transition mit Opacity & Skalierung live zu testen.
                </Card>
              </div>
            </Transition>
          </div>
        </div>

        <!-- 3. Taktile Mikro-Interaktionen -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">3. Taktiles Feedback (:active press scale)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Buttons und klickbare Cards federn beim gedrückt Halten spürbar ein (<code>:active { transform: scale(0.96); }</code>). Halte die Maus/den Finger gedrückt, um das Einfedern zu sehen.
        </p>
        <div style="display: flex; gap: 16px; align-items: center; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); margin-bottom: 36px; flex-wrap: wrap;">
          <Button variant="primary">👉 Gedrückt halten (Button Press)</Button>
          <Card expandable style="padding: 12px 20px; margin: 0;">👉 Gedrückt halten (Card Press)</Card>
        </div>

        <!-- 4. Barrierefreiheit -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">4. Barrierefreiheit (prefers-reduced-motion)</h3>
        <div style="padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-hover);">
          <code style="font-size: 0.85rem; color: var(--color-primary-dark); font-weight: bold; display: block; margin-bottom: 6px;">@media (prefers-reduced-motion: reduce)</code>
          <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-muted);">
            Deaktiviert Aufklapp- & Gleitanimationen für Personen, die reduzierte Bewegung im Betriebssystem bevorzugen (LoadingIndicator, SplashScreen, ReisotorRobot).
          </p>
        </div>
      </div>
    `,
  }),
};
