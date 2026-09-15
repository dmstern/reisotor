<script setup lang="ts">
defineProps<{
  spent: number;
  target: number;
}>();
</script>

<template>
  <div class="wallet-preview-stage" aria-hidden="true">
    <!-- Reise-Portemonnaie (Leather Travel Wallet) -->
    <div class="wallet">
      <!-- Geldscheine & Münzen, die oben herausragen -->
      <div class="wallet-cash">
        <!-- Blauer/türkiser Geldschein -->
        <div class="bill bill-cyan">
          <span class="bill-num">20</span>
        </div>
        <!-- Grüner Geldschein -->
        <div class="bill bill-green">
          <span class="bill-num">100</span>
        </div>
        <!-- Goldmünze -->
        <div class="coin">
          <span class="coin-symbol">€</span>
        </div>
      </div>

      <!-- Leder-Geldbörse / Kartenetui -->
      <div class="wallet-body">
        <!-- Ziernaht (Stitching) -->
        <div class="stitch-line stitch-top" />
        <div class="stitch-line stitch-bottom" />

        <!-- Einsteck-Karte (Credit/Travel Card) im vorderen Fach -->
        <div class="credit-card">
          <!-- Goldener EMV-Chip -->
          <div class="chip">
            <span class="chip-grid" />
          </div>
          <!-- Kontaktlos-Symbol -->
          <div class="contactless">
            <span class="wave wave-1" />
            <span class="wave wave-2" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-preview-stage {
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

.wallet {
  position: relative;
  width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Geldscheine */
.wallet-cash {
  position: relative;
  width: 56px;
  height: 20px;
  margin-bottom: -6px;
  z-index: 1;
}

.bill {
  position: absolute;
  bottom: 0;
  width: 44px;
  height: 18px;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: flex-start;
  padding: 1px 3px;
  box-sizing: border-box;
  transition: transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.bill-cyan {
  background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
  border: 1px solid #0369a1;
  left: 2px;
  transform: rotate(-7deg);
}

.bill-green {
  background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%);
  border: 1px solid #15803d;
  right: 2px;
  transform: rotate(5deg);
}

.bill-num {
  font-size: 0.38rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.5px;
}

/* Münze */
.coin {
  position: absolute;
  top: 2px;
  right: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fef08a 0%, #eab308 100%);
  border: 1px solid #ca8a04;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.coin-symbol {
  font-size: 0.44rem;
  font-weight: 800;
  color: #854d0e;
  line-height: 1;
}

/* Geldbörsen-Körper */
.wallet-body {
  position: relative;
  width: 68px;
  height: 48px;
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.25),
    0 1px 3px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  padding: 6px 4px 4px 4px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

:root[data-theme='dark'] .wallet-body {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.5);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .wallet-body {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.5);
  }
}

/* Ziernähte */
.stitch-line {
  position: absolute;
  left: 4px;
  right: 4px;
  height: 1px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.25);
}

.stitch-top {
  top: 3px;
}
.stitch-bottom {
  bottom: 3px;
}

/* Kreditkarte im vorderen Schlitz */
.credit-card {
  position: relative;
  width: 100%;
  height: 32px;
  background: linear-gradient(135deg, #818cf8 0%, #4f46e5 100%);
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  padding: 4px 5px;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.chip {
  width: 8px;
  height: 6px;
  background: linear-gradient(135deg, #fef08a 0%, #ca8a04 100%);
  border-radius: 1px;
  border: 0.5px solid #a16207;
}

.contactless {
  display: flex;
  gap: 1px;
}

.wave {
  width: 1px;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 1px;
}

.wave-1 {
  height: 4px;
}
.wave-2 {
  height: 6px;
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .bill-cyan,
.wallet-preview-stage:hover .bill-cyan {
  transform: rotate(-12deg) translateY(-4px);
}

:deep(.tile:hover) .bill-green,
.wallet-preview-stage:hover .bill-green {
  transform: rotate(10deg) translateY(-4px);
}

:deep(.tile:hover) .credit-card,
.wallet-preview-stage:hover .credit-card {
  transform: translateY(-2px);
}
</style>
