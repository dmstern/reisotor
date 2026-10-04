<script setup lang="ts">
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import CheckboxCard from '../primitives/CheckboxCard.vue';
import Accordion from '../primitives/Accordion.vue';
import ThemeModeSelect from '../ThemeModeSelect.vue';
import AccentColorSettings from '../AccentColorSettings.vue';
import BorderWidthSettings from '../BorderWidthSettings.vue';
import GlassSettings from '../GlassSettings.vue';
import IconStyleSettings from '../IconStyleSettings.vue';
import DiaryFontSettings from '../DiaryFontSettings.vue';
import AppIcon from '../AppIcon.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import ReorderableConfigItem from './ReorderableConfigItem.vue';
import { useNavConfigStore } from '../../stores/navConfig';
import { useDashboardConfigStore } from '../../stores/dashboardConfig';
import { useUiSettingsStore } from '../../stores/uiSettings';
import { useAppSettingsReset } from '../../composables/useAppSettingsReset';
import { DASHBOARD_TILES_ICON } from '../../composables/useSettingsTabs';
import { ACTION_ICONS } from '../../utils/actionIcons';

const navConfig = useNavConfigStore();
const dashboardConfig = useDashboardConfigStore();
const uiSettings = useUiSettingsStore();

const {
  navLinkLabel,
  navLinkIcon,
  dashboardTileLabel,
  dashboardTileIcon,
  isThemeDefault,
  resetTheme,
  isNavDefault,
  resetNav,
  isDashboardDefault,
  resetDashboard,
  isVacationCountdownDefault,
  resetVacationCountdown,
  isAllAppDefault,
  resetAllAppSettings,
} = useAppSettingsReset();
</script>

