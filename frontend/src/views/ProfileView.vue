<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useNavConfigStore } from '../stores/navConfig';
import { NAV_LINKS } from '../utils/navLinks';
import { useDashboardConfigStore } from '../stores/dashboardConfig';
import { DASHBOARD_TILES } from '../utils/dashboardTiles';
import { useIsDesktop } from '../composables/useIsDesktop';
import { useWeatherProviderStore, WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import { useHomeCurrencyStore, HOME_CURRENCY_OPTIONS } from '../stores/homeCurrency';
import { useCalendarSettingsStore, WEEK_START_OPTIONS, DATE_FORMAT_OPTIONS } from '../stores/calendarSettings';
import { useUiSettingsStore } from '../stores/uiSettings';
import { getExistingSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../utils/push';
import { useNotificationPreferencesStore } from '../stores/notificationPreferences';
import {
  NOTIFICATION_DOMAIN_META,
  NOTIFICATION_DOMAINS,
  NOTIFICATION_LEVEL_OPTIONS,
  type NotificationLevel,
} from '../utils/notificationPreferences';
import { toLocalDateString } from '../utils/dateFormat';
import PasswordInput from '../components/PasswordInput.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const navPosition = useNavPositionStore();
const navConfig = useNavConfigStore();
const isDesktop = useIsDesktop();
const dashboardConfig = useDashboardConfigStore();

// Themengruppen statt einer langen, gleichrangigen Karten-Liste (Nutzer-Feedback) - gleiches Muster
// wie ListenView.vue (Packliste/Einkauf/ToDo): aktiver Tab steckt im Query-Param, nicht im Pfad
// (router.replace statt push, damit Tab-Klicks nicht einzeln in die Browser-History wandern).
// Anders als bei ListenView.vue sind die Tab-Inhalte hier reine Template-Blöcke derselben
// Komponente statt eigener Kind-Komponenten - das bestehende einzelne onMounted() unten lädt
// weiterhin alles unabhängig vom aktiven Tab, die v-ifs zeigen nur, was davon gerade sichtbar ist.
type Tab = 'account' | 'app' | 'trip' | 'notifications' | 'data' | 'about';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'account', label: 'Account', icon: '👤' },
  { key: 'app', label: 'App-Einstellungen', icon: '🖥️' },
  { key: 'trip', label: 'Reise-Anzeige', icon: '📅' },
  { key: 'notifications', label: 'Benachrichtigungen', icon: '🔔' },
  { key: 'data', label: 'Daten', icon: '🗄️' },
  { key: 'about', label: 'Über', icon: 'ℹ️' },
];
const TAB_KEYS = TABS.map((t) => t.key);

const activeTab = computed<Tab>(() => {
  const tab = route.query.tab;
  return (TAB_KEYS as string[]).includes(tab as string) ? (tab as Tab) : 'account';
});

function selectTab(tab: Tab) {
  router.replace({ query: { ...route.query, tab } });
}

function navLinkLabel(key: string) {
  return NAV_LINKS.find((l) => l.key === key)?.label ?? key;
}
function navLinkIcon(key: string) {
  return NAV_LINKS.find((l) => l.key === key)?.icon ?? '';
}
function dashboardTileLabel(key: string) {
  return DASHBOARD_TILES.find((t) => t.key === key)?.label ?? key;
}
function dashboardTileIcon(key: string) {
  return DASHBOARD_TILES.find((t) => t.key === key)?.icon ?? '';
}
const weatherProvider = useWeatherProviderStore();
const homeCurrency = useHomeCurrencyStore();
const calendarSettings = useCalendarSettingsStore();
const uiSettings = useUiSettingsStore();
const loading = ref(true);

