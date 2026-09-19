<script setup lang="ts">
import { computed } from 'vue';
import type { TravelItem } from '../../api/types';

const props = defineProps<{
  nextItem?: TravelItem | null;
  count: number;
}>();

const transportEmoji = computed(() => {
  const type = props.nextItem?.type?.toLowerCase() || '';
  if (type.includes('flug') || type.includes('flight') || type.includes('plane')) return '✈️';
  if (type.includes('zug') || type.includes('bahn') || type.includes('train')) return '🚆';
  if (type.includes('auto') || type.includes('car') || type.includes('bus')) return '🚗';
  if (type.includes('fähr') || type.includes('schiff') || type.includes('boat')) return '🚢';
  return '🎫';
});

const origin = computed(() => {
  if (props.nextItem?.from_location) return props.nextItem.from_location.slice(0, 10);
  return 'Start';
});

const destination = computed(() => {
  if (props.nextItem?.to_location) return props.nextItem.to_location.slice(0, 10);
  if (props.nextItem?.title) return props.nextItem.title.slice(0, 10);
  return 'Ziel';
});

const timeStr = computed(() => {
  if (props.nextItem?.departure_time) return props.nextItem.departure_time;
  return '08:00';
});
</script>

<template>
  <div class="travel-preview-stage" aria-hidden="true">
    <!-- Boarding Pass / Ticket -->
    <div class="ticket">
      <!-- Haupt-Ticketbereich links -->
      <div class="ticket-main">
        <!-- Obere Kopfzeile mit Icon & Airline/Bahn-Code -->
        <div class="ticket-header">
          <span class="ticket-icon">{{ transportEmoji }}</span>
          <span class="ticket-code">BOARDING PASS</span>
        </div>

        <!-- Strecke: Von ➔ Nach -->
        <div class="ticket-route">
          <span class="route-point">{{ origin }}</span>
          <span class="route-arrow">➔</span>
          <span class="route-point bold">{{ destination }}</span>
        </div>

        <!-- Zeit & Status -->
        <div class="ticket-time">
          <span class="time-badge">{{ timeStr }}</span>
          <span class="seat-badge">GATE 1</span>
        </div>
      </div>

      <!-- Einkerbungen oben & unten (Notches) -->
      <div class="notch notch-top" />
      <div class="notch notch-bottom" />

      <!-- Perforationslinie -->
      <div class="perforation" />

      <!-- Abreiß-Abschnitt (Stub) rechts -->
      <div class="ticket-stub">
        <span class="stub-tag">PASS</span>
        <!-- Mini-Barcode -->
        <div class="barcode">
          <span class="bar bar-1" />
          <span class="bar bar-2" />
          <span class="bar bar-1" />
          <span class="bar bar-3" />
          <span class="bar bar-2" />
          <span class="bar bar-1" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.travel-preview-stage {
  position: relative;
  width: 120px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.ticket {
  position: relative;
  width: 114px;
  height: 60px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow:
    0 5px 14px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  transform: rotate(-1.5deg);
  transition:
    transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.22s ease;
  overflow: visible;
}

:root[data-theme='dark'] .ticket {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .ticket {
    background: #1e293b;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

.ticket-main {
  flex: 1;
  padding: 5px 6px 4px 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ticket-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ticket-icon {
  font-size: 0.65rem;
  line-height: 1;
}

.ticket-code {
  font-size: 0.38rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #1d4ed8;
}

:root[data-theme='dark'] .ticket-code {
  color: #60a5fa;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .ticket-code {
    color: #60a5fa;
  }
}

.ticket-route {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 2px 0;
}

.route-point {
  font-size: 0.48rem;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 32px;
}

:root[data-theme='dark'] .route-point {
  color: #cbd5e1;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .route-point {
    color: #cbd5e1;
  }
}

.route-point.bold {
  font-weight: 800;
  color: #0f172a;
}

:root[data-theme='dark'] .route-point.bold {
  color: #f8fafc;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .route-point.bold {
    color: #f8fafc;
  }
}

.route-arrow {
  font-size: 0.44rem;
  color: #64748b;
}

:root[data-theme='dark'] .route-arrow {
  color: #94a3b8;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .route-arrow {
    color: #94a3b8;
  }
}

.ticket-time {
  display: flex;
  gap: 4px;
}

.time-badge,
.seat-badge {
  font-size: 0.38rem;
  background: #f1f5f9;
  color: #475569;
  padding: 1px 3px;
  border-radius: 2px;
  font-weight: 700;
}

:root[data-theme='dark'] .time-badge,
:root[data-theme='dark'] .seat-badge {
  background: #334155;
  color: #e2e8f0;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .time-badge,
  :root:not([data-theme='light']) .seat-badge {
    background: #334155;
    color: #e2e8f0;
  }
}

/* Perforation */
.perforation {
  width: 1px;
  border-left: 1px dashed rgba(148, 163, 184, 0.45);
  margin: 6px 0;
}

/* Halbkreisförmige Einkerbungen oben und unten */
.notch {
  position: absolute;
  left: 82px;
  width: 8px;
  height: 8px;
  background: var(--color-surface, #ffffff);
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 2;
}

.notch-top {
  top: -5px;
}
.notch-bottom {
  bottom: -5px;
}

/* Abriss-Abschnitt */
.ticket-stub {
  width: 30px;
  padding: 5px 4px 4px 4px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  transform-origin: left center;
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.stub-tag {
  font-size: 0.36rem;
  font-weight: 800;
  color: #475569;
}

:root[data-theme='dark'] .stub-tag {
  color: #94a3b8;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .stub-tag {
    color: #94a3b8;
  }
}

.barcode {
  display: flex;
  align-items: center;
  gap: 1.5px;
  height: 18px;
}

.bar {
  background: #334155;
  height: 100%;
}

:root[data-theme='dark'] .bar {
  background: #cbd5e1;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .bar {
    background: #cbd5e1;
  }
}

.bar-1 {
  width: 1px;
}
.bar-2 {
  width: 2px;
}
.bar-3 {
  width: 3px;
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .ticket,
.travel-preview-stage:hover .ticket {
  transform: rotate(0deg) translateY(-3px) scale(1.03);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.22),
    0 2px 4px rgba(0, 0, 0, 0.1);
}

:deep(.tile:hover) .ticket-stub,
.travel-preview-stage:hover .ticket-stub {
  transform: rotateY(-18deg);
}
</style>
