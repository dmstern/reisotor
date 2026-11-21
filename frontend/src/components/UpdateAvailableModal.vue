<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import ReisotorRobot from './ReisotorRobot.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { usePwaUpdateStore } from '../stores/pwaUpdate';

const pwaUpdate = usePwaUpdateStore();
const router = useRouter();
const isUpdating = ref(false);

const formatVersion = (v: string) => (v.startsWith('v') ? v : `v${v}`);

// Versionswechsel oder neue Zielversion anzeigen, sobald die Version bekannt ist.
const versionDisplay = computed(() => {
  const to = pwaUpdate.availableVersion;

  if (!to) {
    return null;
  }

  const from = pwaUpdate.currentVersion;
  const formattedTo = formatVersion(to);

  if (from && from !== 'unknown' && from !== to) {
    return {
      from: formatVersion(from),
      to: formattedTo,
    };
  }

  return { to: formattedTo };
});

watch(
  () => pwaUpdate.showUpdateDialog,
  (visible) => {
    if (visible) {
      pwaUpdate.loadAvailableVersion();
    }
  },
  { immediate: true }
);

function onClose() {
  if (pwaUpdate.updateRequired) {
    return;
  }

  pwaUpdate.dismissUpdateDialog();
}

function updateNow() {
  isUpdating.value = true;
  pwaUpdate.reload();
}

function goToSettings() {
  pwaUpdate.dismissUpdateDialog();
  router.push({ path: '/settings', query: { tab: 'notifications' } });
}
</script>

<template>
  <Modal
    :model-value="pwaUpdate.showUpdateDialog"
    :title="pwaUpdate.updateRequired ? 'Aktualisierung erforderlich' : 'Neues Update verfügbar'"
    :closable="!pwaUpdate.updateRequired"
    size="sm"
    @update:model-value="onClose"
  >
    <div class="update-modal" :class="{ 'is-required': pwaUpdate.updateRequired }">
      <div class="update-hero-stage" aria-hidden="true">
        <!-- Weicher Glüh-Hintergrund & rotierender Schimmer-Ring -->
        <div class="glow-backdrop" />
        <div class="shimmer-ring" />

        <!-- Aufsteigende Glitzer-Partikel -->
        <div class="stage-sparkles">
          <span class="stage-sparkle s-1">✦</span>
          <span class="stage-sparkle s-2">✨</span>
          <span class="stage-sparkle s-3">✦</span>
          <span class="stage-sparkle s-4">✨</span>
          <span class="stage-sparkle s-5">✦</span>
          <span class="stage-sparkle s-6">⭐</span>
        </div>

        <!-- Reisotor-Roboter im Update-Modus mit lebendigen Linsen und Signalwellen -->
        <ReisotorRobot size="92px" phase="upgrade" interactive />
      </div>

      <!-- Glänzender Pill-Badge -->
      <div class="update-pill-badge" :class="{ 'is-required': pwaUpdate.updateRequired }">
        <AppIcon
          v-if="pwaUpdate.updateRequired"
          :icon="ACTION_ICONS.warning"
          :size="14"
          group="actions"
          force-style="icons"
          class="badge-tabler-icon"
        />
        <span v-else class="badge-icon" aria-hidden="true">✨</span>
        <span class="badge-text">{{
          pwaUpdate.updateRequired ? 'Pflicht-Update erforderlich' : 'Neue Version bereit'
        }}</span>
        <span v-if="!pwaUpdate.updateRequired" class="badge-icon" aria-hidden="true">✨</span>
        <span v-if="versionDisplay" class="badge-versions" data-testid="version-change">
          <template v-if="versionDisplay.from">
            {{ versionDisplay.from }}
            <span aria-label="auf">→</span>
          </template>
          {{ versionDisplay.to }}
        </span>
      </div>

      <p v-if="pwaUpdate.updateRequired" class="update-desc">
        Diese Version von Reisotor ist nicht mehr mit dem Server kompatibel (z. B. durch Änderungen
        an Schnittstellen oder Datenformaten). Bitte aktualisiere jetzt, um weiterzuarbeiten – deine
        lokalen Daten und ungespeicherten Offline-Änderungen bleiben erhalten.
      </p>
      <p v-else class="update-desc">
        Eine neuere Version von Reisotor steht bereit. Aktualisiere jetzt, um die neuesten
        Funktionen und Verbesserungen zu laden.
      </p>

      <div class="update-actions">
        <Button
          variant="primary"
          :icon="ACTION_ICONS.refresh"
          class="action-btn update-btn"
          :loading="isUpdating"
          @click="updateNow"
        >
          Jetzt aktualisieren
        </Button>
        <Button
          v-if="!pwaUpdate.updateRequired"
          variant="secondary"
          class="action-btn"
          :disabled="isUpdating"
          @click="onClose"
        >
          Später
        </Button>
      </div>

      <p v-if="!pwaUpdate.updateRequired" class="settings-hint">
        Hinweis: Du kannst diese Update-Popups in den
        <button type="button" class="settings-link" @click="goToSettings">Einstellungen</button>
        deaktivieren.
      </p>
    </div>
  </Modal>
</template>

<style scoped>
.update-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
}