interface BuildInfo {
  version: string | null;
  ref: string | null;
  builtAt: string | null;
}
const backendBuildInfo = ref<BuildInfo | null>(null);
const buildTimeFormatter = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
function formatBuildTime(iso: string | null) {
  return iso ? buildTimeFormatter.format(new Date(iso)) : 'unbekannt';
}
// Lokale Bindings statt der globalen __APP_*__-Konstanten direkt im Template: vue-tsc's
// Template-Typprüfung löst per `define` gebackene Ambient-Globals dort nicht auf (versucht sie
// stattdessen als Property der Komponenteninstanz zu finden).
const frontendVersion = __APP_VERSION__;
const frontendCommit = __APP_COMMIT__;
const frontendBuiltAt = __APP_BUILT_AT__;

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Menschen',
    emojis: [
      '🙂', '😎', '🥳', '😄', '🤓', '🥸', '🧑', '👩', '👨', '🧑‍🦱',
      '👩‍🦰', '🧑‍🦳', '🧔', '👵', '👴', '🧑‍🚀', '🧑‍🎤', '🧑‍🍳', '🥷', '🧙',
    ],
  },
  {
    label: 'Tiere',
    emojis: [
      '🐨', '🦊', '🐢', '🦁', '🐸', '🐧', '🐶', '🐱', '🐼', '🐰',
      '🦄', '🐙', '🦉', '🐝', '🦋', '🐳', '🐬', '🦖', '🐺', '🦔',
      '🐷', '🐮', '🐵', '🦒', '🐘', '🦓', '🦩', '🐌', '🐊', '🦈',
      '🦥', '🦦', '🦡', '🐿️', '🦫', '🦭', '🐡', '🦑', '🦜', '🦚',
      '🐴', '🦌', '🐯', '🦍', '🐔',
    ],
  },
  {
    label: 'Fabelwesen & Berufe',
    emojis: [
      '🧙‍♀️', '🧙‍♂️', '🧚', '🧝', '🧞', '🧜', '🧛', '🧟', '🦸', '🦹', '🐉',
      '🧑‍⚕️', '🧑‍🚒', '👮', '🧑‍🌾', '🧑‍🏫', '🧑‍💻', '🧑‍🎨', '🧑‍✈️', '🧑‍🔧', '🧑‍⚖️',
    ],
  },
];

const avatarSaving = ref(false);
const avatarSaved = ref(false);

const usernameForm = ref({ username: '' });
const usernameError = ref('');
const usernameSaved = ref(false);
const usernameSaving = ref(false);

const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
const passwordError = ref('');
const passwordSaved = ref(false);
const passwordSaving = ref(false);

const pushSupported = isPushSupported();
// null = wird noch geprüft, sonst tatsächlicher Abo-Status beim Browser (nicht nur ein lokaler
// Toggle-Zustand, da das Abo z. B. auch über die Browser-Einstellungen widerrufen worden sein kann).
const pushEnabled = ref<boolean | null>(null);
const pushLoading = ref(false);
const pushError = ref('');
const showPushDetails = ref(false);
const notificationPrefs = useNotificationPreferencesStore();

// Segmented-Control-Wert: 'off' bei fehlendem Abo, sonst die Stufe, die exakt zu den aktuellen
// Einzel-Präferenzen passt - passt keine der drei Presets (individuell angepasst), matched nichts
// in PUSH_LEVEL_TOGGLE_OPTIONS und die Toggle zeigt bewusst keinen aktiven Zustand.
const pushLevelValue = computed(() => (pushEnabled.value ? (notificationPrefs.currentLevel ?? 'custom') : 'off'));
const PUSH_LEVEL_TOGGLE_OPTIONS = [{ value: 'off', label: 'Aus' }, ...NOTIFICATION_LEVEL_OPTIONS];

/** Bei "Aus" wird komplett abbestellt; bei jeder anderen Stufe wird (falls noch nicht geschehen)
 *  zuerst abonniert und danach die zugehörige Preset-Kombination aus Einzel-Präferenzen gesetzt -
 *  ein frisches Abo landet so direkt bei "Ausgewogen" statt ungefiltert bei "Alles". */
async function selectPushLevel(level: string) {
  pushError.value = '';
  pushLoading.value = true;
  try {
    if (level === 'off') {
      await unsubscribeFromPush();
      pushEnabled.value = false;
    } else {
      if (!pushEnabled.value) {
        await subscribeToPush();
        pushEnabled.value = true;
      }
      await notificationPrefs.applyLevel(level as NotificationLevel);
    }
  } catch (err) {
    pushError.value = err instanceof Error ? err.message : 'Push-Benachrichtigungen konnten nicht geändert werden';
  } finally {
    pushLoading.value = false;
  }
}

async function setDomainPreference(domain: (typeof NOTIFICATION_DOMAINS)[number], enabled: boolean) {
  await notificationPrefs.update({ [domain]: enabled });
}

