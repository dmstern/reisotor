<script setup lang="ts">
import Card from '../primitives/Card.vue';
import Select from '../primitives/Select.vue';
import CheckboxCard from '../primitives/CheckboxCard.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import {
  useCalendarSettingsStore,
  WEEK_START_OPTIONS,
  DATE_FORMAT_OPTIONS,
} from '../../stores/calendarSettings';
import { useUiSettingsStore } from '../../stores/uiSettings';
import { useHomeCurrencyStore, HOME_CURRENCY_OPTIONS } from '../../stores/homeCurrency';
import { useAppSettingsReset } from '../../composables/useAppSettingsReset';
import { IconCloud } from '@tabler/icons-vue';
import type { IconDef } from '../../utils/icon';
import { SECTION_ICON_DEFS } from '../../utils/sectionIcons';
import { ACTION_ICONS } from '../../utils/actionIcons';

const WEATHER_SECTION_ICON: IconDef = { id: 'cloud', emoji: '🌤️', outline: IconCloud };

const calendarSettings = useCalendarSettingsStore();
const uiSettings = useUiSettingsStore();
const homeCurrency = useHomeCurrencyStore();

const {
  isCalendarDefault,
  resetCalendar,
  isWeatherDefault,
  resetWeather,
  isHomeCurrencyDefault,
  resetHomeCurrency,
} = useAppSettingsReset();
</script>

<template>
  <div class="grid settings-grid">
    <Card id="calendar-settings">
      <SettingsCardHeader
        title="Kalender"
        :icon="SECTION_ICON_DEFS.calendar"
        show-reset
        :is-default="isCalendarDefault"
        :reset-title="
          isCalendarDefault
            ? 'Bereits auf Standard-Kalender-Einstellungen'
            : 'Auf Standard zurücksetzen'
        "
        @reset="resetCalendar"
      />
      <p class="hint intro-hint">
        Wochenanfang und Zahlenformat für Datumsanzeigen in der ganzen App.
      </p>
      <div class="nav-position-row">
        <label for="calendar-week-start-select">
          Wochenanfang
          <Select id="calendar-week-start-select" v-model="calendarSettings.weekStart">
            <option v-for="option in WEEK_START_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </label>
        <label for="calendar-date-format-select">
          Datumsformat
          <Select id="calendar-date-format-select" v-model="calendarSettings.dateFormat">
            <option v-for="option in DATE_FORMAT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </label>
      </div>
    </Card>

    <!-- id als Sprungziel für den "Anbieter wechseln"-Link im Wetter-Widget (DashboardView.vue) -->
    <Card id="weather-provider-settings">
      <SettingsCardHeader
        title="Wetter"
        :icon="WEATHER_SECTION_ICON"
        show-reset
        :is-default="isWeatherDefault"
        :reset-title="
          isWeatherDefault
            ? 'Bereits auf Standard-Wetter-Einstellungen'
            : 'Auf Standard zurücksetzen'
        "
        @reset="resetWeather"
      />
      <p class="hint intro-hint">
        Passe an, ob das Wetter an deinem Heimatort im Dashboard eingeblendet werden soll. Das
        bevorzugte Wettermodell für das Reiseziel (z. B. ECMWF, ICON oder JMA) wird direkt in den
        Einstellungen des jeweiligen Urlaubs festgelegt.
      </p>
      <CheckboxCard
        id="settings-home-weather-full-trip-toggle"
        v-model="uiSettings.showHomeWeatherFullTrip"
        label="Wetter zuhause für den ganzen Urlaub zeigen"
        description="Blendet die Heimtwetter-Kachel permanent während des gesamten Urlaubs ein (statt erst gegen Ende der Reise)."
      />
    </Card>

    <!-- id als Sprungziel, analog zu #weather-provider-settings oben -->
    <Card id="home-currency-settings">
      <SettingsCardHeader
        title="Heimatwährung"
        :icon="ACTION_ICONS.currency"
        show-reset
        :is-default="isHomeCurrencyDefault"
        :reset-title="
          isHomeCurrencyDefault ? 'Bereits auf Standard-Währung' : 'Auf Standard zurücksetzen'
        "
        @reset="resetHomeCurrency"
      />
      <p class="hint intro-hint">
        Wird im Dashboard genutzt, um bei Urlauben mit abweichender Landeswährung den aktuellen
        Wechselkurs anzuzeigen.
      </p>
      <label for="settings-home-currency-select" class="weather-provider-label">
        Heimatwährung
        <Select id="settings-home-currency-select" v-model="homeCurrency.currency">
          <option v-for="option in HOME_CURRENCY_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </Select>
      </label>
    </Card>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  margin-bottom: var(--space-4);
}

.settings-grid > :deep(.card) {
  margin-bottom: 0;
}

.nav-position-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.nav-position-row label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
  flex: 1 1 180px;
  min-width: 0;
}

.weather-provider-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
  width: 100%;
  max-width: 320px;
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.hint.intro-hint {
  margin-bottom: var(--space-3);
}
</style>
