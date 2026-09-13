import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import ReisotorRobot from './ReisotorRobot.vue';
import Button from './primitives/Button.vue';

const meta: Meta<typeof ReisotorRobot> = {
  title: 'Components/ReisotorRobot',
  component: ReisotorRobot,
  tags: ['autodocs'],
  argTypes: {
    phase: {
      control: { type: 'select' },
      options: ['idle', 'scanning', 'done', 'packing'],
    },
    coveringEyes: { control: 'boolean' },
    size: { control: 'text' },
    variant: {
      control: { type: 'select' },
      options: ['blank', 'circle', 'full'],
    },
  },
  args: {
    phase: 'idle',
    coveringEyes: false,
    size: '180px',
    variant: 'blank',
  },
};

export default meta;
type Story = StoryObj<typeof ReisotorRobot>;

export const DefaultIdle: Story = {
  name: '1. Idle (Normalzustand)',
  args: {
    phase: 'idle',
    size: '180px',
  },
  render: (args) => ({
    components: { ReisotorRobot },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; background: var(--color-surface, #fff); border-radius: 12px;">
        <ReisotorRobot v-bind="args" />
        <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-muted, #666);">
          Sanftes EVE-Schweben mit neugierigem Wall-E Kamera-Fokus und lebendigen Linsen.
        </p>
      </div>
    `,
  }),
};

export const SecurityCheckScanning: Story = {
  name: '2. SecurityCheck: Scanning',
  args: {
    phase: 'scanning',
    size: '180px',
  },
  render: (args) => ({
    components: { ReisotorRobot },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; background: var(--color-surface, #fff); border-radius: 12px;">
        <ReisotorRobot v-bind="args" />
        <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-muted, #666);">
          Fokussiert nach unten mit Autofokus-Linsenzoom, holografischem Scan-Kegel und Radar-Pings.
        </p>
      </div>
    `,
  }),
};

export const SecurityCheckDone: Story = {
  name: '3. SecurityCheck: Done (Erfolg)',
  args: {
    phase: 'done',
    size: '180px',
  },
  render: (args) => ({
    components: { ReisotorRobot },
    setup() {
      return { args };
    },
    template: `
      <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; background: var(--color-surface, #fff); border-radius: 12px;">
        <ReisotorRobot v-bind="args" />
        <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-muted, #666);">
          Freudiger Hüpfer, leuchtende Linsenreflexionen und Glitzer-Partikel.
        </p>
      </div>
    `,
  }),
};

export const LoginCoveringEyes: Story = {
  name: '4. Login: Augen zuhalten (Interaktiv)',
  render: () => ({
    components: { ReisotorRobot, Button },
    setup() {
      const isSecret = ref(true);
      return { isSecret };
    },
    template: `
      <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; background: var(--color-surface, #fff); border-radius: 12px;">
        <ReisotorRobot :covering-eyes="isSecret" size="160px" />
        <Button size="sm" variant="secondary" @click="isSecret = !isSecret">
          {{ isSecret ? '👀 Passwort verstecken (Hände runter)' : '🙈 Passwort zeigen (Augen zuhalten)' }}
        </Button>
        <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted, #666);">
          Magnetische Schwebe-Arme gleiten hoch und verdecken die Linsen mit geschlossenen Shutter-Lidern.
        </p>
      </div>
    `,
  }),
};

export const LoadingPacking: Story = {
  name: '5. Loading / Packing (SplashScreen)',
  render: () => ({
    components: { ReisotorRobot, Button },
    setup() {
      const active = ref(true);
      const replayKey = ref(0);
      const statusText = ref('Packt Utensilien...');

      function replay() {
        active.value = false;
        statusText.value = 'Neustart...';
        setTimeout(() => {
          active.value = true;
          replayKey.value++;
          statusText.value = 'Packt Utensilien...';
        }, 50);
      }

      function onPackingDone() {
        statusText.value = '✅ Fertig gepackt (ready)';
      }

      return { active, replayKey, statusText, replay, onPackingDone };
    },
    template: `
      <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; background: var(--color-surface, #fff); border-radius: 12px;">
        <ReisotorRobot
          v-if="active"
          :key="replayKey"
          phase="packing"
          size="160px"
          @packing-done="onPackingDone"
        />
        <div style="display: flex; gap: 12px; align-items: center;">
          <Button size="sm" variant="primary" @click="replay">🔁 Animation erneut abspielen</Button>
          <span style="font-size: 0.9rem; font-weight: 600;">{{ statusText }}</span>
        </div>
        <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted, #666);">
          Roboter saugt Flugticket und Reisekamera elastisch ein, Rucksack dockt an den Rücken an.
        </p>
      </div>
    `,
  }),
};

export const LogoVariants: Story = {
  name: '6. Logo-Varianten (blank, circle, full)',
  render: () => ({
    components: { ReisotorRobot },
    template: `
      <div style="display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; padding: 24px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <ReisotorRobot variant="blank" size="140px" />
          <strong style="font-size: 0.85rem;">variant="blank"</strong>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Transparent</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <ReisotorRobot variant="circle" size="140px" />
          <strong style="font-size: 0.85rem;">variant="circle"</strong>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Circle BG</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <ReisotorRobot variant="full" size="140px" />
          <strong style="font-size: 0.85rem;">variant="full"</strong>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Squircle BG</span>
        </div>
      </div>
    `,
  }),
};
