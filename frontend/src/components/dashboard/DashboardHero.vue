<script setup lang="ts">
import { computed } from 'vue';
import type { Trip } from '../../api/types';
import type { DepartureCountdown, VacationPhase } from '../../utils/departureCountdown';
import { formatTripDateRange } from '../../utils/dateFormat';
import { ACTION_ICONS } from '../../utils/actionIcons';
import AppIcon from '../AppIcon.vue';
import Button from '../primitives/Button.vue';

const props = defineProps<{
  trip?: Trip | null;
  departureCountdown?: DepartureCountdown | null;
  vacationPhase?: VacationPhase | null;
  isTripOver?: boolean;
  showVacationCountdown?: boolean;
}>();

defineEmits<{
  (e: 'edit'): void;
}>();

const heroStyle = computed(() => {
  if (!props.trip?.image_url) return {};
  return {
    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,.35), rgba(0,0,0,.15)), url(${props.trip.image_url})`,
  };
});
</script>

<template>
  <header class="hero card" :style="heroStyle" :class="{ 'has-image': trip?.image_url }">
    <div class="hero-header">
      <h1>{{ trip?.name || 'Euer Urlaub' }}</h1>
      <div class="banner-actions">
        <Button
          variant="secondary"
          class="banner-action-btn"
          title="Urlaub bearbeiten"
          aria-label="Urlaub bearbeiten"
          @click="$emit('edit')"
        >
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span class="banner-action-label">Bearbeiten</span>
        </Button>
      </div>
    </div>
    <p v-if="trip?.destination">
      <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" />
      {{ trip.destination }}
    </p>
    <p v-if="trip">{{ formatTripDateRange(trip.start_date, trip.end_date) }}</p>
    <p v-if="departureCountdown?.phase === 'days'" class="countdown">
      Noch
      <span class="nobr"
        >{{ departureCountdown.days }}&nbsp;{{
          departureCountdown.days === 1 ? 'Tag' : 'Tage'
        }}</span
      >
      bis zur Abreise 🎒
    </p>
    <p v-else-if="departureCountdown?.phase === 'hours'" class="countdown">
      Noch
      <span class="nobr"
        >{{ departureCountdown.hours }}&nbsp;{{
          departureCountdown.hours === 1 ? 'Stunde' : 'Stunden'
        }}</span
      >
      bis zur Abreise 🎒
    </p>
    <p v-else-if="vacationPhase?.phase === 'arrived'" class="countdown">
      Der Urlaub hat begonnen! 🌴
    </p>
    <p v-else-if="vacationPhase?.phase === 'ongoing' && showVacationCountdown" class="countdown">
      Noch
      <span class="nobr"
        >{{ vacationPhase.daysLeft }}&nbsp;{{ vacationPhase.daysLeft === 1 ? 'Tag' : 'Tage' }}</span
      >
      Urlaub 🏖️
    </p>
    <p v-else-if="vacationPhase?.phase === 'ongoing'" class="countdown">Genießt euren Urlaub! 🏖️</p>
    <p v-else-if="vacationPhase?.phase === 'lastDay'" class="countdown">Letzter Urlaubstag 🌅</p>
    <p v-else-if="isTripOver" class="countdown">Der Urlaub ist vorbei 👋</p>
  </header>
</template>

<style scoped>
.hero {
  position: relative;
  margin-bottom: var(--space-4);
  background: linear-gradient(135deg, var(--color-primary-tint), var(--color-surface));
  background-size: cover;
  background-position: center;
}

.hero.has-image {
  color: #fff;
}

.hero.has-image h1,
.hero.has-image p,
.hero.has-image .countdown {
  /* Die globale p { color: var(--color-text-muted) }-Regel (style.css) setzt die Farbe direkt auf
     jedes <p> selbst – ein per Vererbung von .hero.has-image kommendes color:#fff greift dadurch
     NICHT (eine eigene Deklaration am Element schlägt Vererbung immer, unabhängig von der
     Spezifität des Vorfahren). Ort- und Datumszeile (reine <p> ohne eigene Klasse) waren deshalb
     bei hinterlegtem Bild weiterhin kontrastarm grau statt weiß. */
  color: #fff;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.hero-header h1 {
  margin: 0;
  min-width: 0;
  flex: 1 1 auto;
  overflow-wrap: break-word;
  word-break: break-word;
  color: var(--color-primary-dark);
}

.banner-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
  align-items: flex-start;
}

.banner-action-btn {
  position: relative;
  font-size: 0.8rem;
  padding: 4px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: none;
  flex-shrink: 0;
}

.banner-action-label {
  display: inline;
}

@container app-main (max-width: 768px) {
  .banner-action-label {
    display: none;
  }

  .banner-action-btn {
    padding: 6px;
    min-width: 32px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .banner-action-btn::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
}

@media (max-width: 768px) {
  .banner-action-label {
    display: none;
  }

  .banner-action-btn {
    padding: 6px;
    min-width: 32px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .banner-action-btn::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
}

.banner-action-btn:hover {
  box-shadow: var(--shadow-sm);
}

/* .secondary ist transparent mit --color-primary-Schrift – über einem Foto (statt dem sonst
   einfarbigen Verlaufs-Hintergrund) oft zu wenig Kontrast, je nach Bildmotiv. Bei hinterlegtem
   Bild deshalb ein fester halbtransparenter dunkler Chip mit weißer Schrift, unabhängig vom
   jeweiligen Bildmotiv immer gut lesbar (gleiches Muster wie die schwebenden Bearbeiten-/
   Löschen-Buttons auf Karten-Vorschaubildern). */
.hero.has-image .banner-action-btn {
  background: rgba(20, 20, 18, 0.55);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: none;
}

.hero.has-image .banner-action-btn:hover {
  background: rgba(20, 20, 18, 0.75);
  box-shadow: var(--shadow-sm);
}

.countdown {
  color: var(--color-accent);
  font-weight: 600;
}
</style>
