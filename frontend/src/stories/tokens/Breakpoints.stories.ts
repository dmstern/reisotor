import type { Meta, StoryObj } from '@storybook/vue3';
import { ref, computed } from 'vue';

const meta: Meta = {
  title: 'Design Tokens/Viewport Breakpoints',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const InteractiveViewportVisualizer: Story = {
  render: () => ({
    setup() {
      const activeWidth = ref(850);

      const activeBreakpointInfo = computed(() => {
        const w = activeWidth.value;
        if (w < 480) {
          return {
            label: 'Mobil Schmal (Compact)',
            query: '@media (max-width: 480px)',
            icon: '📱',
            color: '#c1503f',
            mode: 'mobile',
            desc: 'Karten schalten auf Vertikal-Stapel um. Modals & Sheets füllen 100% Breite.',
          };
        }
        if (w < 700) {
          return {
            label: 'Mobil Standard',
            query: '@media (max-width: 799px)',
            icon: '📱',
            color: '#e08e45',
            mode: 'mobile',
            desc: 'Untere TabBar + ausziehbare Bottom-Sheets. 1-spaltiger Content.',
          };
        }
        if (w < 800) {
          return {
            label: 'Medium / Kalenderwoche',
            query: '@media (min-width: 700px)',
            icon: '📅',
            color: '#1e96d1',
            mode: 'mobile',
            desc: 'Kalenderwoche schaltet auf volle 7-Tage Ansicht um. Mobil-Layout bleibt aktiv.',
          };
        }
        if (w < 900) {
          return {
            label: 'Desktop Standard (Breakpoint)',
            query: '@media (min-width: 800px)',
            icon: '🖥️',
            color: '#2a7f74',
            mode: 'desktop',
            desc: 'Top Header + feste Sidebar-Drawers + Multi-Column Kachel-Grids.',
          };
        }
        if (w < 1400) {
          return {
            label: 'Breite Listen & Tabellen',
            query: '@media (min-width: 900px)',
            icon: '📊',
            color: '#5b6ee1',
            mode: 'desktop',
            desc: 'Todo-, Pack- & Einkaufslisten schalten auf mehrspaltige Tabellen-Grids um.',
          };
        }
        return {
          label: 'Ultra Wide / Multi-Column Split',
          query: '@media (min-width: 1400px)',
          icon: '🗺️',
          color: '#3f8f5c',
          mode: 'desktop',
          desc: 'Maximale Container-Breite (1400px/1600px) für Karte & Spot-Listen Split-Screen.',
        };
      });

      const presets = [
        { label: 'Mobil 390px', width: 390, icon: '📱' },
        { label: 'Break 480px', width: 480, icon: '📱' },
        { label: 'Medium 700px', width: 700, icon: '📅' },
        { label: 'Desktop 800px', width: 800, icon: '🖥️' },
        { label: 'Wide 900px', width: 900, icon: '📊' },
        { label: 'Split 1400px', width: 1400, icon: '🗺️' },
      ];

      const breakpointBars = [
        { label: 'Mobil Schmal', width: 480, query: '< 480px', color: '#c1503f' },
        { label: 'Medium / Kalender', width: 700, query: '≥ 700px', color: '#1e96d1' },
        { label: 'Desktop Standard', width: 800, query: '≥ 800px', color: '#2a7f74' },
        { label: 'Breite Tabellen', width: 900, query: '≥ 900px', color: '#5b6ee1' },
        { label: 'Standard Page', width: 960, query: '.page 960px', color: '#3da296' },
        { label: 'Wide Multi-Column', width: 1400, query: '1400px', color: '#3f8f5c' },
      ];

      return { activeWidth, activeBreakpointInfo, presets, breakpointBars };
    },
    template: `
      <div style="padding: 16px; font-family: var(--font-sans); max-width: 850px;">
        <h2 style="margin: 0 0 8px;">Interaktiver Viewport & Breakpoint Visualizer</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">
          Grafische Echtzeit-Visualisierung der Viewport-Breiten, Geräte-Frames und Layout-Veränderungen.
        </p>

        <!-- Live Resizer Controls -->
        <div style="padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">{{ activeBreakpointInfo.icon }}</span>
              <div>
                <strong style="font-size: 1.05rem; display: block;">{{ activeBreakpointInfo.label }}</strong>
                <code style="font-size: 0.8rem; color: var(--color-primary-dark);">{{ activeBreakpointInfo.query }}</code>
              </div>
            </div>

            <div style="font-size: 1.25rem; font-weight: bold; font-family: monospace; padding: 4px 12px; border-radius: 20px; background: var(--color-primary-tint); color: var(--color-primary-dark);">
              {{ activeWidth }}px
            </div>
          </div>

          <!-- Slider -->
          <input
            type="range"
            v-model.number="activeWidth"
            min="340"
            max="1400"
            step="10"
            style="width: 100%; height: 8px; border-radius: 4px; accent-color: var(--color-primary); cursor: pointer; margin-bottom: 16px;"
          />

          <!-- Preset Buttons -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button
              v-for="p in presets"
              :key="p.width"
              @click="activeWidth = p.width"
              style="padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm-squircle); background: var(--color-bg); font-family: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
              :style="activeWidth === p.width ? { background: 'var(--color-primary)', color: 'white', borderColor: 'var(--color-primary)' } : {}"
            >
              {{ p.icon }} {{ p.label }}
            </button>
          </div>
        </div>

        <!-- Simulated Device Frame Preview -->
        <h3 style="margin-bottom: 12px;">Live Geräte- & Layout-Vorschau</h3>
        <div style="border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-hover); padding: 16px; overflow-x: auto; margin-bottom: 32px;">
          <div
            :style="{
              width: 'min(100%, ' + activeWidth + 'px)',
              minHeight: '220px',
              margin: '0 auto',
              background: 'var(--color-surface)',
              border: '2px solid ' + activeBreakpointInfo.color,
              borderRadius: 'var(--radius-md-squircle)',
              boxShadow: 'var(--shadow-md)',
              transition: 'width 0.25s ease, border-color 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }"
          >
            <!-- Simulated App Header / Bar -->
            <div style="height: 36px; background: var(--color-primary-tint); border-bottom: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 0.78rem; font-weight: 600;">
              <span>🌴 Reisotor ({{ activeWidth }}px)</span>
              <span style="font-size: 0.72rem; color: var(--color-primary-dark);">{{ activeBreakpointInfo.mode === 'desktop' ? '🖥️ Top Sticky Header' : '📱 Mobile Status Header' }}</span>
            </div>

            <!-- Simulated Layout Body -->
            <div style="flex: 1; display: flex; gap: 8px; padding: 10px;">
              <!-- Simulated Sidebar (Desktop only) -->
              <div v-if="activeBreakpointInfo.mode === 'desktop'" style="width: 140px; background: var(--color-hover); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px; font-size: 0.72rem;">
                <div style="font-weight: bold; color: var(--color-text-muted);">Drawer Sidebar</div>
                <div style="height: 14px; background: var(--color-border); border-radius: 3px;"></div>
                <div style="height: 14px; background: var(--color-border); border-radius: 3px;"></div>
                <div style="height: 14px; background: var(--color-border); border-radius: 3px;"></div>
              </div>

              <!-- Main Content Grid / Cards -->
              <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                  {{ activeBreakpointInfo.desc }}
                </div>

                <div
                  :style="{
                    display: 'grid',
                    gridTemplateColumns: activeWidth >= 800 ? (activeWidth >= 1200 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)') : '1fr',
                    gap: '8px'
                  }"
                >
                  <div style="padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); font-size: 0.75rem;">
                    <strong>Spot 1</strong>: Elafonisi Strand
                  </div>
                  <div style="padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); font-size: 0.75rem;">
                    <strong>Spot 2</strong>: Samaria Schlucht
                  </div>
                  <div v-if="activeWidth >= 800" style="padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); font-size: 0.75rem;">
                    <strong>Spot 3</strong>: Balos Lagune
                  </div>
                </div>
              </div>
            </div>

            <!-- Simulated Bottom Navbar (Mobile only) -->
            <div v-if="activeBreakpointInfo.mode === 'mobile'" style="height: 32px; background: var(--color-surface); border-top: 1px solid var(--color-border); display: flex; justify-content: space-around; align-items: center; font-size: 0.72rem; color: var(--color-text-muted);">
              <span>🏠 Dash</span>
              <span>📍 Spots</span>
              <span>📅 Kalender</span>
              <span>⚙️ Setting</span>
            </div>
          </div>
        </div>

        <!-- Proportional Graphical Scale Bars -->
        <h3 style="margin-bottom: 12px;">Proportionale Breakpoint-Skala</h3>
        <div style="padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md-squircle); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 14px;">
          <div
            v-for="bar in breakpointBars"
            :key="bar.label"
            style="display: flex; flex-direction: column; gap: 4px;"
          >
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
              <strong>{{ bar.label }}</strong>
              <code :style="{ color: bar.color, fontWeight: 'bold' }">{{ bar.query }}</code>
            </div>
            <div style="background: var(--color-hover); height: 20px; border-radius: 10px; overflow: hidden; position: relative;">
              <div
                :style="{
                  width: (bar.width / 1600 * 100) + '%',
                  height: '100%',
                  background: bar.color,
                  borderRadius: '10px',
                  transition: 'width 0.3s ease'
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
};
