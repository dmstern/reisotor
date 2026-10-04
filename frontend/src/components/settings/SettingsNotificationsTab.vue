<script setup lang="ts">
import { onMounted } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Checkbox from '../primitives/Checkbox.vue';
import CheckboxCard from '../primitives/CheckboxCard.vue';
import Select from '../primitives/Select.vue';
import SegmentedToggle from '../SegmentedToggle.vue';
import AppIcon from '../AppIcon.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import { usePushSettings } from '../../composables/usePushSettings';
import { useAppSettingsReset } from '../../composables/useAppSettingsReset';
import { useUiSettingsStore, TOAST_TIMEOUT_OPTIONS } from '../../stores/uiSettings';
import { BELL_ICON } from '../../composables/useSettingsTabs';
import { ACTION_ICONS } from '../../utils/actionIcons';
import {
  NOTIFICATION_DOMAIN_META,
  NOTIFICATION_DOMAINS,
} from '../../utils/notificationPreferences';

const uiSettings = useUiSettingsStore();

const {
  pushSupported,
  pushEnabled,
  pushLoading,
  pushError,
  showPushDetails,
  notificationPrefs,
  pushLevelValue,
  pushLevelOptions: PUSH_LEVEL_TOGGLE_OPTIONS,
  isPushDefault,
  selectPushLevel,
  setDomainPreference,
  resetPush,
  initPushSubscription,
} = usePushSettings();

const { isToastsDefault, resetToasts } = useAppSettingsReset();

onMounted(() => {
  if (pushSupported) {
    initPushSubscription();
  }
});
</script>

<template>
  <div class="notifications-tab">
    <Card>
      <SettingsCardHeader
        title="Meldungen"
        :icon="BELL_ICON"
        show-reset
        :is-default="isToastsDefault"
        :reset-title="
          isToastsDefault ? 'Bereits auf Standard-Meldungen' : 'Auf Standard zurücksetzen'
        "
        @reset="resetToasts"
      />
      <p class="hint intro-hint">
        Kurze Meldungen, die bei jedem Laden/Speichern/Löschen kurz unten am Bildschirmrand
        aufblitzen (z. B. "Speichert…"), damit klar wird, dass die App gerade tatsächlich mit dem
        Server arbeitet statt hängengeblieben zu sein. Wer das zu hektisch findet, kann sie hier
        ausschalten - der dauerhafte Offline-/Update-Hinweis oben im Header bleibt davon unberührt.
      </p>
      <CheckboxCard
        id="auto-id-1788301175449-31"
        v-model="uiSettings.showActivityToasts"
        label="Detaillierte Lade-/Speicher-Meldungen anzeigen"
        description="Schaltet die kurzen Toast-Meldungen am Bildschirmrand bei Lade- und Speichervorgängen ein oder aus."
      />
      <label
        for="auto-id-1788301175449-32"
        class="weather-provider-label"
        style="margin-top: var(--space-4)"
      >
        Anzeigedauer von Toast-Benachrichtigungen
        <Select id="auto-id-1788301175449-32" v-model.number="uiSettings.toastTimeout">
          <option v-for="option in TOAST_TIMEOUT_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </Select>
      </label>
      <div style="margin-top: var(--space-4)">
        <CheckboxCard
          id="show-update-dialogs"
          v-model="uiSettings.showUpdateDialogs"
          label="Popup-Dialog bei neuen Versionen & Updates anzeigen"
          description="Öffnet automatisch einen Dialog, sobald ein neues App-Update bereitsteht oder eine neue Version frisch installiert wurde."
        />
      </div>
    </Card>

    <Card>
      <SettingsCardHeader
        title="Push-Benachrichtigungen"
        :icon="BELL_ICON"
        :show-reset="pushSupported"
        :is-default="isPushDefault"
        :reset-title="
          isPushDefault ? 'Bereits auf Standard-Push-Stufe' : 'Auf Standard zurücksetzen'
        "
        @reset="resetPush"
      />
      <p class="hint" v-if="!pushSupported">
        Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
      </p>
      <template v-else>
        <p class="hint intro-hint">
          Benachrichtigt dich, wenn andere Mitglieder eines Urlaubs etwas ändern – auch wenn
          Reisotor gerade nicht offen ist. Über die Stufe lässt sich einstellen, wie viel davon
          ankommt.
        </p>
        <Button v-if="pushEnabled === null" variant="secondary" disabled> Wird geprüft… </Button>
        <Button
          v-else-if="!pushEnabled"
          variant="secondary"
          :disabled="pushLoading"
          @click="selectPushLevel('balanced')"
        >
          {{ pushLoading ? 'Wird aktiviert…' : 'Aktivieren' }}
        </Button>
        <template v-else>
          <SegmentedToggle
            :model-value="pushLevelValue"
            :options="PUSH_LEVEL_TOGGLE_OPTIONS"
            @update:model-value="selectPushLevel"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            class="push-details-toggle"
            @click="showPushDetails = !showPushDetails"
          >
            Einzeln anpassen
            <AppIcon
              :icon="ACTION_ICONS.chevronDown"
              :size="12"
              group="actions"
              class="push-details-caret"
              :class="{ open: showPushDetails }"
            />
          </Button>
          <ul v-if="showPushDetails" class="push-domain-list">
            <li v-for="domain in NOTIFICATION_DOMAINS" :key="domain" class="push-domain-row">
              <span class="nav-config-icon">{{ NOTIFICATION_DOMAIN_META[domain].icon }}</span>
              <span class="nav-config-label">{{ NOTIFICATION_DOMAIN_META[domain].label }}</span>
              <label :for="'push-domain-' + domain" class="nav-config-visible">
                <Checkbox
                  :id="'push-domain-' + domain"
                  :checked="notificationPrefs.preferences?.[domain] ?? true"
                  :aria-label="`${NOTIFICATION_DOMAIN_META[domain].label}-Push aktiv`"
                  @change="setDomainPreference(domain, ($event.target as HTMLInputElement).checked)"
                />
              </label>
            </li>
          </ul>
        </template>
        <p v-if="pushError || notificationPrefs.error" class="hint error">
          {{ pushError || notificationPrefs.error }}
        </p>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.notifications-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

.weather-provider-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
  max-width: 320px;
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
}

.hint.intro-hint {
  margin-bottom: var(--space-3);
}

.hint.error {
  color: var(--color-danger);
}

.push-details-toggle {
  margin-top: var(--space-2);
}

.push-details-caret {
  margin-left: 4px;
  opacity: 0.6;
  transition: transform 0.15s ease;
}

.push-details-caret.open {
  transform: rotate(180deg);
}

.push-domain-list {
  list-style: none;
  margin: var(--space-2) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.push-domain-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}

.push-domain-row:last-child {
  border-bottom: none;
}

.nav-config-icon {
  font-size: 1.1rem;
}

.nav-config-label {
  flex: 1;
}

.nav-config-visible {
  display: flex;
  align-items: center;
  margin-left: var(--space-2);
}
</style>