const exporting = ref(false);
const exportError = ref('');
const importing = ref(false);
const importError = ref('');
const importResult = ref<Record<string, number> | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  usernameForm.value.username = auth.user?.username ?? '';
  loading.value = false;
  backendBuildInfo.value = await api.get<BuildInfo>('/build-info');
  if (pushSupported) {
    pushEnabled.value = !!(await getExistingSubscription());
    if (pushEnabled.value) await notificationPrefs.load();
  }
});

async function changeUsername() {
  usernameError.value = '';
  usernameSaved.value = false;
  if (!usernameForm.value.username.trim()) return;
  usernameSaving.value = true;
  try {
    const updated = await api.put<User>('/users/me/username', { username: usernameForm.value.username.trim() });
    if (auth.user) auth.user.username = updated.username;
    usernameSaved.value = true;
  } catch (err) {
    usernameError.value = err instanceof ApiError ? err.message : 'Benutzername konnte nicht geändert werden';
  } finally {
    usernameSaving.value = false;
  }
}

async function logout() {
  await auth.logout();
  router.push('/login');
}

async function selectAvatar(avatar: string) {
  avatarSaving.value = true;
  avatarSaved.value = false;
  try {
    const updated = await api.put<User>('/users/me/avatar', { avatar });
    if (auth.user) auth.user.avatar = updated.avatar;
    avatarSaved.value = true;
  } finally {
    avatarSaving.value = false;
  }
}

