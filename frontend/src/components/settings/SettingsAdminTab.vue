<script setup lang="ts">
import { onMounted, reactive, watch, computed, ref } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import Input from '../primitives/Input.vue';
import Textarea from '../primitives/Textarea.vue';
import CheckboxCard from '../primitives/CheckboxCard.vue';
import Radio from '../primitives/Radio.vue';
import AppIcon from '../AppIcon.vue';
import ViewLoadingState from '../ViewLoadingState.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import AdminUserManagementCard from './AdminUserManagementCard.vue';
import { useAuthStore } from '../../stores/auth';
import { useAdminSettings } from '../../composables/useAdminSettings';
import { api, ApiError } from '../../api/client';
import { BELL_ICON } from '../../composables/useSettingsTabs';
import { ACTION_ICONS } from '../../utils/actionIcons';
import {
  IconLock,
  IconScale,
  IconMapPin,
  IconMail,
  IconBrandGithub,
  IconKey,
} from '@tabler/icons-vue';
import type { IconDef } from '../../utils/icon';

const auth = useAuthStore();

// Icons
const REGISTRATION_ICON: IconDef = { id: 'lock', emoji: '🔒', outline: IconLock };
const LEGAL_ICON: IconDef = { id: 'scale', emoji: '⚖️', outline: IconScale };
const GEO_ICON: IconDef = { id: 'map-pin', emoji: '📍', outline: IconMapPin };
const EMAIL_ICON: IconDef = { id: 'mail', emoji: '✉️', outline: IconMail };
const GITHUB_ICON: IconDef = { id: 'github', emoji: '🐙', outline: IconBrandGithub };
const KEY_ICON: IconDef = { id: 'key', emoji: '🔑', outline: IconKey };

// System Settings composable
const {
  settings,
  loading: loadingSettings,
  savingSection,
  saveSuccess,
  errorMessage,
  generatingVapid,
  loadSettings,
  saveSection,
  generateVapidKeys,
} = useAdminSettings();

// Local form states
const regForm = reactive({
  registrationMode: 'restricted' as 'off' | 'full' | 'restricted',
  requireEmailVerification: false,
});

const legalForm = reactive({
  operatorName: '',
  operatorAddress: '',
  contactEmail: '',
  contactPhone: '',
  hostingLocation: 'Berlin',
});

const geoForm = reactive({
  orsApiKey: '',
  clearOrsApiKey: false,
  photonApiUrl: 'https://photon.komoot.io/api/',
  nominatimApiUrl: 'https://nominatim.openstreetmap.org/search',
  nominatimEnabled: true,
});

const emailForm = reactive({
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  clearSmtpPass: false,
  smtpFrom: '',
  appUrl: 'http://localhost:5173',
});

const feedbackForm = reactive({
  githubRepo: 'dmstern/reisotor',
  githubToken: '',
  clearGithubToken: false,
  feedbackRelayForwarding: true,
  feedbackRelayUrl: 'https://reise.ruebenherz.de/api/feedback/relay',
});

const pushForm = reactive({
  vapidPublicKey: '',
  vapidPrivateKey: '',
  clearVapidKeys: false,
  vapidSubject: 'mailto:admin@example.com',
});

const isOrsConfigured = computed(() => Boolean(settings.value?.geo.isOrsApiKeySet));
const isSmtpConfigured = computed(() => Boolean(settings.value?.email.smtpHost));
const isSmtpPassConfigured = computed(() => Boolean(settings.value?.email.isSmtpPassSet));
const isGithubTokenConfigured = computed(() => Boolean(settings.value?.feedback.isGithubTokenSet));
const isVapidConfigured = computed(() =>
  Boolean(settings.value?.push.vapidPublicKey && settings.value?.push.isVapidPrivateKeySet)
);
const isVapidPrivateKeyConfigured = computed(() =>
  Boolean(settings.value?.push.isVapidPrivateKeySet)
);

