<script setup lang="ts">
import ReisotorRobot from '../ReisotorRobot.vue';

defineProps<{
  destination?: string | null;
}>();
</script>

<template>
  <div class="security-preview-stage" aria-hidden="true">
    <!-- Holografische Radar-Plattform -->
    <div class="radar-dish">
      <!-- Konzentrische Radarringe & Fadenkreuz -->
      <div class="radar-rings">
        <span class="ring ring-outer" />
        <span class="ring ring-mid" />
        <span class="ring ring-inner" />
        <span class="crosshair crosshair-h" />
        <span class="crosshair crosshair-v" />
      </div>

      <!-- Rotierender Radar-Scanner-Strahl -->
      <div class="radar-sweep" />

      <!-- Reisotor Roboter schwebt über dem Scanner -->
      <div class="robot-wrap">
        <ReisotorRobot size="54px" phase="scanning" />
      </div>

      <!-- Status-Badge -->
      <div class="status-pill">
        <span class="status-dot" />
        <span class="status-label">BEREIT</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.security-preview-stage {
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

.radar-dish {
  position: relative;
  width: 78px;
  height: 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Konzentrische Radar-Ringe */
.radar-rings {
  position: absolute;
  bottom: 4px;
  width: 66px;
  height: 32px;
  border-radius: 50%;
  transform: rotateX(60deg);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(234, 88, 12, 0.4);
}

.ring-outer {
  width: 66px;
  height: 66px;
  box-shadow: 0 0 8px rgba(234, 88, 12, 0.2);
}

.ring-mid {
  width: 44px;
  height: 44px;
}

.ring-inner {
  width: 22px;
  height: 22px;
  background: rgba(234, 88, 12, 0.15);
}

.crosshair {
  position: absolute;
  background: rgba(234, 88, 12, 0.3);
}

.crosshair-h {
  width: 66px;
  height: 1px;
}

.crosshair-v {
  width: 1px;
  height: 66px;
}

/* Radar-Sweep */
.radar-sweep {
  position: absolute;
  bottom: 4px;
  width: 66px;
  height: 32px;
  border-radius: 50%;
  transform: rotateX(60deg);
  background: conic-gradient(
    from 0deg,
    rgba(234, 88, 12, 0) 0deg,
    rgba(234, 88, 12, 0.4) 60deg,
    rgba(234, 88, 12, 0) 65deg
  );
  animation: radar-spin 3s linear infinite;
  pointer-events: none;
}

@keyframes radar-spin {
  from {
    transform: rotateX(60deg) rotateZ(0deg);
  }
  to {
    transform: rotateX(60deg) rotateZ(360deg);
  }
}

/* Roboter im Zentrum */
.robot-wrap {
  position: relative;
  z-index: 2;
  margin-top: -6px;
  transition: transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1);
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.2));
}

:root[data-theme='dark'] .robot-wrap {
  filter: drop-shadow(0 4px 12px rgba(234, 88, 12, 0.35));
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .robot-wrap {
    filter: drop-shadow(0 4px 12px rgba(234, 88, 12, 0.35));
  }
}

/* Status-Pill */
.status-pill {
  position: absolute;
  bottom: 2px;
  background: rgba(234, 88, 12, 0.15);
  border: 1px solid rgba(234, 88, 12, 0.4);
  padding: 1px 5px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 3px;
  z-index: 3;
}

:root[data-theme='dark'] .status-pill {
  background: rgba(234, 88, 12, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .status-pill {
    background: rgba(234, 88, 12, 0.25);
  }
}

.status-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ea580c;
  box-shadow: 0 0 4px #ea580c;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

.status-label {
  font-size: 0.34rem;
  font-weight: 800;
  color: #c2410c;
  letter-spacing: 0.5px;
}

:root[data-theme='dark'] .status-label {
  color: #fdba74;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .status-label {
    color: #fdba74;
  }
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .robot-wrap,
.security-preview-stage:hover .robot-wrap {
  transform: translateY(-3px) scale(1.06);
}
</style>
