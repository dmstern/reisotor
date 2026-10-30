<script setup lang="ts">
import { onMounted, reactive, watch, computed, ref } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import Input from '../primitives/Input.vue';
import Textarea from '../primitives/Textarea.vue';
import CheckboxCard from '../primitives/CheckboxCard.vue';
import Radio from '../primitives/Radio.vue';
import CollapsibleFieldset from '../primitives/CollapsibleFieldset.vue';
import Alert from '../primitives/Alert.vue';
import InfoPopover from '../primitives/InfoPopover.vue';
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
  requireEmailVerification: true,
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
const isMailConfigured = computed(() => Boolean(emailForm.smtpHost.trim()));
const canTestSmtp = computed(() => Boolean(settings.value?.email.smtpHost || emailForm.smtpHost));
const isSmtpPassConfigured = computed(() => Boolean(settings.value?.email.isSmtpPassSet));
const isGithubTokenConfigured = computed(() => Boolean(settings.value?.feedback.isGithubTokenSet));
const isEffectiveGithubTokenSet = computed(() =>
  Boolean(
    (isGithubTokenConfigured.value && !feedbackForm.clearGithubToken) ||
    feedbackForm.githubToken.trim()
  )
);

const isRelayPointingToCurrentHost = computed(() => {
  if (!feedbackForm.feedbackRelayForwarding) return false;
  const rawUrl = feedbackForm.feedbackRelayUrl.trim();
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    if (typeof window !== 'undefined' && window.location) {
      if (
        parsed.origin === window.location.origin ||
        parsed.hostname === window.location.hostname
      ) {
        return true;
      }
    }
    if (emailForm.appUrl?.trim()) {
      try {
        const appParsed = new URL(emailForm.appUrl.trim());
        if (parsed.origin === appParsed.origin || parsed.hostname === appParsed.hostname) {
          return true;
        }
      } catch {
        // ignore invalid appUrl
      }
    }
  } catch {
    if (rawUrl.startsWith('/') || rawUrl.startsWith('.')) {
      return true;
    }
  }
  return false;
});

const canResetFeedbackDefaults = computed(() => {
  return (
    feedbackForm.githubRepo !== 'dmstern/reisotor' ||
    feedbackForm.feedbackRelayForwarding !== true ||
    feedbackForm.feedbackRelayUrl !== 'https://reise.ruebenherz.de/api/feedback/relay'
  );
});

