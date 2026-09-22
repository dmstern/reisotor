<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  checked: number;
  total: number;
}>();

const percent = computed(() => {
  if (props.total <= 0) return 0;
  return Math.round((props.checked / props.total) * 100);
});
</script>

<template>
  <div class="shopping-preview-stage" aria-hidden="true">
    <!-- Papiertüte (Kraft Paper Shopping Bag) -->
    <div class="paper-bag">
      <!-- Kordelgriffe der Papiertüte -->
      <div class="bag-handles">
        <svg viewBox="0 0 40 18" class="bag-handle-svg" fill="none">
          <path
            d="M 6 18 C 6 2, 34 2, 34 18"
            stroke="#92400e"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <!-- Kassenzettel (Receipt), der aus der Papiertüte ragt -->
      <div class="receipt">
        <!-- Gezackte Abreißkante oben -->
        <div class="receipt-zigzag" />

        <!-- Kassenbon-Kopfzeile -->
        <div class="receipt-header">
          <span class="receipt-logo">REISOTOR MARKT</span>
          <span class="receipt-divider">· · · · · · · · · · ·</span>
        </div>

        <!-- Posten mit Checkmarks -->
        <div class="receipt-items">
          <div class="receipt-row" :class="{ 'is-checked': checked >= 1 }">
            <span class="receipt-check">{{ checked >= 1 ? '✓' : '□' }}</span>
            <span class="receipt-line" />
          </div>
          <div class="receipt-row" :class="{ 'is-checked': checked >= 2 }">
            <span class="receipt-check">{{ checked >= 2 ? '✓' : '□' }}</span>
            <span class="receipt-line short" />
          </div>
          <div class="receipt-row" :class="{ 'is-checked': checked >= 3 && total >= 3 }">
            <span class="receipt-check">{{ checked >= 3 && total >= 3 ? '✓' : '□' }}</span>
            <span class="receipt-line medium" />
          </div>
        </div>

        <!-- Summe / Stempel -->
        <div class="receipt-footer">
          <span class="receipt-total">{{ percent }}% ERLEDIGT</span>
        </div>
      </div>

      <!-- Vordere Wand der Papiertüte mit Falzlinien -->
      <div class="bag-front">
        <!-- Seitliche Knickfalten -->
        <div class="bag-crease crease-left" />
        <div class="bag-crease crease-right" />
        <!-- Dekoratives Icon / Label -->
        <div class="bag-badge">
          <span class="bag-badge-icon">🛒</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shopping-preview-stage {
  position: relative;
  width: 90px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.paper-bag {
  position: relative;
  width: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Griffe */
.bag-handles {
  position: relative;
  width: 38px;
  height: 14px;
  margin-bottom: -4px;
  z-index: 1;
}

.bag-handle-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

/* Kassenzettel */
.receipt {
  position: absolute;
  top: 2px;
  width: 44px;
  height: 52px;
  background: #ffffff;
  border-radius: 2px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.15),
    0 1px 2px rgba(0, 0, 0, 0.08);
  padding: 4px 3px 2px 3px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  z-index: 2;
  transform: rotate(-3deg);
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}

:root[data-theme='dark'] .receipt {
  background: #f8fafc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .receipt {
    background: #f8fafc;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

/* Gezackter Rand oben */
.receipt-zigzag {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 4px;
  background: radial-gradient(circle at 3px 0, transparent 3px, #ffffff 3.5px) repeat-x;
  background-size: 6px 4px;
}

:root[data-theme='dark'] .receipt-zigzag {
  background: radial-gradient(circle at 3px 0, transparent 3px, #f8fafc 3.5px) repeat-x;
  background-size: 6px 4px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .receipt-zigzag {
    background: radial-gradient(circle at 3px 0, transparent 3px, #f8fafc 3.5px) repeat-x;
    background-size: 6px 4px;
  }
}

.receipt-header {
  text-align: center;
  margin-top: 2px;
}

.receipt-logo {
  font-size: 0.36rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: #334155;
  display: block;
}

.receipt-divider {
  font-size: 0.32rem;
  color: #94a3b8;
  display: block;
  line-height: 1;
}

.receipt-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 3px;
}

.receipt-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.receipt-check {
  font-size: 0.42rem;
  color: #94a3b8;
  line-height: 1;
  width: 6px;
}

.receipt-row.is-checked .receipt-check {
  color: #10b981;
  font-weight: 800;
}

.receipt-line {
  height: 1.5px;
  background: #cbd5e1;
  border-radius: 1px;
  flex: 1;
}

.receipt-row.is-checked .receipt-line {
  background: #94a3b8;
  opacity: 0.6;
}

.receipt-line.short {
  width: 70%;
  flex: none;
}

.receipt-line.medium {
  width: 85%;
  flex: none;
}

.receipt-footer {
  margin-top: auto;
  border-top: 1px dashed #cbd5e1;
  padding-top: 2px;
  text-align: center;
}

.receipt-total {
  font-size: 0.34rem;
  font-weight: 800;
  color: #065f46;
}

/* Papiertüten-Körper */
.bag-front {
  position: relative;
  width: 62px;
  height: 48px;
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  border-radius: 4px;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.18),
    0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

:root[data-theme='dark'] .bag-front {
  background: linear-gradient(135deg, #b45309 0%, #78350f 100%);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .bag-front {
    background: linear-gradient(135deg, #b45309 0%, #78350f 100%);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
  }
}

.bag-crease {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(0, 0, 0, 0.12);
}

.crease-left {
  left: 10px;
}
.crease-right {
  right: 10px;
}

.bag-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bag-badge-icon {
  font-size: 0.7rem;
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .receipt,
.shopping-preview-stage:hover .receipt {
  transform: rotate(-1deg) translateY(-5px);
}

:deep(.tile:hover) .paper-bag,
.shopping-preview-stage:hover .paper-bag {
  transform: translateY(-2px);
}
</style>
