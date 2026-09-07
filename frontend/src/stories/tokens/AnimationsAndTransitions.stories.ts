import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Button from '../../components/primitives/Button.vue';
import Card from '../../components/primitives/Card.vue';
import Accordion from '../../components/primitives/Accordion.vue';
import AppIcon from '../../components/AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

const meta: Meta = {
  title: 'Design Tokens/Animations & Motion',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const TransitionsAndMotion: Story = {
  render: () => ({
    components: { Button, Card, Accordion, AppIcon },
    setup() {
      const showFade = ref(true);
      const accordionOpen = ref(true);
      const accordionItems = ref([
        'Aufzeichnung vom 01.09.2026 00:32 (45 Min.)',
        'Aufzeichnung vom 01.09.2026 00:31 (12 Min.)',
        'Aufzeichnung vom 01.09.2026 00:27 (30 Min.)',
        'Aufzeichnung vom 01.09.2026 00:09 (18 Min.)',
      ]);
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

      return {
        showFade,
        accordionOpen,
        accordionItems,
        listItems,
        addItem,
        removeItem,
        shuffleItems,
        ACTION_ICONS,
      };
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

        <!-- 3. Akkordion-Aufklapp- & Stagger-Animation (.accordion & .accordion-stagger) -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">3. Akkordion-Aufklapp- & Stagger-Animation (.accordion & .accordion-stagger)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Flüssige CSS-Grid-Höhenanimation (<code>0fr</code> &rarr; <code>1fr</code>) kombiniert mit gestaffeltem Auffächern der Kindelemente (Top-to-Bottom beim Öffnen, Bottom-to-Top beim Schließen) und drehendem Caret-Icon.
        </p>
        <div style="margin-bottom: 36px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface);">
          <div style="background: var(--color-primary-tint); border-radius: var(--radius-md-squircle); overflow: hidden; max-width: 480px;">
            <button
              type="button"
              @click="accordionOpen = !accordionOpen"
              style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 14px; background: none; border: none; font: inherit; font-size: 0.85rem; font-weight: 600; color: var(--color-primary-dark); cursor: pointer;"
              :aria-expanded="accordionOpen"
            >
              <span style="display: flex; align-items: center; gap: 8px;">
                <AppIcon :icon="ACTION_ICONS.history" :size="15" group="actions" /> Aufzeichnungen ({{ accordionItems.length }})
              </span>
              <AppIcon
                :icon="ACTION_ICONS.chevronDown"
                :size="14"
                group="actions"
                class="caret"
                :class="{ closed: !accordionOpen }"
              />
            </button>
            <Accordion :expanded="accordionOpen">
              <ul class="accordion-stagger" style="display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0 8px 8px; list-style: none;">
                <li
                  v-for="(item, idx) in accordionItems"
                  :key="idx"
                  class="staggered-item"
                  :style="{ '--stagger-idx': idx, '--stagger-total': accordionItems.length }"
                  style="background: var(--color-surface); padding: 8px 12px; border-radius: var(--radius-sm-squircle); display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 500; color: var(--color-text);"
                >
                  <span>{{ item }}</span>
                  <AppIcon :icon="ACTION_ICONS.chevronRight" :size="12" group="actions" color="var(--color-text-muted)" />
                </li>
              </ul>
            </Accordion>
          </div>
        </div>

        <!-- 4. Taktile Mikro-Interaktionen -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">4. Taktiles Feedback (:active press scale)</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
          Buttons und klickbare Cards federn beim gedrückt Halten spürbar ein (<code>:active { transform: scale(0.96); }</code>). Halte die Maus/den Finger gedrückt, um das Einfedern zu sehen.
        </p>
        <div style="display: flex; gap: 16px; align-items: center; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); margin-bottom: 36px; flex-wrap: wrap;">
          <Button variant="primary">👉 Gedrückt halten (Button Press)</Button>
          <Card expandable style="padding: 12px 20px; margin: 0;">👉 Gedrückt halten (Card Press)</Card>
        </div>

        <!-- 5. Barrierefreiheit -->
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">5. Barrierefreiheit (prefers-reduced-motion)</h3>
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