<template>
  <div class="app-tab">
    <Card>
      <SettingsCardHeader
        title="Darstellung"
        show-reset
        :is-default="isThemeDefault"
        :reset-title="
          isThemeDefault ? 'Bereits auf Standard-Darstellung' : 'Auf Standard zurücksetzen'
        "
        @reset="resetTheme"
      />
      <p class="hint">
        Wähle zwischen hellem, dunklem oder an das Betriebssystem angepasstem Farbschema.
      </p>
      <ThemeModeSelect variant="block" />
    </Card>

    <AccentColorSettings />

    <BorderWidthSettings />

    <GlassSettings />

    <IconStyleSettings />

    <DiaryFontSettings />

    <Card>
      <SettingsCardHeader
        title="Navigation"
        show-reset
        :is-default="isNavDefault"
        :reset-title="
          isNavDefault ? 'Bereits auf Standard-Navigation' : 'Auf Standard zurücksetzen'
        "
        @reset="resetNav"
      />

      <p class="hint nav-config-hint">
        Reihenfolge und Sichtbarkeit der übrigen Einträge ("Übersicht" bleibt immer an erster
        Stelle).
      </p>
      <ul class="nav-config-list">
        <ReorderableConfigItem
          v-for="(entry, index) in navConfig.entries"
          :key="entry.key"
          :item-key="entry.key"
          :label="navLinkLabel(entry.key)"
          :visible="entry.visible"
          :icon="navLinkIcon(entry.key)"
          :index="index"
          :total="navConfig.entries.length"
          id-prefix="nav-visible-"
          row-class="nav-config-row"
          :checkbox-aria-label="`${navLinkLabel(entry.key)} in der Navigation anzeigen`"
          @move-up="navConfig.moveUp(entry.key)"
          @move-down="navConfig.moveDown(entry.key)"
          @toggle-visible="navConfig.setVisible(entry.key, $event)"
        />
      </ul>

      <div class="mobile-nav-toggle-wrapper">
        <CheckboxCard
          id="nav-custom-mobile-toggle"
          :model-value="navConfig.customMobile"
          label="Mobile Navigation separat anpassen"
          description="Reihenfolge und Sichtbarkeit der Menüpunkte für Smartphones und schmale Bildschirme unabhängig von Desktop festlegen."
          :icon="ACTION_ICONS.deviceMobile"
          variant="card"
          @update:model-value="navConfig.setCustomMobile"
        />
      </div>

      <Accordion :expanded="navConfig.customMobile">
        <div class="mobile-nav-config-section">
          <p class="hint mobile-nav-config-hint">
            Reihenfolge und Sichtbarkeit auf Mobilgeräten ("Übersicht" bleibt immer an erster
            Stelle):
          </p>
          <ul class="mobile-nav-config-list">
            <ReorderableConfigItem
              v-for="(entry, index) in navConfig.mobileEntries"
              :key="'mobile-' + entry.key"
              :item-key="entry.key"
              :label="navLinkLabel(entry.key)"
              :visible="entry.visible"
              :icon="navLinkIcon(entry.key)"
              :index="index"
              :total="navConfig.mobileEntries.length"
              id-prefix="nav-mobile-visible-"
              row-class="mobile-nav-config-row"
              :checkbox-aria-label="`${navLinkLabel(entry.key)} in der mobilen Navigation anzeigen`"
              @move-up="navConfig.moveUp(entry.key, 'mobile')"
              @move-down="navConfig.moveDown(entry.key, 'mobile')"
              @toggle-visible="navConfig.setVisible(entry.key, $event, 'mobile')"
            />
          </ul>
        </div>
      </Accordion>
    </Card>

    <Card>
      <SettingsCardHeader
        title="Dashboard-Kacheln"
        :icon="DASHBOARD_TILES_ICON"
        show-reset
        :is-default="isDashboardDefault"
        :reset-title="
          isDashboardDefault
            ? 'Bereits auf Standard-Dashboard-Kacheln'
            : 'Auf Standard zurücksetzen'
        "
        @reset="resetDashboard"
      />
      <p class="hint nav-config-hint">Reihenfolge und Sichtbarkeit der Dashboard-Kacheln.</p>
      <ul class="dashboard-config-list">
        <ReorderableConfigItem
          v-for="(entry, index) in dashboardConfig.entries"
          :key="entry.key"
          :item-key="entry.key"
          :label="dashboardTileLabel(entry.key)"
          :visible="entry.visible"
          :icon="dashboardTileIcon(entry.key)"
          :index="index"
          :total="dashboardConfig.entries.length"
          id-prefix="dashboard-tile-visible-"
          row-class="dashboard-config-row"
          :checkbox-aria-label="`${dashboardTileLabel(entry.key)} auf dem Dashboard anzeigen`"
          @move-up="dashboardConfig.moveUp(entry.key)"
          @move-down="dashboardConfig.moveDown(entry.key)"
          @toggle-visible="dashboardConfig.setVisible(entry.key, $event)"
        />
      </ul>
    </Card>

    <Card>
      <SettingsCardHeader
        title="Urlaubs-Hinweis"
        :icon="ACTION_ICONS.vacation"
        show-reset
        :is-default="isVacationCountdownDefault"
        :reset-title="
          isVacationCountdownDefault
            ? 'Bereits auf Standard-Urlaubs-Hinweis'
            : 'Auf Standard zurücksetzen'
        "
        @reset="resetVacationCountdown"
      />
      <p class="hint intro-hint">
        Passe das Verhalten des Hinweises im Dashboard-Header während eines laufenden Urlaubs an.
      </p>
      <CheckboxCard
        id="auto-id-1788301175449-29"
        v-model="uiSettings.showVacationCountdown"
        label="Verbleibende Urlaubstage anzeigen statt festem Hinweis"
        description="Zählt die verbleibenden Tage im Dashboard-Header herunter (z. B. 'Noch 3 Tage Urlaub!'), anstatt eines statischen Grußtextes."
      />
    </Card>

    <Card class="factory-reset-card">
      <div class="factory-reset-inner">
        <div class="factory-reset-info">
          <div class="factory-reset-title-row">
            <AppIcon :icon="ACTION_ICONS.restore" :size="20" group="actions" />
            <h2>Werkseinstellungen</h2>
          </div>
          <p class="hint factory-reset-hint">
            Setzt alle persönlichen App-Einstellungen (Darstellung, Farben, Rahmendicke,
            Glas-Effekt, Icons, Schriftart, Navigation, Dashboard-Kacheln und Urlaubs-Hinweis) auf
            die Standardwerte zurück.
          </p>
        </div>
        <div class="factory-reset-action">
          <Button
            variant="secondary"
            size="md"
            :icon="ACTION_ICONS.restore"
            :disabled="isAllAppDefault"
            :title="
              isAllAppDefault
                ? 'Bereits alle App-Einstellungen auf Standardwerten'
                : 'Alle App-Einstellungen auf Werkseinstellungen zurücksetzen'
            "
            class="factory-reset-btn"
            @click="resetAllAppSettings"
          >
            <span class="factory-reset-btn-label">Auf Werkseinstellungen zurücksetzen</span>
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.app-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
}

.hint.nav-config-hint {
  margin-top: var(--space-3);
  margin-bottom: var(--space-3);
}

.hint.intro-hint {
  margin-bottom: var(--space-3);
}

.nav-config-list,
.mobile-nav-config-list,
.dashboard-config-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-nav-toggle-wrapper {
  margin-top: var(--space-4);
}

.mobile-nav-config-section {
  padding-top: var(--space-3);
  margin-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
}

.mobile-nav-config-hint {
  margin-bottom: var(--space-3);
}

.factory-reset-card {
  margin-top: var(--space-6);
}

.factory-reset-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.factory-reset-info {
  flex: 1 1 320px;
}

.factory-reset-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.factory-reset-title-row h2 {
  margin: 0;
}

.factory-reset-hint {
  margin: 0;
  line-height: 1.45;
}

.factory-reset-action {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .factory-reset-inner {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .factory-reset-action {
    width: 100%;
  }

  .factory-reset-action :deep(.btn),
  .factory-reset-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