.update-hero-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 184px;
  margin-top: var(--space-1);
  /* Der Modal-Body schneidet überstehenden Inhalt (Glow, aufsteigende Glitzer) am oberen Rand hart
     ab. Eine Maske blendet die Bühne oben und unten weich aus, bevor die Kanten erreicht werden. */
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 20%,
    black 80%,
    transparent 100%
  );
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}

.glow-backdrop {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-pill);
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-primary) 34%, transparent) 0%,
    color-mix(in srgb, var(--color-accent, #ff9800) 20%, transparent) 45%,
    transparent 72%
  );
  filter: blur(12px);
  pointer-events: none;
  animation: glow-pulse 3.6s ease-in-out infinite alternate;
}

@keyframes glow-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.65;
  }
  100% {
    transform: scale(1.18);
    opacity: 1;
  }
}

.shimmer-ring {
  position: absolute;
  width: 116px;
  height: 116px;
  border-radius: var(--radius-pill);
  border: 1.5px dashed color-mix(in srgb, var(--color-primary) 45%, transparent);
  pointer-events: none;
  opacity: 0.7;
  animation: ring-rotate 20s linear infinite;
}

@keyframes ring-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.stage-sparkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.stage-sparkle {
  position: absolute;
  line-height: var(--line-height-none);
  pointer-events: none;
  animation: stage-float-sparkle 2.6s cubic-bezier(0.25, 1, 0.5, 1) infinite;
  opacity: 0;
}

.s-1 {
  left: 12%;
  bottom: 22%;
  color: var(--color-accent, #ff9800);
  font-size: var(--font-size-lg);
  animation-delay: 0s;
}

.s-2 {
  left: 20%;
  top: 15%;
  color: #f2367d;
  font-size: var(--font-size-sm);
  animation-delay: 0.8s;
}

.s-3 {
  right: 14%;
  bottom: 26%;
  color: #00e5ff;
  font-size: var(--font-size-md);
  animation-delay: 1.4s;
}

.s-4 {
  right: 18%;
  top: 12%;
  color: #ffb703;
  font-size: var(--font-size-md);
  animation-delay: 0.4s;
}

.s-5 {
  left: 6%;
  top: 42%;
  color: #5cb37e;
  font-size: var(--font-size-sm);
  animation-delay: 1.9s;
}

.s-6 {
  right: 8%;
  top: 46%;
  color: #e91e63;
  font-size: var(--font-size-sm);
  animation-delay: 1.1s;
}

@keyframes stage-float-sparkle {
  0% {
    transform: translateY(12px) scale(0.4) rotate(0deg);
    opacity: 0;
  }
  25% {
    opacity: 0.95;
    transform: translateY(0px) scale(1.1) rotate(45deg);
  }
  75% {
    opacity: 0.8;
    transform: translateY(-24px) scale(0.9) rotate(90deg);
  }
  100% {
    transform: translateY(-44px) scale(0.2) rotate(135deg);
    opacity: 0;
  }
}

.update-pill-badge {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 2px var(--space-1);
  padding: 3px 12px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary-tint) 65%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary-dark);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--color-primary) 15%, transparent);
  position: relative;
  overflow: hidden;
}

.update-pill-badge::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.45) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: badge-glint 3.2s ease-in-out infinite;
}

@keyframes badge-glint {
  0%,
  60% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.update-pill-badge.is-required {
  background: color-mix(in srgb, var(--color-warning-tint) 75%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-warning) 45%, transparent);
  color: var(--color-warning-dark);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--color-warning) 18%, transparent);
}

.badge-tabler-icon {
  flex-shrink: 0;
}

.badge-icon {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-none);
}

.badge-text {
  line-height: var(--line-height-tight);
}

/* Eigene Zeile unterhalb des Labels, damit die Pille auch bei langen Versionsnummern schmal bleibt. */
.badge-versions {
  flex-basis: 100%;
  text-align: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: var(--line-height-tight);
  opacity: 0.85;
}

.update-desc {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text-muted);
  margin: 0;
  max-width: 380px;
}

.update-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
}

.action-btn {
  width: 100%;
  justify-content: center;
}

.update-btn {
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--color-primary) 35%, transparent);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.update-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 45%, transparent);
}

.update-btn::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -120%;
  width: 60%;
  height: 200%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.28) 50%,
    transparent 100%
  );
  transform: rotate(25deg);
  pointer-events: none;
  animation: btn-shine-sweep 3.6s ease-in-out infinite;
}

@keyframes btn-shine-sweep {
  0%,
  60% {
    left: -120%;
  }
  100% {
    left: 220%;
  }
}

.settings-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: var(--space-2) 0 0;
  line-height: var(--line-height-snug);
}

.settings-link {
  color: var(--color-primary);
  text-decoration: underline;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  display: inline;
  border-radius: var(--radius-xs);
}

.settings-link:hover {
  filter: brightness(1.2);
}

.settings-link:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

@media (prefers-reduced-motion: reduce) {
  .glow-backdrop,
  .shimmer-ring,
  .stage-sparkle,
  .update-pill-badge::after,
  .update-btn::after {
    animation: none !important;
  }
}
</style>
