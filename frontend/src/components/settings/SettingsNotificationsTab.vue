<script setup lang="ts">
import { onMounted } from 'vue';
import Card from '../primitives/Card.vue';
import Checkbox from '../primitives/Checkbox.vue';
import CheckboxCard from '../primitives/CheckboxCard.vue';
import CollapsibleFieldset from '../primitives/CollapsibleFieldset.vue';
import Select from '../primitives/Select.vue';
import SegmentedToggle from '../SegmentedToggle.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import { usePushSettings } from '../../composables/usePushSettings';
import { useAppSettingsReset } from '../../composables/useAppSettingsReset';
import { useUiSettingsStore, TOAST_TIMEOUT_OPTIONS } from '../../stores/uiSettings';
import { BELL_ICON } from '../../composables/useSettingsTabs';
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
  pushScopeValue,
  pushScopeOptions,
  isPushDefault,
  selectPushLevel,
  setPushScope,
  setDomainPreference,
  setEmailDomainPreference,
  resetPush,
  initPushSubscription,
} = usePushSettings();

const { isToastsDefault, resetToasts } = useAppSettingsReset();

onMounted(() => {
  initPushSubscription();
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
        id="settings-activity-toasts-toggle"
        v-model="uiSettings.showActivityToasts"
        label="Detaillierte Lade-/Speicher-Meldungen anzeigen"
        description="Schaltet die kurzen Toast-Meldungen am Bildschirmrand bei Lade- und Speichervorgängen ein oder aus."
      />
      <label for="settings-toast-timeout-select" class="toast-timeout-label">
        Anzeigedauer von Toast-Benachrichtigungen
        <Select id="settings-toast-timeout-select" v-model.number="uiSettings.toastTimeout">
          <option v-for="option in TOAST_TIMEOUT_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </Select>
      </label>
      <div class="update-dialogs-wrap">
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
        title="Benachrichtigungen"
        :icon="BELL_ICON"
        show-reset
        :is-default="isPushDefault"
        :reset-title="
          isPushDefault ? 'Bereits auf Standard-Benachrichtigungen' : 'Auf Standard zurücksetzen'
        "
        @reset="resetPush"
      />
      <p class="hint" v-if="!pushSupported">
        Push-Benachrichtigungen werden von diesem Browser nicht unterstützt. Du kannst Neuigkeiten
        jedoch wahlweise per E-Mail empfangen.
      </p>
      <template v-else>
        <p class="hint intro-hint">
          Benachrichtigt dich, wenn andere Mitglieder eines Urlaubs etwas ändern – per Push-Meldung
          auf dein Gerät oder wahlweise als E-Mail. Über die Stufe lässt sich die Push-Intensität
          einstellen.
        </p>
        <SegmentedToggle
          :model-value="pushLevelValue"
          :options="PUSH_LEVEL_TOGGLE_OPTIONS"
          :disabled="pushLoading || pushEnabled === null"
          @update:model-value="selectPushLevel"
        />
      </template>

      <CollapsibleFieldset
        v-model="showPushDetails"
        label="Einzeln anpassen (Push & E-Mail)"
        class="push-details-collapsible"
      >
        <div
          v-if="pushSupported"
          class="push-scope-section"
          :class="{ 'is-disabled': !pushEnabled }"
        >
          <span class="push-scope-heading">Ereignisse (Push)</span>
          <SegmentedToggle
            :model-value="pushScopeValue"
            :options="pushScopeOptions"
            :disabled="!pushEnabled"
            @update:model-value="setPushScope"
          />
          <p class="hint push-scope-hint">
            {{
              pushScopeValue === 'created_only'
                ? 'Benachrichtigung nur, wenn jemand ein neues Element anlegt.'
                : 'Benachrichtigung bei neuen Elementen sowie Änderungen an bestehenden.'
            }}
          </p>
        </div>

        <div class="push-domains-section">
          <span class="push-domains-heading">Bereiche</span>
          <div class="notification-domains-table">
            <div class="domains-table-header">
              <span class="col-header-label">Bereich</span>
              <span
                v-if="pushSupported"
                class="col-header-channel"
                :class="{ 'is-disabled': !pushEnabled }"
              >
                Push
              </span>
              <span class="col-header-channel">E-Mail</span>
            </div>
            <ul class="notification-domain-list">
              <li
                v-for="domain in NOTIFICATION_DOMAINS"
                :key="domain"
                class="notification-domain-row"
              >
                <div class="domain-info">
                  <span class="domain-icon">{{ NOTIFICATION_DOMAIN_META[domain].icon }}</span>
                  <span class="domain-label">{{ NOTIFICATION_DOMAIN_META[domain].label }}</span>
                </div>
                <div
                  v-if="pushSupported"
                  class="domain-channel domain-channel-push"
                  :class="{ 'is-disabled': !pushEnabled }"
                >
                  <Checkbox
                    :id="'push-domain-' + domain"
                    :checked="
                      pushEnabled ? (notificationPrefs.preferences?.[domain] ?? true) : false
                    "
                    :disabled="!pushEnabled"
                    :aria-label="`${NOTIFICATION_DOMAIN_META[domain].label}-Push ${!pushEnabled ? '(deaktiviert)' : 'aktiv'}`"
                    :title="
                      !pushEnabled
                        ? 'Push ist oben auf \'Aus\' gestellt'
                        : `${NOTIFICATION_DOMAIN_META[domain].label}-Push aktiv`
                    "
                    @change="
                      setDomainPreference(domain, ($event.target as HTMLInputElement).checked)
                    "
                  />
                </div>
                <div class="domain-channel domain-channel-email">
                  <Checkbox
                    :id="'email-domain-' + domain"
                    :checked="notificationPrefs.emailPreferences?.[domain] ?? false"
                    :aria-label="`${NOTIFICATION_DOMAIN_META[domain].label}-E-Mail aktiv`"
                    :title="`${NOTIFICATION_DOMAIN_META[domain].label}-E-Mail aktiv`"
                    @change="
                      setEmailDomainPreference(domain, ($event.target as HTMLInputElement).checked)
                    "
                  />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </CollapsibleFieldset>

      <p
        v-if="pushError || notificationPrefs.error || notificationPrefs.emailError"
        class="hint error"
      >
        {{ pushError || notificationPrefs.error || notificationPrefs.emailError }}
      </p>
    </Card>
  </div>
</template>

<style scoped>
.notifications-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

.toast-timeout-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
  width: 100%;
  max-width: 320px;
  margin-top: var(--space-4);
}

.update-dialogs-wrap {
  margin-top: var(--space-4);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.hint.intro-hint {
  margin-bottom: var(--space-3);
}

.hint.error {
  color: var(--color-danger);
}

.push-details-collapsible {
  margin-top: var(--space-3);
}

.push-scope-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  transition: opacity 0.2s ease;
}

.push-scope-section.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.push-scope-heading,
.push-domains-heading {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.push-scope-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.push-domains-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.notification-domains-table {
  margin-top: var(--space-1);
}

.domains-table-header {
  display: flex;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 2px solid var(--color-border);
  font-weight: 600;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.col-header-label {
  flex: 1;
  min-width: 0;
}

.col-header-channel {
  width: 56px;
  text-align: center;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.col-header-channel.is-disabled {
  opacity: 0.45;
}

.notification-domain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.notification-domain-row {
  display: flex;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  gap: var(--space-2);
}

.notification-domain-row:last-child {
  border-bottom: none;
}

.domain-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.domain-icon {
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.domain-label {
  overflow-wrap: break-word;
  min-width: 0;
  font-size: var(--font-size-sm);
}

.domain-channel {
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.domain-channel.is-disabled {
  opacity: 0.45;
}
</style>