// Sync from loaded settings
watch(
  settings,
  (s) => {
    if (!s) return;
    regForm.registrationMode = s.registration.registrationMode;
    regForm.requireEmailVerification = s.registration.requireEmailVerification;

    legalForm.operatorName = s.legal.operatorName;
    legalForm.operatorAddress = s.legal.operatorAddress;
    legalForm.contactEmail = s.legal.contactEmail;
    legalForm.contactPhone = s.legal.contactPhone;
    legalForm.hostingLocation = s.legal.hostingLocation;

    geoForm.photonApiUrl = s.geo.photonApiUrl;
    geoForm.nominatimApiUrl = s.geo.nominatimApiUrl;
    geoForm.nominatimEnabled = s.geo.nominatimEnabled;
    geoForm.orsApiKey = '';
    geoForm.clearOrsApiKey = false;

    emailForm.smtpHost = s.email.smtpHost;
    emailForm.smtpPort = s.email.smtpPort;
    emailForm.smtpSecure = s.email.smtpSecure;
    emailForm.smtpUser = s.email.smtpUser;
    emailForm.smtpPass = '';
    emailForm.clearSmtpPass = false;
    emailForm.smtpFrom = s.email.smtpFrom;
    emailForm.appUrl = s.email.appUrl;

    feedbackForm.githubRepo = s.feedback.githubRepo;
    feedbackForm.githubToken = '';
    feedbackForm.clearGithubToken = false;
    feedbackForm.feedbackRelayForwarding = s.feedback.feedbackRelayForwarding;
    feedbackForm.feedbackRelayUrl = s.feedback.feedbackRelayUrl;

    pushForm.vapidPublicKey = s.push.vapidPublicKey;
    pushForm.vapidPrivateKey = '';
    pushForm.clearVapidKeys = false;
    pushForm.vapidSubject = s.push.vapidSubject;
  },
  { immediate: true }
);

onMounted(() => {
  if (auth.user?.is_admin) {
    loadSettings();
  }
});

// Section save helpers
async function saveRegistration() {
  await saveSection('registration', {
    registration: {
      registrationMode: regForm.registrationMode,
      requireEmailVerification: regForm.requireEmailVerification,
    },
  });
}

async function saveLegal() {
  await saveSection('legal', {
    legal: {
      operatorName: legalForm.operatorName,
      operatorAddress: legalForm.operatorAddress,
      contactEmail: legalForm.contactEmail,
      contactPhone: legalForm.contactPhone,
      hostingLocation: legalForm.hostingLocation,
    },
  });
}

async function saveGeo() {
  await saveSection('geo', {
    geo: {
      orsApiKey: geoForm.orsApiKey || undefined,
      clearOrsApiKey: geoForm.clearOrsApiKey,
      photonApiUrl: geoForm.photonApiUrl,
      nominatimApiUrl: geoForm.nominatimApiUrl,
      nominatimEnabled: geoForm.nominatimEnabled,
    },
  });
  geoForm.orsApiKey = '';
  geoForm.clearOrsApiKey = false;
}

async function saveEmail() {
  await saveSection('email', {
    email: {
      smtpHost: emailForm.smtpHost,
      smtpPort: Number(emailForm.smtpPort) || 587,
      smtpSecure: emailForm.smtpSecure,
      smtpUser: emailForm.smtpUser,
      smtpPass: emailForm.smtpPass || undefined,
      clearSmtpPass: emailForm.clearSmtpPass,
      smtpFrom: emailForm.smtpFrom,
      appUrl: emailForm.appUrl,
    },
  });
  emailForm.smtpPass = '';
  emailForm.clearSmtpPass = false;
}

const testingEmail = ref(false);
const testEmailFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);

async function sendTestEmail() {
  testEmailFeedback.value = null;
  testingEmail.value = true;
  try {
    const res = await api.post<{ success: boolean; message: string }>(
      '/admin/settings/send-test-email'
    );
    testEmailFeedback.value = {
      type: 'success',
      message: res.message || 'Test-E-Mail erfolgreich versendet!',
    };
  } catch (err) {
    testEmailFeedback.value = {
      type: 'error',
      message: err instanceof ApiError ? err.message : 'Fehler beim Versenden der Test-E-Mail.',
    };
  } finally {
    testingEmail.value = false;
  }
}

async function saveFeedback() {
  await saveSection('feedback', {
    feedback: {
      githubRepo: feedbackForm.githubRepo,
      githubToken: feedbackForm.githubToken || undefined,
      clearGithubToken: feedbackForm.clearGithubToken,
      feedbackRelayForwarding: feedbackForm.feedbackRelayForwarding,
      feedbackRelayUrl: feedbackForm.feedbackRelayUrl,
    },
  });
  feedbackForm.githubToken = '';
  feedbackForm.clearGithubToken = false;
}

