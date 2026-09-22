<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  packed: number;
  total: number;
}>();

const percent = computed(() => {
  if (props.total <= 0) return 0;
  return Math.min(100, Math.round((props.packed / props.total) * 100));
});

// Füllstufen:
// 0: Leer (nur Kreuzgurte)
// 1: 1-30% (untere Schicht: gerollte Hosen & Socken)
// 2: 31-65% (mittlere Schicht: Packwürfel & T-Shirts)
// 3: 66-99% (fast voll: Hemden, Kulturbeutel)
// 4: 100% (komplett gepackt, grüner Gepäckanhänger "Ready!")
const fillTier = computed(() => {
  if (percent.value === 0) return 0;
  if (percent.value <= 30) return 1;
  if (percent.value <= 65) return 2;
  if (percent.value < 100) return 3;
  return 4;
});
</script>

<template>
  <div class="suitcase-preview-stage" aria-hidden="true" :class="`tier-${fillTier}`">
    <div class="suitcase">
      <!-- Ausziehbare Teleskop-Trolley-Stange -->
      <div class="telescope-handle">
        <div class="handle-bar" />
        <div class="handle-rod rod-left" />
        <div class="handle-rod rod-right" />
      </div>

      <!-- Koffer-Hauptkörper (Polycarbonat-Hartschale) -->
      <div class="suitcase-body">
        <!-- Eckenschützer (Corner Protectors) -->
        <div class="corner corner-tl" />
        <div class="corner corner-tr" />
        <div class="corner corner-bl" />
        <div class="corner corner-br" />

        <!-- Innenraum mit gepackten Kleidungsschichten / Packwürfeln -->
        <div class="suitcase-interior">
          <!-- Leerer Koffer: Innenfutter mit X-Spanngurten -->
          <template v-if="fillTier === 0">
            <div class="interior-straps">
              <span class="strap strap-1" />
              <span class="strap strap-2" />
              <div class="strap-buckle" />
            </div>
          </template>

          <!-- Gepackte Schichten -->
          <template v-else>
            <!-- Schicht 3: Oben (nur ab Tier 3) -->
            <div v-if="fillTier >= 3" class="packed-layer layer-top">
              <div class="cube cube-sunhat" title="Urlaubskleidung" />
              <div class="cube cube-yellow" title="T-Shirt" />
            </div>

            <!-- Schicht 2: Mitte (ab Tier 2) -->
            <div v-if="fillTier >= 2" class="packed-layer layer-mid">
              <div class="cube cube-lavender" title="Kulturbeutel" />
              <div class="cube cube-emerald" title="Hemden" />
            </div>

            <!-- Schicht 1: Unten (ab Tier 1) -->
            <div class="packed-layer layer-bottom">
              <div class="cube cube-denim" title="Jeans" />
              <div class="cube cube-coral" title="Socken" />
              <div class="cube cube-teal" title="Shorts" />
            </div>
          </template>

          <!-- Transparente, matte Polycarbonat-Frontscheibe mit Reflexion -->
          <div class="frosted-glass-cover">
            <!-- Horizontale Rippen / Lamellen für Kofferstruktur -->
            <div class="rib-grooves">
              <span class="rib" />
              <span class="rib" />
              <span class="rib" />
              <span class="rib" />
            </div>
            <!-- Diagonale Lichtreflexion -->
            <div class="glass-glare" />
          </div>
        </div>

        <!-- Gepäckanhänger (Luggage Tag) bei 100% fertig -->
        <div v-if="fillTier === 4" class="luggage-tag">
          <span class="tag-loop" />
          <span class="tag-card">READY</span>
        </div>
      </div>

      <!-- 4 Spinner-Rollen an der Unterseite -->
      <div class="suitcase-wheels">
        <div class="wheel wheel-left" />
        <div class="wheel wheel-right" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.suitcase-preview-stage {
  position: relative;
  width: 96px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.suitcase {
  position: relative;
  width: 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}

/* Teleskopgriff */
.telescope-handle {
  position: relative;
  width: 26px;
  height: 12px;
  display: flex;
  justify-content: space-between;
  margin-bottom: -1px;
  z-index: 1;
}

.handle-bar {
  position: absolute;
  top: 0;
  left: 2px;
  right: 2px;
  height: 4px;
  background: #1e293b;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

:root[data-theme='dark'] .handle-bar {
  background: #e2e8f0;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .handle-bar {
    background: #e2e8f0;
  }
}

.handle-rod {
  width: 3px;
  height: 10px;
  background: linear-gradient(90deg, #94a3b8 0%, #cbd5e1 50%, #64748b 100%);
  margin-top: 2px;
}

.rod-left {
  margin-left: 4px;
}

.rod-right {
  margin-right: 4px;
}

/* Koffer-Körper */
.suitcase-body {
  position: relative;
  width: 58px;
  height: 60px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(241, 245, 249, 0.95) 100%);
  border-radius: 8px;
  border: 1.5px solid #94a3b8;
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  z-index: 2;
  box-sizing: border-box;
}

:root[data-theme='dark'] .suitcase-body {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
  border-color: #475569;
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.45),
    0 2px 4px rgba(0, 0, 0, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .suitcase-body {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
    border-color: #475569;
    box-shadow:
      0 8px 18px rgba(0, 0, 0, 0.45),
      0 2px 4px rgba(0, 0, 0, 0.2);
  }
}

/* Eckenschützer */
.corner {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #475569;
  z-index: 5;
}

:root[data-theme='dark'] .corner {
  background: #64748b;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .corner {
    background: #64748b;
  }
}

