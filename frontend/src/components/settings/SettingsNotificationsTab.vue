<script setup lang="ts">
import { onMounted } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
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
          <CollapsibleFieldset
            v-model="showPushDetails"
            label="Einzeln anpassen"
            class="push-details-collapsible"
          >
            <div class="push-scope-section">
              <span class="push-scope-heading">Ereignisse</span>
              <SegmentedToggle
                :model-value="pushScopeValue"
                :options="pushScopeOptions"
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
              <ul class="push-domain-list">
                <li v-for="domain in NOTIFICATION_DOMAINS" :key="domain" class="push-domain-row">
                  <span class="push-domain-icon">{{ NOTIFICATION_DOMAIN_META[domain].icon }}</span>
                  <span class="push-domain-label">{{
                    NOTIFICATION_DOMAIN_META[domain].label
                  }}</span>
                  <label :for="'push-domain-' + domain" class="push-domain-visible">
                    <Checkbox
                      :id="'push-domain-' + domain"
                      :checked="notificationPrefs.preferences?.[domain] ?? true"
                      :aria-label="`${NOTIFICATION_DOMAIN_META[domain].label}-Push aktiv`"
                      @change="
                        setDomainPreference(domain, ($event.target as HTMLInputElement).checked)
                      "
                    />
                  </label>
                </li>
              </ul>
            </div>
          </CollapsibleFieldset>
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

.push-domain-list {
  list-style: none;
  margin: var(--space-2) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.push-domain-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.push-domain-row:last-child {
  border-bottom: none;
}

.push-domain-icon {
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.push-domain-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
}

.push-domain-visible {
  display: flex;
  align-items: center;
  margin-left: var(--space-2);
  flex-shrink: 0;
}
</style>