async function savePush() {
  await saveSection('push', {
    push: {
      vapidPublicKey: pushForm.vapidPublicKey || undefined,
      vapidPrivateKey: pushForm.vapidPrivateKey || undefined,
      clearVapidKeys: pushForm.clearVapidKeys,
      vapidSubject: pushForm.vapidSubject,
    },
  });
  pushForm.vapidPrivateKey = '';
  pushForm.clearVapidKeys = false;
}

async function handleGenerateVapid() {
  await generateVapidKeys(pushForm.vapidSubject);
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <div class="admin-tab">
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <!-- 1. Benutzerverwaltung -->
    <AdminUserManagementCard />

    <ViewLoadingState v-if="loadingSettings && !settings" message="Lade Systemeinstellungen…" />

    <template v-if="settings">
      <!-- 2. Registrierung & Zugang -->
      <Card class="admin-card">
        <SettingsCardHeader title="Registrierung & Zugang" :icon="REGISTRATION_ICON" />
        <p class="hint">
          Steuert, wie Personen neue Konten auf dieser Instanz erstellen können und ob E-Mails
          bestätigt werden müssen.
        </p>

        <div
          class="registration-mode-options"
          role="radiogroup"
          aria-label="Selbstregistrierung Standard-Rechte"
        >
          <label
            for="reg-mode-off"
            class="mode-option"
            :class="{ active: regForm.registrationMode === 'off' }"
          >
            <Radio
              id="reg-mode-off"
              name="adminRegistrationMode"
              value="off"
              v-model="regForm.registrationMode"
            />
            <div class="mode-content">
              <span class="mode-title">
                <strong>Deaktiviert</strong>
              </span>
              <span class="mode-desc">
                Die Selbstregistrierung ist gesperrt. Neue Konten können nur von Administrator:innen
                über „Nutzer anlegen“ erstellt werden.
              </span>
            </div>
          </label>

          <label
            for="reg-mode-restricted"
            class="mode-option"
            :class="{ active: regForm.registrationMode === 'restricted' }"
          >
            <Radio
              id="reg-mode-restricted"
              name="adminRegistrationMode"
              value="restricted"
              v-model="regForm.registrationMode"
            />
            <div class="mode-content">
              <span class="mode-title">
                <strong>Offen als Basis-Konto</strong>
                <Badge variant="accent-secondary" size="sm">Empfohlen</Badge>
              </span>
              <span class="mode-desc">
                Freunde können sich selbst registrieren und starten mit Basis-Rechten (kein
                Datei-Upload, max. 1 eigener Urlaub), bis du sie oben per Klick freischaltest.
              </span>
            </div>
          </label>

          <label
            for="reg-mode-full"
            class="mode-option"
            :class="{ active: regForm.registrationMode === 'full' }"
          >
            <Radio
              id="reg-mode-full"
              name="adminRegistrationMode"
              value="full"
              v-model="regForm.registrationMode"
            />
            <div class="mode-content">
              <span class="mode-title">
                <strong>Offen mit Reisotor Plus</strong>
              </span>
              <span class="mode-desc">
                Jeder neu registrierte Account erhält sofort volle Berechtigungen für Urlaube und
                Datei-Uploads.
              </span>
            </div>
          </label>
        </div>

        <div class="form-checkbox-row">
          <CheckboxCard
            id="reg-require-verification"
            v-model="regForm.requireEmailVerification"
            variant="row"
            label="Double-Opt-In: E-Mail-Bestätigung bei Selbstregistrierungen erzwingen"
            description="Erfordert einen konfigurierten SMTP-Mailserver."
          />
        </div>

        <div class="section-actions">
          <Button
            variant="primary"
            size="sm"
            :loading="savingSection === 'registration'"
            @click="saveRegistration"
          >
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <span v-if="saveSuccess['registration']" class="save-success-msg">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gespeichert
          </span>
        </div>
      </Card>

      <!-- 3. Instanz & Impressum (Rechtliches) -->
      <Card class="admin-card">
        <SettingsCardHeader title="Instanz & Impressum" :icon="LEGAL_ICON" />
        <p class="hint">
          Pflege hier die gesetzlichen Anbieterangaben für Impressum (§ 5 DDG) und Datenschutz (Art.
          13 DSGVO). Sind alle Pflichtangaben hinterlegt, verschwindet der gelbe Warnhinweis auf der
          Impressums-Seite.
        </p>

        <div class="form-grid">
          <div class="form-group">
            <label for="legal-operator-name">Betreiber / Verantwortliche Person *</label>
            <Input
              id="legal-operator-name"
              v-model="legalForm.operatorName"
              placeholder="z. B. Max Mustermann oder Musterreisen e.V."
            />
          </div>

          <div class="form-group">
            <label for="legal-contact-email">Kontakt- & Datenschutz-E-Mail *</label>
            <Input
              id="legal-contact-email"
              type="email"
              v-model="legalForm.contactEmail"
              placeholder="z. B. kontakt@meine-domain.de"
            />
          </div>

          <div class="form-group full-width">
            <label for="legal-operator-address">Ladungsfähige Postanschrift *</label>
            <Textarea
              id="legal-operator-address"
              v-model="legalForm.operatorAddress"
              :rows="2"
              placeholder="z. B. Musterstraße 12, 12345 Musterstadt"
            />
          </div>

          <div class="form-group">
            <label for="legal-contact-phone">Telefonnummer (optional)</label>
            <Input
              id="legal-contact-phone"
              type="tel"
              v-model="legalForm.contactPhone"
              placeholder="z. B. +49 30 1234567"
            />
          </div>

          <div class="form-group">
            <label for="legal-hosting-location">Hosting-Standort (Stadt/Region)</label>
            <Input
              id="legal-hosting-location"
              v-model="legalForm.hostingLocation"
              placeholder="Berlin"
            />
            <span class="field-hint">Wird im Über-Bereich als Server-Standort ausgewiesen.</span>
          </div>
        </div>

        <div class="section-actions">
          <Button
            variant="primary"
            size="sm"
            :loading="savingSection === 'legal'"
            @click="saveLegal"
          >
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <span v-if="saveSuccess['legal']" class="save-success-msg">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gespeichert
          </span>
        </div>
      </Card>

      <!-- 4. Karten- & Geodienste -->
      <Card class="admin-card">
        <SettingsCardHeader title="Karten- & Geodienste" :icon="GEO_ICON" />
        <p class="hint">
          Konfiguriere externe Schnittstellen für Ortssuche, Geocoding und Routenberechnung in
          Etappen.
        </p>

        <div class="form-grid">
          <div class="form-group full-width">
            <div class="label-with-badge">
              <label for="geo-ors-key">OpenRouteService API-Key (Routen & Fahrdauer)</label>
              <Badge v-if="isOrsConfigured && !geoForm.clearOrsApiKey" variant="success">
                Aktiv
              </Badge>
              <Badge v-else variant="default">Nicht eingerichtet</Badge>
            </div>
            <div class="secret-input-row">
              <Input
                id="geo-ors-key"
                type="password"
                v-model="geoForm.orsApiKey"
                :placeholder="
                  isOrsConfigured && !geoForm.clearOrsApiKey
                    ? '•••••••••••••••• (gespeichert – leer lassen für unverändert)'
                    : 'Kostenloser Key von account.heigit.org'
                "
              />
              <Button
                v-if="isOrsConfigured && !geoForm.clearOrsApiKey"
                variant="secondary"
                size="sm"
                @click="geoForm.clearOrsApiKey = true"
              >
                Key entfernen
              </Button>
              <Button
                v-else-if="geoForm.clearOrsApiKey"
                variant="ghost"
                size="sm"
                @click="geoForm.clearOrsApiKey = false"
              >
                Rückgängig
              </Button>
            </div>
            <span class="field-hint">
              Ermöglicht genaue Routenpolylines, Reisezeiten und Distanzen für Auto, Fahrrad und
              Fußweg. Ohne Key wird Luftlinie genutzt.
            </span>
          </div>

          <div class="form-group full-width">
            <label for="geo-photon-url">Komoot Photon API-URL (Primäre POI- & Adresssuche)</label>
            <Input
              id="geo-photon-url"
              type="url"
              v-model="geoForm.photonApiUrl"
              placeholder="https://photon.komoot.io/api/"
            />
          </div>

          <div class="form-group full-width">
            <div class="form-checkbox-row">
              <CheckboxCard
                id="geo-nominatim-enabled"
                v-model="geoForm.nominatimEnabled"
                variant="row"
                label="OSM Nominatim Geocoder als Fallback und Ergänzung aktivieren"
              />
            </div>
          </div>

          <div v-if="geoForm.nominatimEnabled" class="form-group full-width">
            <label for="geo-nominatim-url">Nominatim API-URL</label>
            <Input
              id="geo-nominatim-url"
              type="url"
              v-model="geoForm.nominatimApiUrl"
              placeholder="https://nominatim.openstreetmap.org/search"
            />
          </div>
        </div>

        <div class="section-actions">
          <Button variant="primary" size="sm" :loading="savingSection === 'geo'" @click="saveGeo">
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <span v-if="saveSuccess['geo']" class="save-success-msg">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gespeichert
          </span>
        </div>
      </Card>

      <!-- 5. E-Mail (SMTP Mailserver) -->
      <Card class="admin-card">
        <SettingsCardHeader title="E-Mail & Mailserver (SMTP)" :icon="EMAIL_ICON" />
        <p class="hint">
          Ermöglicht den automatischen Versand von Passwort-Reset-Mails und Verifizierungs-Links
          direkt an Nutzer:innen.
        </p>

        <div class="form-grid">
          <div class="form-group">
            <div class="label-with-badge">
              <label for="email-smtp-host">SMTP Hostname</label>
              <Badge v-if="isSmtpConfigured" variant="success">Eingerichtet</Badge>
              <Badge v-else variant="default">Inaktiv</Badge>
            </div>
            <Input
              id="email-smtp-host"
              v-model="emailForm.smtpHost"
              placeholder="z. B. smtp.example.com oder mail.hoster.de"
            />
          </div>

          <div class="form-group">
            <label for="email-smtp-port">SMTP Port</label>
            <Input
              id="email-smtp-port"
              type="number"
              v-model="emailForm.smtpPort"
              placeholder="587"
            />
            <span class="field-hint">Typischerweise 587 (STARTTLS) oder 465 (SSL/TLS).</span>
          </div>

          <div class="form-group">
            <label for="email-smtp-user">SMTP Benutzername</label>
            <Input
              id="email-smtp-user"
              v-model="emailForm.smtpUser"
              placeholder="z. B. info@deine-domain.de"
            />
          </div>

          <div class="form-group">
            <div class="label-with-badge">
              <label for="email-smtp-pass">SMTP Passwort</label>
              <Badge v-if="isSmtpPassConfigured && !emailForm.clearSmtpPass" variant="success">
                Gespeichert
              </Badge>
            </div>
            <div class="secret-input-row">
              <Input
                id="email-smtp-pass"
                type="password"
                v-model="emailForm.smtpPass"
                :placeholder="
                  isSmtpPassConfigured && !emailForm.clearSmtpPass
                    ? '•••••••••••••••• (leer lassen für unverändert)'
                    : 'Passwort / App-Token'
                "
              />
              <Button
                v-if="isSmtpPassConfigured && !emailForm.clearSmtpPass"
                variant="secondary"
                size="sm"
                @click="emailForm.clearSmtpPass = true"
              >
                Passwort entfernen
              </Button>
              <Button
                v-else-if="emailForm.clearSmtpPass"
                variant="ghost"
                size="sm"
                @click="emailForm.clearSmtpPass = false"
              >
                Rückgängig
              </Button>
            </div>
          </div>

          <div class="form-group full-width">
            <div class="form-checkbox-row">
              <CheckboxCard
                id="email-smtp-secure"
                v-model="emailForm.smtpSecure"
                variant="row"
                label="TLS/SSL Verbindung erzwingen"
                description="Sichere Transportverschlüsselung (bei Port 465 automatisch aktiv, bei Port 587 via STARTTLS)."
              />
            </div>
          </div>

          <div class="form-group">
            <label for="email-smtp-from">Absenderadresse (From)</label>
            <Input
              id="email-smtp-from"
              v-model="emailForm.smtpFrom"
              placeholder='"Reisotor" <noreply@deine-domain.de>'
            />
          </div>

          <div class="form-group">
            <label for="email-app-url">Öffentliche App-URL</label>
            <Input
              id="email-app-url"
              type="url"
              v-model="emailForm.appUrl"
              placeholder="https://reise.deine-domain.de"
            />
            <span class="field-hint"
              >Wird als Basis in Reset- und Bestätigungs-Links verwendet.</span
            >
          </div>
        </div>

        <div class="section-actions">
          <Button
            variant="primary"
            size="sm"
            :loading="savingSection === 'email'"
            @click="saveEmail"
          >
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <Button
            v-if="isSmtpConfigured"
            variant="secondary"
            size="sm"
            :loading="testingEmail"
            @click="sendTestEmail"
          >
            <AppIcon :icon="ACTION_ICONS.send" :size="14" group="actions" /> Test-E-Mail senden
          </Button>
          <span v-if="saveSuccess['email']" class="save-success-msg">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gespeichert
          </span>
        </div>
        <div
          v-if="testEmailFeedback"
          class="test-email-result"
          :class="testEmailFeedback.type"
          role="status"
        >
          {{ testEmailFeedback.message }}
        </div>
      </Card>

      <!-- 6. Feedback & GitHub -->
      <Card class="admin-card">
        <SettingsCardHeader title="Feedback & GitHub-Integration" :icon="GITHUB_ICON" />
        <p class="hint">
          Steuert, wie Fehler- und Verbesserungsmeldungen aus dem In-App-Feedbackformular
          verarbeitet werden.
        </p>

        <div class="form-grid">
          <div class="form-group">
            <label for="fb-repo">GitHub Repository</label>
            <Input id="fb-repo" v-model="feedbackForm.githubRepo" placeholder="dmstern/reisotor" />
          </div>

          <div class="form-group">
            <div class="label-with-badge">
              <label for="fb-token">GitHub Personal Access Token (PAT)</label>
              <Badge
                v-if="isGithubTokenConfigured && !feedbackForm.clearGithubToken"
                variant="success"
              >
                Gespeichert
              </Badge>
              <Badge v-else variant="default">Kein Token</Badge>
            </div>
            <div class="secret-input-row">
              <Input
                id="fb-token"
                type="password"
                v-model="feedbackForm.githubToken"
                :placeholder="
                  isGithubTokenConfigured && !feedbackForm.clearGithubToken
                    ? '•••••••••••••••• (leer lassen für unverändert)'
                    : 'github_pat_...'
                "
              />
              <Button
                v-if="isGithubTokenConfigured && !feedbackForm.clearGithubToken"
                variant="secondary"
                size="sm"
                @click="feedbackForm.clearGithubToken = true"
              >
                Token entfernen
              </Button>
              <Button
                v-else-if="feedbackForm.clearGithubToken"
                variant="ghost"
                size="sm"
                @click="feedbackForm.clearGithubToken = false"
              >
                Rückgängig
              </Button>
            </div>
          </div>

          <div class="form-group full-width">
            <div class="form-checkbox-row">
              <CheckboxCard
                id="fb-relay-forwarding"
                v-model="feedbackForm.feedbackRelayForwarding"
                variant="row"
                label="Feedback-Relay nutzen"
                description="Wenn kein eigener GitHub-Token hinterlegt ist, werden Meldungen transparent an den zentralen Relay-Dienst weitergeleitet."
              />
            </div>
          </div>

          <div v-if="feedbackForm.feedbackRelayForwarding" class="form-group full-width">
            <label for="fb-relay-url">Relay-Ziel-URL</label>
            <Input
              id="fb-relay-url"
              type="url"
              v-model="feedbackForm.feedbackRelayUrl"
              placeholder="https://reise.ruebenherz.de/api/feedback/relay"
            />
          </div>
        </div>

        <div class="section-actions">
          <Button
            variant="primary"
            size="sm"
            :loading="savingSection === 'feedback'"
            @click="saveFeedback"
          >
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <span v-if="saveSuccess['feedback']" class="save-success-msg">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gespeichert
          </span>
        </div>
      </Card>

      <!-- 7. Web Push Benachrichtigungen -->
      <Card class="admin-card">
        <SettingsCardHeader title="Web Push Benachrichtigungen" :icon="BELL_ICON" />
        <p class="hint">
          Ermöglicht Push-Benachrichtigungen auf Mobilgeräten und Desktops (Abreise-Erinnerungen,
          Änderungen in Urlauben).
        </p>

        <div class="form-grid">
          <div class="form-group full-width">
            <div class="label-with-badge">
              <label for="push-pub-key">Öffentlicher VAPID-Schlüssel (Public Key)</label>
              <Badge v-if="isVapidConfigured && !pushForm.clearVapidKeys" variant="success">
                Aktiv
              </Badge>
              <Badge v-else variant="default">Inaktiv</Badge>
            </div>
            <Input
              id="push-pub-key"
              v-model="pushForm.vapidPublicKey"
              placeholder="Noch kein VAPID-Schlüssel hinterlegt"
            />
          </div>

          <div class="form-group full-width">
            <div class="label-with-badge">
              <label for="push-priv-key">Privater VAPID-Schlüssel (Private Key)</label>
              <Badge
                v-if="isVapidPrivateKeyConfigured && !pushForm.clearVapidKeys"
                variant="success"
              >
                Gespeichert
              </Badge>
            </div>
            <div class="secret-input-row">
              <Input
                id="push-priv-key"
                type="password"
                v-model="pushForm.vapidPrivateKey"
                :placeholder="
                  isVapidPrivateKeyConfigured && !pushForm.clearVapidKeys
                    ? '•••••••••••••••• (leer lassen für unverändert)'
                    : 'Privater VAPID-Schlüssel'
                "
              />
              <Button
                v-if="isVapidPrivateKeyConfigured && !pushForm.clearVapidKeys"
                variant="secondary"
                size="sm"
                @click="pushForm.clearVapidKeys = true"
              >
                Schlüsselpaar löschen
              </Button>
              <Button
                v-else-if="pushForm.clearVapidKeys"
                variant="ghost"
                size="sm"
                @click="pushForm.clearVapidKeys = false"
              >
                Rückgängig
              </Button>
            </div>
          </div>

          <div class="form-group">
            <label for="push-subject">VAPID Kontakt-E-Mail oder URL (Subject)</label>
            <Input
              id="push-subject"
              v-model="pushForm.vapidSubject"
              placeholder="mailto:admin@example.com"
            />
          </div>

          <div class="form-group push-gen-col">
            <span class="invisible-label" aria-hidden="true">Schlüssel-Aktion</span>
            <Button
              variant="secondary"
              size="md"
              :loading="generatingVapid"
              @click="handleGenerateVapid"
            >
              <AppIcon :icon="KEY_ICON" :size="16" group="actions" />
              Neue VAPID-Schlüssel generieren
            </Button>
          </div>
        </div>

        <div class="section-actions">
          <Button variant="primary" size="sm" :loading="savingSection === 'push'" @click="savePush">
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <span v-if="saveSuccess['push']" class="save-success-msg">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gespeichert
          </span>
        </div>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.admin-card {
  margin-bottom: var(--space-4);
}

.error-banner {
  padding: var(--space-3) var(--space-4);
  background: var(--color-danger-tint, #fee2e2);
  color: var(--color-danger, #b91c1c);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm-squircle);
  margin-bottom: var(--space-4);
  font-size: var(--font-size-sm);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.hint.error {
  color: var(--color-danger);
}

.registration-mode-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  margin-bottom: var(--space-3);
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.mode-option:hover {
  background: var(--color-hover);
}

.mode-option:focus-visible,
.mode-option:focus-within {
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 2px;
}

.mode-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.mode-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mode-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.mode-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.form-checkbox-row {
  margin: var(--space-3) 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--space-3) var(--space-4);
  margin-top: var(--space-3);
  margin-bottom: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.label-with-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.label-with-badge label {
  margin: 0;
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.secret-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.secret-input-row :deep(.input-wrapper),
.secret-input-row input {
  flex: 1;
  min-width: 0;
}

.secret-input-row button,
.secret-input-row :deep(button) {
  flex-shrink: 0;
}

.push-gen-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-width: 0;
}

.push-gen-col :deep(.btn) {
  white-space: normal;
  text-align: center;
}

.invisible-label {
  visibility: hidden;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}

.save-success-msg {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-success);
  font-weight: 500;
}

.test-email-result {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  word-break: break-word;
}

.test-email-result.success {
  background: var(--color-success-subtle, rgba(46, 160, 67, 0.15));
  border: 1px solid var(--color-success-border, rgba(46, 160, 67, 0.4));
  color: var(--color-success, #2ea043);
}

.test-email-result.error {
  background: var(--color-danger-subtle, rgba(248, 81, 73, 0.15));
  border: 1px solid var(--color-danger-border, rgba(248, 81, 73, 0.4));
  color: var(--color-danger, #f85149);
}
</style>