.corner-tl {
  top: 0;
  left: 0;
  border-bottom-right-radius: 4px;
}
.corner-tr {
  top: 0;
  right: 0;
  border-bottom-left-radius: 4px;
}
.corner-bl {
  bottom: 0;
  left: 0;
  border-top-right-radius: 4px;
}
.corner-br {
  bottom: 0;
  right: 0;
  border-top-left-radius: 4px;
}

/* Innenraum */
.suitcase-interior {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 4px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/* Kreuzgurte im leeren Zustand */
.interior-straps {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.strap {
  position: absolute;
  background: rgba(148, 163, 184, 0.4);
  border-radius: 1px;
}

.strap-1 {
  width: 100%;
  height: 2px;
  transform: rotate(38deg);
}

.strap-2 {
  width: 100%;
  height: 2px;
  transform: rotate(-38deg);
}

.strap-buckle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #cbd5e1;
  border: 1px solid #94a3b8;
  z-index: 2;
}

/* Schichten der gepackten Kleidung */
.packed-layer {
  display: flex;
  gap: 2px;
  width: 100%;
  margin-top: 2px;
  position: relative;
  z-index: 1;
}

.cube {
  border-radius: 3px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4);
}

.cube-denim {
  flex: 3;
  height: 12px;
  background: #3b82f6;
}

.cube-coral {
  flex: 2;
  height: 12px;
  background: #f43f5e;
}

.cube-teal {
  flex: 2;
  height: 12px;
  background: #06b6d4;
}

.cube-lavender {
  flex: 4;
  height: 11px;
  background: #8b5cf6;
}

.cube-emerald {
  flex: 3;
  height: 11px;
  background: #10b981;
}

.cube-sunhat {
  flex: 3;
  height: 10px;
  background: #f97316;
}

.cube-yellow {
  flex: 3;
  height: 10px;
  background: #eab308;
}

/* Mattes Polycarbonat-Cover */
.frosted-glass-cover {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(1.5px);
  z-index: 3;
  pointer-events: none;
}

:root[data-theme='dark'] .frosted-glass-cover {
  background: rgba(15, 23, 42, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .frosted-glass-cover {
    background: rgba(15, 23, 42, 0.25);
  }
}

.rib-grooves {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 6px 0;
}

.rib {
  height: 1.5px;
  background: rgba(255, 255, 255, 0.45);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.08);
}

:root[data-theme='dark'] .rib {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .rib {
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
  }
}

/* Diagonale Glanzkante */
.glass-glare {
  position: absolute;
  top: -20px;
  left: -20px;
  width: 100px;
  height: 30px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.35) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: rotate(35deg);
}

/* Kofferanhänger (Luggage Tag) */
.luggage-tag {
  position: absolute;
  top: 8px;
  right: -8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: rotate(18deg);
  z-index: 6;
}

.tag-loop {
  width: 2px;
  height: 6px;
  background: #10b981;
}

.tag-card {
  background: #10b981;
  color: #ffffff;
  font-size: 0.38rem;
  font-weight: 800;
  padding: 1px 3px;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  letter-spacing: 0.5px;
}

/* Koffer-Rollen */
.suitcase-wheels {
  display: flex;
  justify-content: space-between;
  width: 44px;
  margin-top: -1px;
}

.wheel {
  width: 6px;
  height: 6px;
  background: #1e293b;
  border-radius: 50%;
  border: 1px solid #64748b;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

:root[data-theme='dark'] .wheel {
  background: #0f172a;
  border-color: #475569;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .wheel {
    background: #0f172a;
    border-color: #475569;
  }
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .suitcase,
.suitcase-preview-stage:hover .suitcase {
  transform: translateY(-3px) rotate(3deg);
}

:deep(.tile:hover) .telescope-handle,
.suitcase-preview-stage:hover .telescope-handle {
  transform: translateY(-3px);
}
</style>