async function changePassword() {
  passwordError.value = '';
  passwordSaved.value = false;
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'Neue Passwörter stimmen nicht überein';
    return;
  }
  passwordSaving.value = true;
  try {
    await api.put('/users/me/password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    passwordSaved.value = true;
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (err) {
    passwordError.value = err instanceof ApiError ? err.message : 'Passwort konnte nicht geändert werden';
  } finally {
    passwordSaving.value = false;
  }
}

async function exportBackup() {
  exportError.value = '';
  exporting.value = true;
  try {
    const res = await fetch('/api/backup/export', { credentials: 'include' });
    if (!res.ok) throw new Error('Export fehlgeschlagen');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reisotor-backup-${toLocalDateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    exportError.value = 'Export fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    exporting.value = false;
  }
}

function triggerImportPicker() {
  importError.value = '';
  importResult.value = null;
  importFileInput.value?.click();
}

async function onImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  importError.value = '';
  importResult.value = null;

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    importError.value = 'Datei ist kein gültiges JSON.';
    return;
  }

  const confirmed = window.confirm(
    'Import überschreibt ALLE aktuellen Daten (Urlaub, Kalender, Packlisten, Touren, Unterkünfte, Budget, Nutzer) unwiderruflich mit dem Inhalt der Datei. Fortfahren?',
  );
  if (!confirmed) return;

  importing.value = true;
  try {
    const result = await api.post<{ imported: Record<string, number> }>('/backup/import', payload);
    importResult.value = result.imported;
    window.setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    importError.value = err instanceof ApiError ? err.message : 'Import fehlgeschlagen.';
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Profil</h1>

    <div class="tab-bar" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="tab"
        role="tab"
        :class="{ active: activeTab === tab.key }"
        :aria-selected="activeTab === tab.key"
        @click="selectTab(tab.key)"
      >
        <span class="icon">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'account'">
      <div class="card">
        <div class="header">
          <h2>{{ auth.user?.avatar }} {{ auth.user?.username }}</h2>
          <button type="button" class="secondary" @click="logout">🚪 Abmelden</button>
        </div>

        <form class="form username-form" @submit.prevent="changeUsername">
          <label>
            Benutzername
            <input v-model="usernameForm.username" type="text" required />
          </label>
          <p v-if="usernameError" class="hint error">{{ usernameError }}</p>
          <p v-if="usernameSaved" class="hint success">Benutzername geändert ✓</p>
          <button type="submit" :disabled="usernameSaving">
            {{ usernameSaving ? 'Speichern…' : 'Benutzername speichern' }}
          </button>
        </form>

        <p>Avatar wählen</p>
        <div class="emoji-scroll">
          <div v-for="cat in EMOJI_CATEGORIES" :key="cat.label" class="emoji-category">
            <p class="emoji-category-label">{{ cat.label }}</p>
            <div class="emoji-grid">
              <button
                v-for="emoji in cat.emojis"
                :key="emoji"
                type="button"
                class="emoji-btn secondary"
                :class="{ active: emoji === auth.user?.avatar }"
                :disabled="avatarSaving"
                @click="selectAvatar(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>
        <p v-if="avatarSaved" class="hint success">Gespeichert ✓</p>
      </div>

      <div class="card">
        <h2>Passwort ändern</h2>
        <form class="form" @submit.prevent="changePassword">
          <div class="field">
            <label for="profile-current-password">Aktuelles Passwort</label>
            <PasswordInput
              id="profile-current-password"
              v-model="passwordForm.currentPassword"
              autocomplete="current-password"
              required
            />
          </div>
          <div class="field">
            <label for="profile-new-password">Neues Passwort</label>
            <PasswordInput
              id="profile-new-password"
              v-model="passwordForm.newPassword"
              autocomplete="new-password"
              minlength="6"
              required
            />
          </div>
          <div class="field">
            <label for="profile-confirm-password">Neues Passwort bestätigen</label>
            <PasswordInput
              id="profile-confirm-password"
              v-model="passwordForm.confirmPassword"
              autocomplete="new-password"
              minlength="6"
              required
            />
          </div>
          <p v-if="passwordError" class="hint error">{{ passwordError }}</p>
          <p v-if="passwordSaved" class="hint success">Passwort geändert ✓</p>
          <button type="submit" :disabled="passwordSaving">
            {{ passwordSaving ? 'Speichern…' : 'Passwort speichern' }}
          </button>
        </form>
      </div>
    </template>

    <template v-if="activeTab === 'app'">
      <div class="card" v-if="!isDesktop">
        <h2>Darstellung</h2>
        <!-- Nur auf mobile: auf Desktop bleibt der Toggle exklusiv im Header (AppHeader.vue), auf
             mobile ist dort seit "alle Mitreisenden statt nur online" (PresenceAvatars.vue) potenziell
             weniger Platz. -->
        <ThemeModeSelect variant="block" />
      </div>

      <div class="card">
        <h2>Navigation</h2>
        <p class="hint">Position der Navigationsleiste, getrennt für Desktop und mobile Bedienung.</p>
        <div class="nav-position-row">
          <label>
            Desktop
            <select v-model="navPosition.desktop">
              <option value="top">Oben</option>
              <option value="bottom">Unten</option>
            </select>
          </label>
          <label>
            Mobil
            <select v-model="navPosition.mobile">
              <option value="top">Oben</option>
              <option value="bottom">Unten</option>
            </select>
          </label>
        </div>

        <p class="hint nav-config-hint">
          Reihenfolge und Sichtbarkeit der übrigen Einträge ("Übersicht" bleibt immer an erster Stelle).
        </p>
        <ul class="nav-config-list">
          <li v-for="(entry, index) in navConfig.entries" :key="entry.key" class="nav-config-row">
            <span class="nav-config-icon">{{ navLinkIcon(entry.key) }}</span>
            <span class="nav-config-label" :class="{ hidden: !entry.visible }">{{ navLinkLabel(entry.key) }}</span>
            <div class="nav-config-actions">
              <button
                type="button"
                class="secondary small"
                :disabled="index === 0"
                aria-label="Nach oben verschieben"
                title="Nach oben verschieben"
                @click="navConfig.moveUp(entry.key)"
              >
                ▲
              </button>
              <button
                type="button"
                class="secondary small"
                :disabled="index === navConfig.entries.length - 1"
                aria-label="Nach unten verschieben"
                title="Nach unten verschieben"
                @click="navConfig.moveDown(entry.key)"
              >
                ▼
              </button>
              <label class="nav-config-visible">
                <input
                  type="checkbox"
                  :checked="entry.visible"
                  :aria-label="`${navLinkLabel(entry.key)} in der Navigation anzeigen`"
                  @change="navConfig.setVisible(entry.key, ($event.target as HTMLInputElement).checked)"
                />
              </label>
            </div>
          </li>
        </ul>
      </div>

      <div class="card">
        <h2>🧩 Dashboard-Kacheln</h2>
        <p class="hint nav-config-hint">Reihenfolge und Sichtbarkeit der Dashboard-Kacheln.</p>
        <!-- Eigene dashboard-config-list/-row-Klassen statt der optisch identischen nav-config-list/
             -row oben (gleiche CSS-Regeln per Komma-Selektor, siehe dort) - sonst würden e2e-
             Selektoren wie .nav-config-row[hasText] auf beide Listen zugleich treffen, sobald ein
             Eintrag denselben Namen trägt (z. B. "Notizen" existiert sowohl als Nav-Eintrag als auch
             als Kachel). Die inneren Icon-/Label-/Actions-Klassen bleiben geteilt - dort scopen beide
             Tests immer erst über die jeweilige äußere Zeilen-Klasse, keine Kollisionsgefahr. -->
        <ul class="dashboard-config-list">
          <li v-for="(entry, index) in dashboardConfig.entries" :key="entry.key" class="dashboard-config-row">
            <span class="nav-config-icon">{{ dashboardTileIcon(entry.key) }}</span>
            <span class="nav-config-label" :class="{ hidden: !entry.visible }">{{ dashboardTileLabel(entry.key) }}</span>
            <div class="nav-config-actions">
              <button
                type="button"
                class="secondary small"
                :disabled="index === 0"
                aria-label="Nach oben verschieben"
                title="Nach oben verschieben"
                @click="dashboardConfig.moveUp(entry.key)"
              >
                ▲
              </button>
              <button
                type="button"
                class="secondary small"
                :disabled="index === dashboardConfig.entries.length - 1"
                aria-label="Nach unten verschieben"
                title="Nach unten verschieben"
                @click="dashboardConfig.moveDown(entry.key)"
              >
                ▼
              </button>
              <label class="nav-config-visible">
                <input
                  type="checkbox"
                  :checked="entry.visible"
                  :aria-label="`${dashboardTileLabel(entry.key)} auf dem Dashboard anzeigen`"
                  @change="dashboardConfig.setVisible(entry.key, ($event.target as HTMLInputElement).checked)"
                />
              </label>
            </div>
          </li>
        </ul>
      </div>

      <div class="card">
        <h2>🏖️ Urlaubs-Hinweis</h2>
        <p class="hint">
          Der Hinweis im Dashboard-Header während des laufenden Urlaubs zeigt standardmäßig immer
          denselben Text - kann hier stattdessen auf einen Countdown der verbleibenden Urlaubstage
          umgeschaltet werden.
        </p>
        <label class="checkbox-option">
          <input type="checkbox" v-model="uiSettings.showVacationCountdown" />
          Verbleibende Urlaubstage anzeigen statt festem Hinweis
        </label>
      </div>
    </template>

    <div v-if="activeTab === 'trip'" class="grid settings-grid">
      <div id="calendar-settings" class="card">
        <h2>📅 Kalender</h2>
        <p class="hint">Wochenanfang und Zahlenformat für Datumsanzeigen in der ganzen App.</p>
        <div class="nav-position-row">
          <label>
            Wochenanfang
            <select v-model="calendarSettings.weekStart">
              <option v-for="option in WEEK_START_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label>
            Datumsformat
            <select v-model="calendarSettings.dateFormat">
              <option v-for="option in DATE_FORMAT_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <!-- id als Sprungziel für den "Anbieter wechseln"-Link im Wetter-Widget (DashboardView.vue) -->
      <div id="weather-provider-settings" class="card">
        <h2>🌤️ Wetter</h2>
        <p class="hint">
          Wettervorhersage über Open-Meteo, das mehrere echte Wetterdienste bündelt. Zeigt eine
          Vorhersage abweichende Werte gegenüber anderen Wetter-Apps (z. B. Apple Weather), lässt sich
          hier ein anderer Anbieter ausprobieren.
        </p>
        <label class="weather-provider-label">
          Wettermodell
          <select v-model="weatherProvider.model">
            <option v-for="option in WEATHER_MODEL_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" v-model="uiSettings.showHomeWeatherFullTrip" />
          Wetter zuhause für den ganzen Urlaub zeigen (statt nur gegen Ende)
        </label>
      </div>

      <!-- id als Sprungziel, analog zu #weather-provider-settings oben -->
      <div id="home-currency-settings" class="card">
        <h2>💱 Heimatwährung</h2>
        <p class="hint">
          Wird im Dashboard genutzt, um bei Urlauben mit abweichender Landeswährung den aktuellen
          Wechselkurs anzuzeigen.
        </p>
        <label class="weather-provider-label">
          Heimatwährung
          <select v-model="homeCurrency.currency">
            <option v-for="option in HOME_CURRENCY_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <template v-if="activeTab === 'notifications'">
      <div class="card">
        <h2>🔔 Meldungen</h2>
        <p class="hint">
          Kurze Meldungen, die bei jedem Laden/Speichern/Löschen kurz unten am Bildschirmrand
          aufblitzen (z. B. "Speichert…"), damit klar wird, dass die App gerade tatsächlich mit dem
          Server arbeitet statt hängengeblieben zu sein. Wer das zu hektisch findet, kann sie hier
          ausschalten - der dauerhafte Offline-/Update-Hinweis oben im Header bleibt davon unberührt.
        </p>
        <label class="checkbox-option">
          <input type="checkbox" v-model="uiSettings.showActivityToasts" />
          Detaillierte Lade-/Speicher-Meldungen anzeigen
        </label>
      </div>

      <div class="card">
        <h2>🔔 Push-Benachrichtigungen</h2>
        <p class="hint" v-if="!pushSupported">
          Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
        </p>
        <template v-else>
          <p class="hint">
            Benachrichtigt dich, wenn andere Mitglieder eines Urlaubs etwas ändern – auch wenn Reisotor
            gerade nicht offen ist. Über die Stufe lässt sich einstellen, wie viel davon ankommt.
          </p>
          <button
            v-if="pushEnabled === null"
            class="secondary"
            disabled
          >
            Wird geprüft…
          </button>
          <button
            v-else-if="!pushEnabled"
            class="secondary"
            :disabled="pushLoading"
            @click="selectPushLevel('balanced')"
          >
            {{ pushLoading ? 'Wird aktiviert…' : 'Aktivieren' }}
          </button>
          <template v-else>
            <SegmentedToggle
              :model-value="pushLevelValue"
              :options="PUSH_LEVEL_TOGGLE_OPTIONS"
              @update:model-value="selectPushLevel"
            />
            <button type="button" class="secondary small push-details-toggle" @click="showPushDetails = !showPushDetails">
              {{ showPushDetails ? 'Einzeln anpassen ▴' : 'Einzeln anpassen ▾' }}
            </button>
            <ul v-if="showPushDetails" class="nav-config-list push-domain-list">
              <li v-for="domain in NOTIFICATION_DOMAINS" :key="domain" class="nav-config-row push-domain-row">
                <span class="nav-config-icon">{{ NOTIFICATION_DOMAIN_META[domain].icon }}</span>
                <span class="nav-config-label">{{ NOTIFICATION_DOMAIN_META[domain].label }}</span>
                <label class="nav-config-visible">
                  <input
                    type="checkbox"
                    :checked="notificationPrefs.preferences?.[domain] ?? true"
                    :aria-label="`${NOTIFICATION_DOMAIN_META[domain].label}-Push aktiv`"
                    @change="setDomainPreference(domain, ($event.target as HTMLInputElement).checked)"
                  />
                </label>
              </li>
            </ul>
          </template>
          <p v-if="pushError || notificationPrefs.error" class="hint error">{{ pushError || notificationPrefs.error }}</p>
        </template>
      </div>
    </template>

    <template v-if="activeTab === 'data'">
      <div class="card">
        <h2>🗑️ Papierkorb</h2>
        <p class="hint">
          Gelöschte Termine, Ausflüge, Spots und mehr bleiben eine Weile hier erhalten und lassen sich
          wiederherstellen.
        </p>
        <router-link to="/trash" class="card-action-btn">Papierkorb öffnen</router-link>
      </div>

      <div class="card">
        <h2>Datensicherung</h2>
        <p>
          Vor einem Neu-Deployment mit neuen Features könnt ihr hier alle Daten (Urlaub, Kalender,
          Packlisten, Touren, Unterkünfte, Budget, Nutzer) als JSON-Datei sichern und später
          wiederherstellen.
        </p>

        <div class="backup-actions">
          <button class="secondary" :disabled="exporting" @click="exportBackup">
            {{ exporting ? 'Exportiere…' : '⬇️ Backup exportieren' }}
          </button>
          <button class="secondary" :disabled="importing" @click="triggerImportPicker">
            {{ importing ? 'Importiere…' : '⬆️ Backup importieren' }}
          </button>
          <input
            ref="importFileInput"
            type="file"
            accept="application/json"
            class="hidden-input"
            @change="onImportFileSelected"
          />
        </div>

        <p v-if="exportError" class="hint error">{{ exportError }}</p>
        <p v-if="importError" class="hint error">{{ importError }}</p>
        <p v-if="importResult" class="hint success">
          Import erfolgreich ({{ Object.values(importResult).reduce((a, b) => a + b, 0) }} Einträge). Seite
          wird neu geladen…
        </p>
        <p class="hint warning">⚠️ Der Import überschreibt alle aktuellen Daten unwiderruflich.</p>
      </div>
    </template>

    <div class="card build-info-card" v-if="activeTab === 'about'">
      <h2>Build-Info</h2>
      <dl class="build-info-list">
        <dt>Frontend</dt>
        <dd>v{{ frontendVersion }} ({{ frontendCommit }}) · {{ formatBuildTime(frontendBuiltAt) }}</dd>
        <dt>Backend</dt>
        <dd v-if="backendBuildInfo">
          v{{ backendBuildInfo.version }} ({{ backendBuildInfo.ref ?? 'unbekannt' }}) ·
          {{ formatBuildTime(backendBuildInfo.builtAt) }}
        </dd>
        <dd v-else>Lädt…</dd>
      </dl>
    </div>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.page > .card {
  margin-bottom: var(--space-4);
}

/* Tab-Leiste analog zu ListenView.vue's .tab-bar/.tab (eigener, lokal duplizierter Style-Block,
   Vue-Styles gelten nicht komponentenübergreifend) - hier ohne deren max-width/padding, da .page
   (style.css) bereits Breite/Innenabstand der ganzen Seite vorgibt. flex-wrap: wrap zusätzlich zum
   Original nötig, da hier 6 statt Listens 3 Tabs auf schmalen Breiten sonst quetschen/überlaufen
   würden. */
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  cursor: pointer;
}

.tab.active {
  color: var(--color-primary-dark);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.tab .icon {
  font-size: 1.1rem;
}

/* Kleine Karten (nur 1-2 einfache Formfelder: Kalender/Wetter/Heimatwährung) nebeneinander statt
   einspaltig - nutzt die volle .page-Breite besser aus als eine reine Stapelung. Gleiches Muster
   wie ExcursionsView.vue's .cards (repeat(auto-fill, minmax(...))), fällt auf schmalen Breiten
   automatisch auf eine Spalte zurück. */
.settings-grid {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  margin-bottom: var(--space-4);
}

.settings-grid > .card {
  margin-bottom: 0;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  cursor: pointer;
}

.card h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
}

.emoji-scroll {
  max-height: 220px;
  overflow-y: auto;
  margin-top: var(--space-2);
  padding-right: 4px;
}

.emoji-category + .emoji-category {
  margin-top: var(--space-2);
}

.emoji-category-label {
  margin: 0 0 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.emoji-btn {
  font-size: 1.3rem;
  padding: 6px 10px;
  line-height: 1;
}

.emoji-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 360px;
}

.username-form {
  margin-bottom: var(--space-3);
}

.nav-position-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.nav-position-row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.nav-config-hint {
  margin-top: var(--space-3);
}

.nav-config-list,
.dashboard-config-list,
.push-domain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-config-row,
.dashboard-config-row,
.push-domain-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}

.nav-config-row:last-child,
.dashboard-config-row:last-child,
.push-domain-row:last-child {
  border-bottom: none;
}

.push-details-toggle {
  margin-top: var(--space-2);
}

.push-domain-list {
  margin-top: var(--space-2);
}

.nav-config-icon {
  font-size: 1.1rem;
}

.nav-config-label {
  flex: 1;
}

.nav-config-label.hidden {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

.nav-config-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-config-actions .small {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.nav-config-visible {
  display: flex;
  align-items: center;
  margin-left: var(--space-2);
}

.weather-provider-label {
  max-width: 320px;
}

label,
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

.hint.success {
  color: var(--color-success);
}

.hint.error {
  color: var(--color-danger);
}

.hint.warning {
  color: var(--color-accent);
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}

.hidden-input {
  display: none;
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.build-info-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px var(--space-3);
  margin: 0;
  font-size: 0.85rem;
}

.build-info-list dt {
  color: var(--color-text-muted);
}

.build-info-list dd {
  margin: 0;
}
</style>
