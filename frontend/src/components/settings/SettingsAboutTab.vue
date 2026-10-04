<script setup lang="ts">
import { ref } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import AppIcon from '../AppIcon.vue';
import RichTextDisplay from '../RichTextDisplay.vue';
import AppFooterLinks from '../AppFooterLinks.vue';
import FeedbackDialog from '../FeedbackDialog.vue';
import PwaInstallDialog from '../PwaInstallDialog.vue';
import { useAboutInfo } from '../../composables/useAboutInfo';
import { usePwaInstallStore } from '../../stores/pwaInstall';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { FEEDBACK_ICON, INFO_ICON } from '../../composables/useSettingsTabs';

const pwaInstall = usePwaInstallStore();
const {
  backendBuildInfo,
  formatBuildTime,
  changelogContent,
  frontendVersion,
  frontendCommit,
  frontendBuiltAt,
} = useAboutInfo();

const showFeedbackDialog = ref(false);
const showPwaInstallDialog = ref(false);
</script>

<template>
  <div class="about-tab">
    <Card>
      <h2>
        <AppIcon :icon="ACTION_ICONS.installApp" group="actions" :size="20" /> Als App installieren
      </h2>
      <p v-if="pwaInstall.isStandalone" class="hint intro-hint">
        Du nutzt Reisotor bereits als installierte App auf diesem Gerät. 🎉
      </p>
      <template v-else>
        <p class="hint intro-hint">
          Installiere Reisotor auf deinem Start-/Homebildschirm für schnelleren Zugriff, ein eigenes
          App-Icon und Offline-Nutzung.
        </p>
        <Button type="button" variant="secondary" @click="showPwaInstallDialog = true">
          Anleitung anzeigen
        </Button>
      </template>
    </Card>

    <Card>
      <h2><AppIcon :icon="FEEDBACK_ICON" group="navigation" :size="20" /> Feedback</h2>
      <p class="hint intro-hint">
        Bug gefunden oder eine Idee für eine neue Funktion? Landet direkt als Issue im
        Reisotor-Repository.
      </p>
      <Button type="button" variant="secondary" @click="showFeedbackDialog = true">
        Feedback geben
      </Button>
    </Card>

    <Card class="build-info-card">
      <div v-if="backendBuildInfo?.changelog">
        <h2><AppIcon :icon="INFO_ICON" group="navigation" :size="20" /> Versions-Info</h2>
        <h3>Was ist neu in v{{ backendBuildInfo.changelog.version }}</h3>
        <RichTextDisplay class="changelog-notes" :content="changelogContent" />
      </div>
      <h3>Build-Info</h3>
      <dl class="build-info-list">
        <dt>Frontend</dt>
        <dd>
          v{{ frontendVersion }} ({{ frontendCommit }}) · {{ formatBuildTime(frontendBuiltAt) }}
        </dd>
        <dt>Backend</dt>
        <dd v-if="backendBuildInfo">
          v{{ backendBuildInfo.version }} ({{ backendBuildInfo.ref ?? 'unbekannt' }}) ·
          {{ formatBuildTime(backendBuildInfo.builtAt) }}
        </dd>
        <dd v-else>Lädt…</dd>
      </dl>
      <h3>Dienste &amp; Open Source</h3>
      <dl class="build-info-list">
        <dt>Kartendaten</dt>
        <dd>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            >© OpenStreetMap-Mitwirkende</a
          >
        </dd>
        <dt>Kartenanzeige</dt>
        <dd>
          <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>
        </dd>
        <dt>Routen &amp; Fahrzeiten</dt>
        <dd>
          <a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer"
            >OpenRouteService</a
          >
        </dd>
        <dt>Wettervorhersage</dt>
        <dd>
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        </dd>
        <dt>Icons</dt>
        <dd>
          <a href="https://tabler.io/icons" target="_blank" rel="noopener noreferrer"
            >Tabler Icons</a
          >
        </dd>
      </dl>
      <AppFooterLinks
        v-if="backendBuildInfo"
        :repo-url="backendBuildInfo.repoUrl"
        :hosting-location="backendBuildInfo.hostingLocation"
      />
    </Card>

    <FeedbackDialog v-model="showFeedbackDialog" />
    <PwaInstallDialog v-model="showPwaInstallDialog" />
  </div>
</template>

<style scoped>
.about-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

h2:has(.app-icon) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  word-break: break-word;
}

h3 {
  font-size: var(--font-size-md);
  margin: var(--space-4) 0 var(--space-3) 0;
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.hint.intro-hint {
  margin-bottom: var(--space-3);
}

.build-info-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  font-size: var(--font-size-sm);
}

.build-info-list dt {
  color: var(--color-text-muted);
}

.build-info-list dd {
  margin: 0;
  min-width: 0;
  word-break: break-word;
}

.changelog-notes :deep(h4) {
  margin-top: var(--space-3);
  margin-bottom: var(--space-1);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: 700;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-1);
}

.changelog-notes :deep(h4:first-child) {
  margin-top: var(--space-1);
}

.build-info-card :deep(.app-footer-repo-link) {
  margin-top: var(--space-4);
}
</style>