function resetFeedbackToDefaults() {
  feedbackForm.githubRepo = 'dmstern/reisotor';
  feedbackForm.feedbackRelayForwarding = true;
  feedbackForm.feedbackRelayUrl = 'https://reise.ruebenherz.de/api/feedback/relay';
}
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
  if (!auth.user?.email) {
    testEmailFeedback.value = {
      type: 'error',
      message:
        'In deinem Benutzerprofil ist keine E-Mail-Adresse hinterlegt. Bitte trage zuerst eine E-Mail-Adresse in deinem Profil ein.',
    };
    return;
  }
  testingEmail.value = true;
  try {
    // Falls Änderungen im Formular vorgenommen wurden (z. B. Passwort/Port), zuerst speichern
    await saveEmail();
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
  const ok = await generateVapidKeys(pushForm.vapidSubject);
  if (ok && settings.value) {
    pushForm.vapidPublicKey = settings.value.push.vapidPublicKey;
    pushForm.vapidPrivateKey = '';
    pushForm.clearVapidKeys = false;
  }
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

        <CheckboxCard
          id="reg-require-verification"
          v-model="regForm.requireEmailVerification"
          label="Double-Opt-In: E-Mail-Bestätigung bei Selbstregistrierungen erzwingen"
          description="Erfordert einen konfigurierten SMTP-Mailserver."
        />

        <Alert
          v-if="regForm.requireEmailVerification && !isMailConfigured"
          variant="warning"
          size="sm"
          class="reg-email-alert"
          title="Kein Mailserver konfiguriert"
        >
          Die E-Mail-Bestätigung ist aktiviert, aber es wurde noch kein SMTP-Mailserver hinterlegt.
          Neu registrierte Personen erhalten keine Bestätigungs-E-Mail und können sich erst
          anmelden, wenn weiter unten die
          <a href="#email-smtp-host" class="reg-email-link">SMTP-Einstellungen</a> ausgefüllt werden
          oder Accounts manuell durch Administrator:innen freigeschaltet werden.
        </Alert>

        <Alert
          v-else-if="regForm.registrationMode !== 'off' && !regForm.requireEmailVerification"
          variant="info"
          size="sm"
          class="reg-email-alert"
          title="Sofortige Anmeldung aktiv"
        >
          Neu registrierte Personen können sich sofort nach der Registrierung ohne
          E-Mail-Bestätigung einloggen. Für öffentlich erreichbare Instanzen wird eine Bestätigung
          per E-Mail empfohlen, um Schein-Registrierungen und Tippfehler zu vermeiden.
        </Alert>

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

        <CollapsibleFieldset
          :icon="ACTION_ICONS.info"
          label="Was bedeuten POIs & Nominatim? (Tipps zu Diensten & API-Keys)"
          class="geo-guide-fieldset"
        >
          <div class="geo-guide-content">
            <p>
              Reisotor nutzt spezialisierte Geodienste für Ortssuche, POIs, Routenführung und
              Adressauflösung. Hier erfährst du, was die Begriffe bedeuten und welche Dienste welche
              Aufgabe übernehmen:
            </p>
            <ul>
              <li>
                <strong>OpenRouteService (ORS API-Key):</strong>
                Ermöglicht echte Straßen- und Wegerouten (Polylines), exakte Distanzen und
                realistische Fahrzeiten für Auto, Fahrrad und Fußweg zwischen Reise-Etappen.
                <br />
                <em>Ohne Key:</em> Reisotor greift auf eine einfache Luftlinie zurück.
                <br />
                <span class="guide-note"
                  >Kostenloser Key: Ein persönlicher API-Key kann dauerhaft kostenlos über
                  <a href="https://account.heigit.org" target="_blank" rel="noopener noreferrer"
                    >account.heigit.org</a
                  >
                  (Heidelberg Institute for Geoinformation Technology) bezogen werden. Nach der
                  kurzen Registrierung unter <em>Tokens</em> einfach einen Standard-Token erstellen
                  (Free Tier: 2.000 Anfragen/Tag) und oben in das Feld einfügen.</span
                >
              </li>
              <li>
                <strong>Komoot Photon &amp; POI-Suche:</strong>
                Photon ist ein schneller, auf OpenStreetMap basierender Suchdienst mit
                Autovervollständigung (Type-Ahead) bei der Ortssuche.
                <br />
                <em>Was ist ein POI?</em> <strong>POI</strong> steht für <em>Point of Interest</em>
                (interessanter Ort). Damit sind namentlich benannte Reiseziele, Sehenswürdigkeiten,
                Aussichtspunkte, Strände, Restaurants, Bahnhöfe oder Unterkünfte gemeint – also
                nicht nur reine Straßenadressen.
                <br />
                <span class="guide-note"
                  >Standardmäßig ist der öffentliche Komoot-Dienst
                  (<code>https://photon.komoot.io/api/</code>) hinterlegt. Es ist keine
                  Registrierung und kein API-Key erforderlich.</span
                >
              </li>
              <li>
                <strong>OSM Nominatim Geocoder (Ergänzung &amp; Fallback):</strong>
                Nominatim ist die offizielle Suchmaschine des OpenStreetMap-Projekts für
                <em>Geocoding</em>. Geocoding bezeichnet die Umwandlung geschriebener Adressen
                (Straße, Hausnummer, Postleitzahl) in geografische GPS-Koordinaten (Längen- und
                Breitengrad).
                <br />
                <em>Wozu aktivieren?</em> Während Photon ideal für schnelle Freitext- und POI-Suchen
                ist, ist Nominatim besonders stark bei exakten postalischen Adressen mit Hausnummern
                oder kleineren Ortschaften. Ist Nominatim aktiviert, wird es als zuverlässiger
                Fallback und zur Ergänzung angefragt, wenn Photon keine passenden Treffer liefert.
                <br />
                <span class="guide-note"
                  >Standard-URL: <code>https://nominatim.openstreetmap.org/search</code> (öffentlich
                  nutzbar ohne Key; beachte die OSM Fair-Use-Richtlinie von max. 1 Anfrage/Sekunde).
                  Für hohe Lasten kann ein eigener Nominatim-Server betrieben werden.</span
                >
              </li>
            </ul>
            <Alert variant="info" size="sm">
              <strong>Empfohlene Standardkonfiguration:</strong> Photon und Nominatim funktionieren
              direkt ohne Registrierung oder API-Key. Für vollwertige Straßenrouten und genaue
              Reisezeiten in den Etappen wird die einmalige, kostenlose Einrichtung eines
              OpenRouteService-Keys empfohlen.
            </Alert>
          </div>
        </CollapsibleFieldset>

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
            <CheckboxCard
              id="geo-nominatim-enabled"
              v-model="geoForm.nominatimEnabled"
              label="OSM Nominatim Geocoder als Fallback und Ergänzung aktivieren"
            />
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

        <CollapsibleFieldset
          :icon="ACTION_ICONS.info"
          label="Tipps & Anbieter für neue Admins (z. B. Brevo, Resend, eigener Hoster)"
          class="smtp-guide-fieldset"
        >
          <div class="smtp-guide-content">
            <p>
              Reisotor benötigt einen SMTP-Server für automatische System-Mails. Wenn du noch keinen
              Mailserver hast, bieten folgende Dienste erprobte, kostenlose Kontingente:
            </p>
            <ul>
              <li>
                <strong>Brevo (ehemals Sendinblue):</strong> Bis zu 300 Mails/Tag dauerhaft
                kostenlos.
                <br />
                <em>Host:</em> <code>smtp-relay.brevo.com</code> &middot; <em>Port:</em>
                <code>587</code> &middot; <em>Benutzer:</em> deine Brevo-Login-Adresse &middot;
                <em>Passwort:</em> SMTP-Schlüssel (im Brevo-Konto unter
                <em>SMTP & API</em> generieren).
                <br />
                <span class="guide-note"
                  >Wichtig: Deine Absenderadresse muss bei Brevo unter
                  <em>Absender:innen, Domains, IPs</em> verifiziert sein.</span
                >
              </li>
              <li>
                <strong>Resend:</strong> Bis zu 3.000 Mails/Monat (100/Tag) kostenlos, sehr moderne
                Entwickler-Plattform.
                <br />
                <em>Host:</em> <code>smtp.resend.com</code> &middot; <em>Port:</em>
                <code>465</code> (mit SSL/TLS) oder <code>587</code> &middot; <em>Benutzer:</em>
                <code>resend</code> &middot; <em>Passwort:</em> API-Key (<code>re_...</code>).
                <br />
                <span class="guide-note"
                  >Wichtig: Erfordert eine eigene Domain mit DNS-Einträgen (DKIM/SPF) im
                  Resend-Dashboard.</span
                >
              </li>
              <li>
                <strong
                  >Eigener Webhoster / Mailbox (z. B. Hetzner, Netcup, Strato, All-Inkl,
                  mailbox.org):</strong
                >
                <br />
                Verwende einfach die Standard-SMTP-Daten deines E-Mail-Postfachs (z. B.
                <em>Host:</em> <code>mail.deinedomain.de</code>, <em>Port:</em>
                <code>587</code> oder <code>465</code>).
              </li>
            </ul>
            <Alert variant="info" size="sm">
              <strong>Tipp zur Verschlüsselung:</strong> Auf Port 587 wird STARTTLS automatisch
              verwendet. Die Option „TLS/SSL Verbindung erzwingen“ ist für Port 465 (SMTPS)
              vorgesehen.
            </Alert>
          </div>
        </CollapsibleFieldset>

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
            <CheckboxCard
              id="email-smtp-secure"
              v-model="emailForm.smtpSecure"
              label="TLS/SSL Verbindung erzwingen"
              description="Sichere Transportverschlüsselung (bei Port 465 automatisch aktiv, bei Port 587 via STARTTLS)."
            />
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
            v-if="canTestSmtp"
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
        <Alert
          v-if="testEmailFeedback"
          :variant="testEmailFeedback.type === 'error' ? 'danger' : 'success'"
          size="sm"
          class="test-email-alert"
          :description="testEmailFeedback.message"
        />
      </Card>

      <!-- 6. Feedback & GitHub -->
      <Card class="admin-card">
        <SettingsCardHeader title="Feedback & GitHub-Integration" :icon="GITHUB_ICON" />
        <p class="hint">
          Steuert, wie Fehler- und Verbesserungsmeldungen aus dem In-App-Feedbackformular
          verarbeitet werden.
        </p>

        <CollapsibleFieldset
          :icon="ACTION_ICONS.info"
          label="Funktionsweise & Empfehlungen (Relay, Token & Repositories)"
          class="feedback-guide-fieldset"
        >
          <div class="feedback-guide-content">
            <p>
              Über das In-App-Formular können Nutzer:innen Fehler melden oder Ideen einreichen.
              Diese werden als GitHub-Issues erfasst. Hier erfährst du, wie das Zusammenspiel aus
              Relay, Token und Repository funktioniert:
            </p>
            <ul>
              <li>
                <strong>Feedback-Relay (Standard-Empfehlung):</strong>
                Für selbstgehostete Instanzen ist kein eigener GitHub-Account oder Token nötig.
                Meldungen werden standardmäßig über den offiziellen Relay-Dienst
                (<code>https://reise.ruebenherz.de/api/feedback/relay</code>) transparent an das
                Haupt-Repository (<code>dmstern/reisotor</code>) weitergeleitet und dort vom
                Reisotor-Team gesichtet.
              </li>
              <li>
                <strong>GitHub Repository (Standard: <code>dmstern/reisotor</code>):</strong>
                Das Ziel-Repository für gemeldete Issues. Belasse diesen Wert auf dem Standard, es
                sei denn, du pflegst einen eigenen Fork von Reisotor und möchtest Issues direkt in
                deinem eigenen GitHub-Projekt sammeln.
              </li>
              <li>
                <strong>GitHub Personal Access Token (PAT):</strong>
                Wird im Standardbetrieb <em>nicht benötigt</em> (Feld bleibt leer). Ein Token ist
                nur erforderlich, wenn du Meldungen direkt in ein eigenes GitHub-Repository leiten
                oder selbst einen zentralen Relay-Server betreiben möchtest.
                <br />
                <span class="guide-note"
                  >Empfohlener Tokentyp: Fine-grained Personal Access Token mit Berechtigung für
                  <em>Issues (Read &amp; Write)</em> und optional
                  <em>Contents (Read &amp; Write)</em> für Screenshots.</span
                >
              </li>
              <li>
                <strong>Eigene Instanz als Relay-Server:</strong>
                Trage die URL dieser Instanz <em>nicht</em> als Relay-Ziel-URL ein. Eine Instanz
                kann nur dann als Relay für andere Instanzen dienen, wenn auf dem Server
                <code>FEEDBACK_RELAY_ENABLED=true</code> konfiguriert ist und ein GitHub-Token
                hinterlegt ist.
              </li>
            </ul>
            <Alert variant="info" size="sm">
              <strong>Empfohlene Standardkonfiguration:</strong>
              Relay aktiviert lassen, Relay-URL auf dem Standard belassen und kein GitHub-Token
              eintragen. So funktioniert das Feedback-System ohne jeglichen Konfigurationsaufwand.
            </Alert>
          </div>
        </CollapsibleFieldset>

        <div class="form-grid">
          <div class="form-group">
            <div class="label-with-info">
              <label for="fb-repo">GitHub Repository</label>
              <InfoPopover
                title="Informationen zum GitHub-Repository"
                aria-label="Informationen zum GitHub-Repository"
                :icon-size="14"
                :menu-width="320"
              >
                <div class="info-popover-text">
                  <p><strong>Standard:</strong> <code>dmstern/reisotor</code></p>
                  <p>
                    Das Ziel-Repository, in dem neue Fehler- und Verbesserungsmeldungen als
                    GitHub-Issues angelegt werden.
                  </p>
                  <p>
                    <strong>Empfehlung:</strong> Belasse den Standard, es sei denn, du pflegst einen
                    eigenen Fork. Eigene Repositories erfordern zwingend einen eigenen GitHub
                    Personal Access Token.
                  </p>
                </div>
              </InfoPopover>
            </div>
            <Input id="fb-repo" v-model="feedbackForm.githubRepo" placeholder="dmstern/reisotor" />
          </div>

          <div class="form-group">
            <div class="label-with-badge">
              <div class="label-with-info">
                <label for="fb-token">GitHub Personal Access Token (PAT)</label>
                <InfoPopover
                  title="Informationen zum GitHub Personal Access Token"
                  aria-label="Informationen zum GitHub Personal Access Token"
                  :icon-size="14"
                  :menu-width="320"
                >
                  <div class="info-popover-text">
                    <p><strong>Standard:</strong> Kein Token erforderlich.</p>
                    <p>
                      Solange das Feedback-Relay aktiv ist, werden Meldungen ohne eigenen Token
                      übermittelt.
                    </p>
                    <p>
                      <strong>Wann nötig?</strong> Nur wenn du Meldungen direkt in ein eigenes
                      Repository leiten oder selbst einen Relay-Server betreiben möchtest.
                    </p>
                    <p class="field-hint">
                      Berechtigungen: Fine-grained PAT mit Rechten für
                      <em>Issues (Read &amp; Write)</em> und
                      <em>Contents (Read &amp; Write)</em> für Screenshots.
                    </p>
                  </div>
                </InfoPopover>
              </div>
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
            <CheckboxCard
              id="fb-relay-forwarding"
              v-model="feedbackForm.feedbackRelayForwarding"
              label="Feedback-Relay nutzen"
              description="Wenn kein eigener GitHub-Token hinterlegt ist, werden Meldungen transparent an den zentralen Relay-Dienst weitergeleitet."
            />
          </div>

          <div v-if="feedbackForm.feedbackRelayForwarding" class="form-group full-width">
            <div class="label-with-info">
              <label for="fb-relay-url">Relay-Ziel-URL</label>
              <InfoPopover
                title="Informationen zur Relay-Ziel-URL"
                aria-label="Informationen zur Relay-Ziel-URL"
                :icon-size="14"
                :menu-width="320"
              >
                <div class="info-popover-text">
                  <p>
                    <strong>Standard:</strong>
                    <code>https://reise.ruebenherz.de/api/feedback/relay</code>
                  </p>
                  <p>
                    Der zentrale Relay-Dienst nimmt Feedback von Community-Instanzen entgegen und
                    erstellt die Issues im offiziellen Reisotor-Repository.
                  </p>
                  <p>
                    <strong>Wichtig:</strong> Trage hier nicht die URL deiner eigenen Instanz ein,
                    es sei denn, diese fungiert als eigenständiger Relay-Server mit konfiguriertem
                    GitHub-Token.
                  </p>
                </div>
              </InfoPopover>
            </div>
            <Input
              id="fb-relay-url"
              type="url"
              v-model="feedbackForm.feedbackRelayUrl"
              placeholder="https://reise.ruebenherz.de/api/feedback/relay"
            />
          </div>
        </div>

        <Alert
          v-if="isRelayPointingToCurrentHost && !isEffectiveGithubTokenSet"
          variant="warning"
          size="sm"
          class="feedback-alert"
          title="Eigene Instanz-URL als Relay ohne GitHub-Token"
        >
          Du hast die URL dieser Reisotor-Instanz als Relay-Ziel eingetragen, aber auf diesem Server
          ist kein GitHub-Token (PAT) hinterlegt. Eine Instanz kann Feedback nur an GitHub
          weiterleiten, wenn sie selbst über einen konfigurierten GitHub-Token verfügt. Wenn du
          Feedback direkt auf dieser Instanz verarbeiten möchtest, hinterlege oben deinen
          GitHub-Token (PAT) und deaktiviere das Relay.
        </Alert>

        <Alert
          v-else-if="
            feedbackForm.githubRepo.trim() !== 'dmstern/reisotor' &&
            !isEffectiveGithubTokenSet &&
            feedbackForm.feedbackRelayForwarding
          "
          variant="warning"
          size="sm"
          class="feedback-alert"
          title="Eigenes Repository erfordert GitHub-Token"
        >
          Du hast als Ziel-Repository „{{ feedbackForm.githubRepo }}“ eingetragen, nutzt aber das
          zentrale Relay ohne eigenen GitHub-Token. Das zentrale Feedback-Relay
          (<code>https://reise.ruebenherz.de/api/feedback/relay</code>) besitzt nur Schreibrechte
          für das offizielle Upstream-Projekt <code>dmstern/reisotor</code>. Für eigene Repositories
          muss oben ein eigener GitHub Personal Access Token (PAT) hinterlegt werden.
        </Alert>

        <Alert
          v-else-if="feedbackForm.feedbackRelayForwarding && !feedbackForm.feedbackRelayUrl.trim()"
          variant="warning"
          size="sm"
          class="feedback-alert"
          title="Keine Relay-Ziel-URL angegeben"
        >
          Das Feedback-Relay ist aktiviert, aber das URL-Feld ist leer. Bitte trage die Standard-URL
          (<code>https://reise.ruebenherz.de/api/feedback/relay</code>) ein oder deaktiviere das
          Relay.
        </Alert>

        <Alert
          v-else-if="!feedbackForm.feedbackRelayForwarding && !isEffectiveGithubTokenSet"
          variant="warning"
          size="sm"
          class="feedback-alert"
          title="In-App-Feedback deaktiviert"
        >
          Das Feedback-Relay ist deaktiviert und es ist kein GitHub-Token hinterlegt. Nutzer:innen
          können über das In-App-Formular keine Meldungen einreichen. Aktiviere das Relay
          (empfohlen) oder trage oben einen GitHub-Token ein.
        </Alert>

        <Alert
          v-else-if="isEffectiveGithubTokenSet"
          variant="info"
          size="sm"
          class="feedback-alert"
          title="Direkte GitHub-Anbindung aktiv"
        >
          Es ist ein eigener GitHub-Token hinterlegt. Neue Meldungen werden direkt über die
          GitHub-API im Repository <code>{{ feedbackForm.githubRepo }}</code> als Issue angelegt.
          Das Feedback-Relay wird in dieser Betriebsart umgangen.
        </Alert>

        <div class="section-actions">
          <Button
            variant="primary"
            size="sm"
            :loading="savingSection === 'feedback'"
            @click="saveFeedback"
          >
            <AppIcon :icon="ACTION_ICONS.save" :size="14" group="actions" /> Speichern
          </Button>
          <Button
            v-if="canResetFeedbackDefaults"
            variant="ghost"
            size="sm"
            @click="resetFeedbackToDefaults"
          >
            <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Auf Standard
            zurücksetzen
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

        <CollapsibleFieldset
          :icon="ACTION_ICONS.info"
          label="Was ist VAPID und wie erstelle ich die Schlüssel?"
          class="push-guide-fieldset"
        >
          <div class="push-guide-content">
            <p>
              <strong>Was ist VAPID?</strong><br />
              VAPID (<em>Voluntary Application Server Identification</em>) ist der offizielle
              W3C-Standard für Web Push. Er ermöglicht es Reisotor, Push-Benachrichtigungen direkt
              über die offenen Push-Dienste der Browser (Mozilla Firefox, Google Chrome, Apple
              Safari etc.) an Smartphones und Desktops zu senden –
              <strong>ohne externe Plattformkonten</strong> (wie Google Firebase oder Apple
              Developer Account), ohne Drittanbieter-Tracking und völlig kostenlos.
            </p>
            <p>
              <strong>Wie komme ich an die Schlüssel?</strong>
            </p>
            <ul>
              <li>
                <strong>1-Klick-Generierung (Empfohlen):</strong>
                Klicke einfach unten auf den Button <em>„Neue VAPID-Schlüssel generieren“</em>.
                Reisotor erzeugt das kryptografische Schlüsselpaar (Public Key und Private Key)
                sofort automatisch auf dem Server. Klicke danach auf <em>„Speichern“</em> – fertig!
              </li>
              <li>
                <strong>Manuell per Terminal / CLI:</strong>
                Alternativ kannst du Schlüssel auf der Server-Kommandozeile mit
                <code>npx web-push generate-vapid-keys</code> generieren und entweder hier in die
                Felder eintragen oder als <code>VAPID_PUBLIC_KEY</code> und
                <code>VAPID_PRIVATE_KEY</code> in der Server-<code>.env</code> hinterlegen.
              </li>
              <li>
                <strong>VAPID Subject:</strong>
                Eine administrative Kontaktadresse (z. B.
                <code>mailto:admin@deine-domain.de</code> oder deine Website-URL). Die Push-Dienste
                der Browserhersteller nutzen diese Angabe im seltenen Fall technischer Rückfragen.
              </li>
            </ul>
            <Alert variant="info" size="sm">
              <strong>Hinweis bei Schlüsselwechsel:</strong>
              Werden neue VAPID-Schlüssel generiert, verlieren bestehende Push-Abonnements im
              Browser ihre Gültigkeit. Bereits verbundene Geräte müssen Benachrichtigungen im
              Nutzerprofil einmalig kurz deaktivieren und neu aktivieren.
            </Alert>
          </div>
        </CollapsibleFieldset>

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
            <span class="field-hint">
              Wird an Browser übertragen, damit diese Push-Mitteilungen für diese Instanz
              autorisieren.
            </span>
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
            <span class="field-hint">
              Verbleibt sicher auf dem Server und signiert ausgehende Push-Mitteilungen
              kryptografisch.
            </span>
          </div>

          <div class="form-group">
            <label for="push-subject">VAPID Kontakt-E-Mail oder URL (Subject)</label>
            <Input
              id="push-subject"
              v-model="pushForm.vapidSubject"
              placeholder="mailto:admin@example.com"
            />
            <span class="field-hint">
              Kontaktadresse für Push-Dienste der Browserhersteller (z. B.
              <code>mailto:admin@deine-domain.de</code>).
            </span>
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

.mode-option :deep(.radio) {
  margin-top: 2px;
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

.reg-email-alert {
  margin-top: var(--space-2);
  margin-bottom: var(--space-3);
}

.reg-email-link {
  color: inherit;
  font-weight: var(--font-weight-bold);
  text-decoration: underline;
  text-underline-offset: 2px;
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
  border-top: 1px solid var(--color-border);
}

.save-success-msg {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-success);
  font-weight: 500;
}

.test-email-alert {
  margin-top: var(--space-3);
}

.smtp-guide-fieldset,
.feedback-guide-fieldset,
.push-guide-fieldset,
.geo-guide-fieldset {
  margin-bottom: var(--space-4);
}

.smtp-guide-content,
.feedback-guide-content,
.push-guide-content,
.geo-guide-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.smtp-guide-content p,
.feedback-guide-content p,
.push-guide-content p,
.geo-guide-content p {
  margin: 0;
}

.smtp-guide-content ul,
.feedback-guide-content ul,
.push-guide-content ul,
.geo-guide-content ul {
  margin: 0;
  padding-left: var(--space-4);
}

.smtp-guide-content li,
.feedback-guide-content li,
.push-guide-content li,
.geo-guide-content li {
  margin-bottom: var(--space-2);
}

.smtp-guide-content code,
.feedback-guide-content code,
.push-guide-content code,
.geo-guide-content code {
  font-family: var(--font-mono, monospace);
  font-size: 0.9em;
  padding: 1px 4px;
  background: var(--color-surface-elevated, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-xs, 4px);
  border: 1px solid var(--color-border);
}

.smtp-guide-content a,
.feedback-guide-content a,
.push-guide-content a,
.geo-guide-content a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.label-with-info {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.info-popover-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.info-popover-text p {
  margin: 0;
}

.info-popover-text code {
  font-family: var(--font-mono, monospace);
  font-size: 0.9em;
  padding: 1px 4px;
  background: var(--color-surface-elevated, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-xs, 4px);
  border: 1px solid var(--color-border);
}

.feedback-alert {
  margin-top: var(--space-2);
  margin-bottom: var(--space-3);
}

.guide-note {
  display: inline-block;
  font-size: 0.9em;
  color: var(--color-text-muted);
}
</style>
