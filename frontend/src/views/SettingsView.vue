<script setup lang="ts">
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import Badge from '../components/primitives/Badge.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useConnectivityStore } from '../stores/connectivity';
import { useBuildInfoStore } from '../stores/buildInfo';
import { useNavPositionStore } from '../stores/navPosition';
import { useNavConfigStore } from '../stores/navConfig';
import { NAV_LINKS } from '../utils/navLinks';
import { useDashboardConfigStore } from '../stores/dashboardConfig';
import { DASHBOARD_TILES } from '../utils/dashboardTiles';
import { useIsDesktop } from '../composables/useIsDesktop';
import { useWeatherProviderStore, WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import { useHomeCurrencyStore, HOME_CURRENCY_OPTIONS } from '../stores/homeCurrency';
import {
  useCalendarSettingsStore,
  WEEK_START_OPTIONS,
  DATE_FORMAT_OPTIONS,
} from '../stores/calendarSettings';
import { useUiSettingsStore, TOAST_TIMEOUT_OPTIONS } from '../stores/uiSettings';
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../utils/push';
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
import RichTextDisplay from '../components/RichTextDisplay.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import AppIcon from '../components/AppIcon.vue';
import IconStyleSettings from '../components/IconStyleSettings.vue';
import GlassSettings from '../components/GlassSettings.vue';
import AccentColorSettings from '../components/AccentColorSettings.vue';
import BorderWidthSettings from '../components/BorderWidthSettings.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import FeedbackDialog from '../components/FeedbackDialog.vue';
import PwaInstallDialog from '../components/PwaInstallDialog.vue';
import AppFooterLinks from '../components/AppFooterLinks.vue';
import { usePwaInstallStore } from '../stores/pwaInstall';
import TabBar from '../components/TabBar.vue';
import CreateUserDialog from '../components/CreateUserDialog.vue';
import {
  IconUser,
  IconUserFilled,
  IconUsers,
  IconDeviceDesktop,
  IconBell,
  IconBellFilled,
  IconDatabase,
  IconInfoCircle,
  IconInfoCircleFilled,
  IconPuzzle,
  IconCloud,
  IconBug,
  IconInfoSquareRounded,
} from '@tabler/icons-vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import type { IconDef } from '../utils/icon';

const auth = useAuthStore();
const connectivity = useConnectivityStore();
const router = useRouter();
const route = useRoute();
const navPosition = useNavPositionStore();
const navConfig = useNavConfigStore();
const _isDesktop = useIsDesktop();
const dashboardConfig = useDashboardConfigStore();

// Themengruppen statt einer langen, gleichrangigen Karten-Liste (Nutzer-Feedback) - gleiches Muster
// wie ListenView.vue (Packliste/Einkauf/ToDo): aktiver Tab steckt im Query-Param, nicht im Pfad
// (router.replace statt push, damit Tab-Klicks nicht einzeln in die Browser-History wandern).
// Anders als bei ListenView.vue sind die Tab-Inhalte hier reine Template-Blöcke derselben
// Komponente statt eigener Kind-Komponenten - das bestehende einzelne onMounted() unten lädt
// weiterhin alles unabhängig vom aktiven Tab, die v-ifs zeigen nur, was davon gerade sichtbar ist.
// Bell-/Puzzle-/Wetter-/Käfer-Icon werden mehrfach gebraucht (Tab-Leiste UND einzelne
// Karten-Überschriften weiter unten, siehe #94) - einmal hier definiert statt an jeder Stelle neu.
const BELL_ICON: IconDef = { id: 'bell', emoji: '🔔', outline: IconBell, filled: IconBellFilled };
const DASHBOARD_TILES_ICON: IconDef = { id: 'puzzle', emoji: '🧩', outline: IconPuzzle };
const WEATHER_SECTION_ICON: IconDef = { id: 'cloud', emoji: '🌤️', outline: IconCloud };
const FEEDBACK_ICON: IconDef = { id: 'bug', emoji: '🐛', outline: IconBug };
const INFO_ICON: IconDef = { id: 'info', emoji: 'ℹ️', outline: IconInfoSquareRounded };
const USERS_ICON: IconDef = { id: 'users', emoji: '👥', outline: IconUsers };

type Tab = 'account' | 'users' | 'app' | 'trip' | 'notifications' | 'data' | 'about';
const ALL_TABS: { key: Tab; label: string; icon: IconDef; adminOnly?: boolean }[] = [
  {
    key: 'account',
    label: 'Account',
    icon: { id: 'user', emoji: '👤', outline: IconUser, filled: IconUserFilled },
  },
  { key: 'users', label: 'Nutzerverwaltung', icon: USERS_ICON, adminOnly: true },
  {
    key: 'app',
    label: 'App-Einstellungen',
    icon: { id: 'device-desktop', emoji: '🖥️', outline: IconDeviceDesktop },
  },
  { key: 'trip', label: 'Reise-Anzeige', icon: FORM_FIELD_ICONS.date },
  { key: 'notifications', label: 'Benachrichtigungen', icon: BELL_ICON },
  { key: 'data', label: 'Daten', icon: { id: 'database', emoji: '🗄️', outline: IconDatabase } },
  {
    key: 'about',
    label: 'Über',
    icon: { id: 'info-circle', emoji: 'ℹ️', outline: IconInfoCircle, filled: IconInfoCircleFilled },
  },
];

const TABS = computed(() => ALL_TABS.filter((t) => !t.adminOnly || auth.user?.is_admin));
const TAB_KEYS = computed(() => TABS.value.map((t) => t.key));

const activeTab = computed<Tab>(() => {
  const tab = route.query.tab;
  return (TAB_KEYS.value as string[]).includes(tab as string) ? (tab as Tab) : 'account';
});

function selectTab(tab: string) {
  router.replace({ query: { ...route.query, tab: tab as Tab } });
}

function navLinkLabel(key: string) {
  return NAV_LINKS.find((l) => l.key === key)?.label ?? key;
}
function navLinkIcon(key: string) {
  return NAV_LINKS.find((l) => l.key === key)?.icon ?? null;
}
function dashboardTileLabel(key: string) {
  return DASHBOARD_TILES.find((t) => t.key === key)?.label ?? key;
}
function dashboardTileIcon(key: string) {
  return DASHBOARD_TILES.find((t) => t.key === key)?.icon ?? null;
}
const weatherProvider = useWeatherProviderStore();
const homeCurrency = useHomeCurrencyStore();
const calendarSettings = useCalendarSettingsStore();
const uiSettings = useUiSettingsStore();
const loading = ref(true);
const showFeedbackDialog = ref(false);
const showPwaInstallDialog = ref(false);
const pwaInstall = usePwaInstallStore();

const buildInfoStore = useBuildInfoStore();
const backendBuildInfo = computed(() => buildInfoStore.buildInfo);
const buildTimeFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
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
      '🙂',
      '😎',
      '🥳',
      '😄',
      '🤓',
      '🥸',
      '🧑',
      '👩',
      '👨',
      '🧑‍🦱',
      '👩‍🦰',
      '🧑‍🦳',
      '🧔',
      '👵',
      '👴',
      '🧑‍🚀',
      '🧑‍🎤',
      '🧑‍🍳',
      '🥷',
      '🧙',
    ],
  },
  {
    label: 'Tiere',
    emojis: [
      '🐨',
      '🦊',
      '🐢',
      '🦁',
      '🐸',
      '🐧',
      '🐶',
      '🐱',
      '🐼',
      '🐰',
      '🦄',
      '🐙',
      '🦉',
      '🐝',
      '🦋',
      '🐳',
      '🐬',
      '🦖',
      '🐺',
      '🦔',
      '🐷',
      '🐮',
      '🐵',
      '🦒',
      '🐘',
      '🦓',
      '🦩',
      '🐌',
      '🐊',
      '🦈',
      '🦥',
      '🦦',
      '🦡',
      '🐿️',
      '🦫',
      '🦭',
      '🐡',
      '🦑',
      '🦜',
      '🦚',
      '🐴',
      '🦌',
      '🐯',
      '🦍',
      '🐔',
    ],
  },
  {
    label: 'Fabelwesen & Berufe',
    emojis: [
      '🧙‍♀️',
      '🧙‍♂️',
      '🧚',
      '🧝',
      '🧞',
      '🧜',
      '🧛',
      '🧟',
      '🦸',
      '🦹',
      '🐉',
      '🧑‍⚕️',
      '🧑‍🚒',
      '👮',
      '🧑‍🌾',
      '🧑‍🏫',
      '🧑‍💻',
      '🧑‍🎨',
      '🧑‍✈️',
      '🧑‍🔧',
      '🧑‍⚖️',
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
const pushLevelValue = computed(() =>
  pushEnabled.value ? (notificationPrefs.currentLevel ?? 'custom') : 'off'
);
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
    pushError.value =
      err instanceof Error ? err.message : 'Push-Benachrichtigungen konnten nicht geändert werden';
  } finally {
    pushLoading.value = false;
  }
}

async function setDomainPreference(
  domain: (typeof NOTIFICATION_DOMAINS)[number],
  enabled: boolean
) {
  await notificationPrefs.update({ [domain]: enabled });
}

const exporting = ref(false);
const exportError = ref('');
const importing = ref(false);
const importError = ref('');
const importResult = ref<Record<string, number> | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);

const userList = ref<User[]>([]);
const loadingUsers = ref(false);
const userListError = ref('');
const showCreateUserDialog = ref(false);

async function loadUserList() {
  if (!auth.user?.is_admin) return;
  loadingUsers.value = true;
  userListError.value = '';
  try {
    userList.value = await api.get<User[]>('/users');
  } catch (err) {
    if (err instanceof ApiError) userListError.value = err.message;
    else userListError.value = 'Fehler beim Laden der Nutzerliste.';
  } finally {
    loadingUsers.value = false;
  }
}

async function toggleAdminRole(u: User) {
  const nextIsAdmin = !u.is_admin;
  try {
    const updated = await api.put<User>(`/users/${u.id}/admin`, { is_admin: nextIsAdmin });
    const idx = userList.value.findIndex((item) => item.id === u.id);
    if (idx !== -1) userList.value[idx] = updated;
  } catch (err) {
    alert(err instanceof ApiError ? err.message : 'Fehler beim Ändern der Admin-Rechte');
  }
}

async function deleteUserAccount(u: User) {
  if (u.id === auth.user?.id) return;
  if (!confirm(`Möchtest du den Nutzer "${u.username}" wirklich löschen?`)) return;
  try {
    await api.delete(`/users/${u.id}`);
    userList.value = userList.value.filter((item) => item.id !== u.id);
  } catch (err) {
    alert(err instanceof ApiError ? err.message : 'Fehler beim Löschen des Nutzers');
  }
}

function onUserCreated(newUser: User) {
  userList.value.push(newUser);
}

watch(activeTab, (tab) => {
  if (tab === 'users' && auth.user?.is_admin) loadUserList();
});

onMounted(async () => {
  usernameForm.value.username = auth.user?.username ?? '';
  loading.value = false;
  buildInfoStore.load();
  if (auth.user?.is_admin && activeTab.value === 'users') loadUserList();
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
    const updated = await api.put<User>('/users/me/username', {
      username: usernameForm.value.username.trim(),
    });
    if (auth.user) auth.user.username = updated.username;
    usernameSaved.value = true;
  } catch (err) {
    usernameError.value =
      err instanceof ApiError ? err.message : 'Benutzername konnte nicht geändert werden';
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
    passwordError.value =
      err instanceof ApiError ? err.message : 'Passwort konnte nicht geändert werden';
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
    'Import überschreibt ALLE aktuellen Daten (Urlaub, Kalender, Packlisten, Touren, Unterkünfte, Budget, Nutzer) unwiderruflich mit dem Inhalt der Datei. Fortfahren?'
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
    <h1>Einstellungen</h1>

    <div class="tab-bar-wrap">
      <TabBar :tabs="TABS" :active-key="activeTab" @select="selectTab" />
    </div>

    <template v-if="activeTab === 'account'">
      <div class="card">
        <div class="header account-header">
          <div class="user-info">
            <div class="name-and-status">
              <h2>{{ auth.user?.avatar }} {{ auth.user?.username }}</h2>
              <div
                class="status-badge"
                :class="{
                  online: connectivity.isOnline && !connectivity.syncing && !connectivity.checking,
                  retrying: connectivity.syncing || connectivity.checking,
                  offline: !connectivity.isOnline,
                }"
              >
                <span class="status-dot"></span>
                <span class="status-text">
                  <template
                    v-if="connectivity.isOnline && !connectivity.syncing && !connectivity.checking"
                    >Online</template
                  >
                  <template v-else-if="connectivity.syncing || connectivity.checking"
                    >Verbinde…</template
                  >
                  <template v-else>Offline</template>
                </span>
              </div>
              <Button
                v-if="!connectivity.isOnline"
                size="sm"
                variant="secondary"
                :disabled="connectivity.checking"
                @click="connectivity.checkNow()"
                class="retry-btn"
              >
                <AppIcon
                  :icon="connectivity.checking ? ACTION_ICONS.refresh : ACTION_ICONS.offline"
                  :size="14"
                  group="actions"
                />
                {{ connectivity.checking ? 'Prüfe…' : 'Jetzt prüfen' }}
              </Button>
              <Button
                v-if="connectivity.pendingCount > 0"
                size="sm"
                variant="secondary"
                :disabled="connectivity.syncing"
                @click="connectivity.syncNow()"
                class="pending-sync-btn"
                :title="
                  connectivity.syncing
                    ? 'Synchronisiere…'
                    : 'Ausstehende Änderungen jetzt synchronisieren'
                "
              >
                <AppIcon
                  :icon="ACTION_ICONS.syncPending"
                  :size="14"
                  group="actions"
                  :class="{ 'is-spinning': connectivity.syncing }"
                />
                {{
                  connectivity.syncing
                    ? 'Synchronisiere…'
                    : `${connectivity.pendingCount} ausstehend`
                }}
              </Button>
            </div>
            <p v-if="!connectivity.isOnline" class="offline-description hint">
              Änderungen werden lokal gespeichert. Die App versucht alle 6 Sekunden automatisch,
              sich wieder zu verbinden.
            </p>
            <p v-else-if="connectivity.pendingCount > 0" class="pending-description hint">
              {{ connectivity.pendingCount }}
              {{ connectivity.pendingCount === 1 ? 'Änderung ist' : 'Änderungen sind' }}
              noch nicht mit dem Server synchronisiert.
            </p>
          </div>
          <Button type="button" variant="secondary" @click="logout" class="logout-btn">
            <AppIcon :icon="ACTION_ICONS.logout" :size="14" group="actions" /> Abmelden
          </Button>
        </div>

        <form class="form username-form" @submit.prevent="changeUsername">
          <label for="auto-id-1788301175449-26">
            Benutzername
            <input
              id="auto-id-1788301175449-26"
              v-model="usernameForm.username"
              type="text"
              required
            />
          </label>
          <p v-if="usernameError" class="hint error">{{ usernameError }}</p>
          <p v-if="usernameSaved" class="hint success">
            Benutzername geändert <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          </p>
          <Button type="submit" :disabled="usernameSaving">
            {{ usernameSaving ? 'Speichern…' : 'Benutzername speichern' }}
          </Button>
        </form>

        <h3>Avatar wählen</h3>
        <div class="emoji-scroll">
          <div v-for="cat in EMOJI_CATEGORIES" :key="cat.label" class="emoji-category">
            <p class="emoji-category-label">{{ cat.label }}</p>
            <div class="emoji-grid">
              <IconButton
                v-for="emoji in cat.emojis"
                :key="emoji"
                variant="ghost"
                :active="emoji === auth.user?.avatar"
                :disabled="avatarSaving"
                :aria-label="`Avatar ${emoji} auswählen`"
                :title="`Avatar ${emoji}`"
                @click="selectAvatar(emoji)"
              >
                {{ emoji }}
              </IconButton>
            </div>
          </div>
        </div>
        <p v-if="avatarSaved" class="hint success">
          Gespeichert <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
        </p>
      </div>

      <div class="card">
        <h2>Passwort ändern</h2>
        <form class="form" @submit.prevent="changePassword">
          <div class="field">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label for="profile-current-password">Aktuelles Passwort</label>
            <PasswordInput
              id="profile-current-password"
              v-model="passwordForm.currentPassword"
              autocomplete="current-password"
              required
            />
          </div>
          <div class="field">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
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
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
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
          <p v-if="passwordSaved" class="hint success">
            Passwort geändert <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          </p>
          <Button type="submit" :disabled="passwordSaving">
            {{ passwordSaving ? 'Speichern…' : 'Passwort speichern' }}
          </Button>
        </form>
      </div>
    </template>

    <template v-if="activeTab === 'users' && auth.user?.is_admin">
      <div class="card users-card">
        <div class="card-header-row">
          <h2><AppIcon :icon="USERS_ICON" group="navigation" :size="20" /> Nutzerverwaltung</h2>
          <Button variant="primary" size="sm" @click="showCreateUserDialog = true">
            <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Nutzer anlegen
          </Button>
        </div>

        <p v-if="userListError" class="hint error">{{ userListError }}</p>
        <ViewLoadingState v-if="loadingUsers" message="Lade Nutzerliste…" />

        <div v-else-if="userList.length" class="users-table-wrapper">
          <table class="users-table">
            <thead>
              <tr>
                <th>Nutzer</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Status</th>
                <th class="actions-col">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in userList" :key="u.id">
                <td>
                  <div class="user-cell">
                    <span class="user-avatar">{{ u.avatar }}</span>
                    <span class="username">{{ u.username }}</span>
                  </div>
                </td>
                <td class="email-cell">{{ u.email || '—' }}</td>
                <td>
                  <Badge :variant="u.is_admin ? 'accent-secondary' : 'default'">
                    {{ u.is_admin ? 'Admin' : 'Nutzer' }}
                  </Badge>
                </td>
                <td>
                  <Badge
                    v-if="u.must_change_password"
                    variant="warning"
                    title="Passwortänderung beim ersten Login ausstehend"
                  >
                    Passwortänderung ausstehend
                  </Badge>
                  <Badge v-else variant="success">Aktiv</Badge>
                </td>
                <td class="actions-col">
                  <div class="user-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      :title="u.is_admin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'"
                      @click="toggleAdminRole(u)"
                    >
                      <AppIcon :icon="FORM_FIELD_ICONS.person" :size="14" group="formFields" />
                      {{ u.is_admin ? 'Admin entziehen' : 'Zum Admin machen' }}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      :disabled="u.id === auth.user?.id"
                      title="Nutzer löschen"
                      @click="deleteUserAccount(u)"
                    >
                      <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" />
                      Löschen
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template v-if="activeTab === 'app'">
      <div class="card">
        <h2>Darstellung</h2>
        <ThemeModeSelect variant="block" />
      </div>

      <AccentColorSettings />

      <BorderWidthSettings />

      <GlassSettings />

      <IconStyleSettings />

      <div class="card">
        <h2>Navigation</h2>
        <p class="hint intro-hint">
          Position der Navigationsleiste, getrennt für Desktop und mobile Bedienung.
        </p>
        <div class="nav-position-row">
          <label for="auto-id-1788301151989-29">
            Desktop
            <select id="auto-id-1788301151989-29" v-model="navPosition.desktop">
              <option value="top">Oben</option>
              <option value="bottom">Unten</option>
            </select>
          </label>
          <label for="auto-id-1788301151989-30">
            Mobil
            <select id="auto-id-1788301151989-30" v-model="navPosition.mobile">
              <option value="top">Oben</option>
              <option value="bottom">Unten</option>
            </select>
          </label>
        </div>

        <p class="hint nav-config-hint">
          Reihenfolge und Sichtbarkeit der übrigen Einträge ("Übersicht" bleibt immer an erster
          Stelle).
        </p>
        <ul class="nav-config-list">
          <li v-for="(entry, index) in navConfig.entries" :key="entry.key" class="nav-config-row">
            <AppIcon
              v-if="navLinkIcon(entry.key)"
              class="nav-config-icon"
              :icon="navLinkIcon(entry.key)!"
              group="navigation"
            />
            <span class="nav-config-label" :class="{ hidden: !entry.visible }">{{
              navLinkLabel(entry.key)
            }}</span>
            <div class="nav-config-actions">
              <IconButton
                variant="ghost"
                size="sm"
                :disabled="index === 0"
                aria-label="Nach oben verschieben"
                title="Nach oben verschieben"
                @click="navConfig.moveUp(entry.key)"
              >
                <AppIcon :icon="ACTION_ICONS.chevronUp" :size="14" group="actions" />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                :disabled="index === navConfig.entries.length - 1"
                aria-label="Nach unten verschieben"
                title="Nach unten verschieben"
                @click="navConfig.moveDown(entry.key)"
              >
                <AppIcon :icon="ACTION_ICONS.chevronDown" :size="14" group="actions" />
              </IconButton>
              <label for="auto-id-1788301175449-27" class="nav-config-visible">
                <input
                  id="auto-id-1788301175449-27"
                  type="checkbox"
                  :checked="entry.visible"
                  :aria-label="`${navLinkLabel(entry.key)} in der Navigation anzeigen`"
                  @change="
                    navConfig.setVisible(entry.key, ($event.target as HTMLInputElement).checked)
                  "
                />
              </label>
            </div>
          </li>
        </ul>
      </div>

      <div class="card">
        <h2>
          <AppIcon :icon="DASHBOARD_TILES_ICON" group="navigation" :size="20" /> Dashboard-Kacheln
        </h2>
        <p class="hint nav-config-hint">Reihenfolge und Sichtbarkeit der Dashboard-Kacheln.</p>
        <!-- Eigene dashboard-config-list/-row-Klassen statt der optisch identischen nav-config-list/
             -row oben (gleiche CSS-Regeln per Komma-Selektor, siehe dort) - sonst würden e2e-
             Selektoren wie .nav-config-row[hasText] auf beide Listen zugleich treffen, sobald ein
             Eintrag denselben Namen trägt (z. B. "Notizen" existiert sowohl als Nav-Eintrag als auch
             als Kachel). Die inneren Icon-/Label-/Actions-Klassen bleiben geteilt - dort scopen beide
             Tests immer erst über die jeweilige äußere Zeilen-Klasse, keine Kollisionsgefahr. -->
        <ul class="dashboard-config-list">
          <li
            v-for="(entry, index) in dashboardConfig.entries"
            :key="entry.key"
            class="dashboard-config-row"
          >
            <AppIcon
              v-if="dashboardTileIcon(entry.key)"
              class="nav-config-icon"
              :icon="dashboardTileIcon(entry.key)!"
              group="navigation"
            />
            <span class="nav-config-label" :class="{ hidden: !entry.visible }">{{
              dashboardTileLabel(entry.key)
            }}</span>
            <div class="nav-config-actions">
              <IconButton
                variant="ghost"
                size="sm"
                :disabled="index === 0"
                aria-label="Nach oben verschieben"
                title="Nach oben verschieben"
                @click="dashboardConfig.moveUp(entry.key)"
              >
                <AppIcon :icon="ACTION_ICONS.chevronUp" :size="14" group="actions" />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                :disabled="index === dashboardConfig.entries.length - 1"
                aria-label="Nach unten verschieben"
                title="Nach unten verschieben"
                @click="dashboardConfig.moveDown(entry.key)"
              >
                <AppIcon :icon="ACTION_ICONS.chevronDown" :size="14" group="actions" />
              </IconButton>
              <label for="auto-id-1788301175449-28" class="nav-config-visible">
                <input
                  id="auto-id-1788301175449-28"
                  type="checkbox"
                  :checked="entry.visible"
                  :aria-label="`${dashboardTileLabel(entry.key)} auf dem Dashboard anzeigen`"
                  @change="
                    dashboardConfig.setVisible(
                      entry.key,
                      ($event.target as HTMLInputElement).checked
                    )
                  "
                />
              </label>
            </div>
          </li>
        </ul>
      </div>

      <div class="card">
        <h2>
          <AppIcon :icon="ACTION_ICONS.vacation" group="navigation" :size="20" /> Urlaubs-Hinweis
        </h2>
        <p class="hint intro-hint">
          Der Hinweis im Dashboard-Header während des laufenden Urlaubs zeigt standardmäßig immer
          denselben Text - kann hier stattdessen auf einen Countdown der verbleibenden Urlaubstage
          umgeschaltet werden.
        </p>
        <label for="auto-id-1788301175449-29" class="checkbox-option">
          <input
            id="auto-id-1788301175449-29"
            type="checkbox"
            v-model="uiSettings.showVacationCountdown"
          />
          Verbleibende Urlaubstage anzeigen statt festem Hinweis
        </label>
      </div>
    </template>

    <div v-if="activeTab === 'trip'" class="grid settings-grid">
      <div id="calendar-settings" class="card">
        <h2>
          <AppIcon :icon="SECTION_ICON_DEFS.calendar" group="navigation" :size="20" /> Kalender
        </h2>
        <p class="hint intro-hint">
          Wochenanfang und Zahlenformat für Datumsanzeigen in der ganzen App.
        </p>
        <div class="nav-position-row">
          <label for="auto-id-1788301151989-34">
            Wochenanfang
            <select id="auto-id-1788301151989-34" v-model="calendarSettings.weekStart">
              <option
                v-for="option in WEEK_START_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label for="auto-id-1788301151989-35">
            Datumsformat
            <select id="auto-id-1788301151989-35" v-model="calendarSettings.dateFormat">
              <option
                v-for="option in DATE_FORMAT_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <!-- id als Sprungziel für den "Anbieter wechseln"-Link im Wetter-Widget (DashboardView.vue) -->
      <div id="weather-provider-settings" class="card">
        <h2><AppIcon :icon="WEATHER_SECTION_ICON" group="navigation" :size="20" /> Wetter</h2>
        <p class="hint intro-hint">
          Wettervorhersage über Open-Meteo, das mehrere echte Wetterdienste bündelt. Zeigt eine
          Vorhersage abweichende Werte gegenüber anderen Wetter-Apps (z. B. Apple Weather), lässt
          sich hier ein anderer Anbieter ausprobieren.
        </p>
        <label for="auto-id-1788301151989-36" class="weather-provider-label">
          Wettermodell
          <select id="auto-id-1788301151989-36" v-model="weatherProvider.model">
            <option
              v-for="option in WEATHER_MODEL_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <label for="auto-id-1788301175449-30" class="checkbox-option">
          <input
            id="auto-id-1788301175449-30"
            type="checkbox"
            v-model="uiSettings.showHomeWeatherFullTrip"
          />
          Wetter zuhause für den ganzen Urlaub zeigen (statt nur gegen Ende)
        </label>
      </div>

      <!-- id als Sprungziel, analog zu #weather-provider-settings oben -->
      <div id="home-currency-settings" class="card">
        <h2>
          <AppIcon :icon="ACTION_ICONS.currency" group="navigation" :size="20" /> Heimatwährung
        </h2>
        <p class="hint intro-hint">
          Wird im Dashboard genutzt, um bei Urlauben mit abweichender Landeswährung den aktuellen
          Wechselkurs anzuzeigen.
        </p>
        <label for="auto-id-1788301151989-38" class="weather-provider-label">
          Heimatwährung
          <select id="auto-id-1788301151989-38" v-model="homeCurrency.currency">
            <option
              v-for="option in HOME_CURRENCY_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <template v-if="activeTab === 'notifications'">
      <div class="card">
        <h2><AppIcon :icon="BELL_ICON" group="navigation" :size="20" /> Meldungen</h2>
        <p class="hint intro-hint">
          Kurze Meldungen, die bei jedem Laden/Speichern/Löschen kurz unten am Bildschirmrand
          aufblitzen (z. B. "Speichert…"), damit klar wird, dass die App gerade tatsächlich mit dem
          Server arbeitet statt hängengeblieben zu sein. Wer das zu hektisch findet, kann sie hier
          ausschalten - der dauerhafte Offline-/Update-Hinweis oben im Header bleibt davon
          unberührt.
        </p>
        <label for="auto-id-1788301175449-31" class="checkbox-option">
          <input
            id="auto-id-1788301175449-31"
            type="checkbox"
            v-model="uiSettings.showActivityToasts"
          />
          Detaillierte Lade-/Speicher-Meldungen anzeigen
        </label>
        <label
          for="auto-id-1788301175449-32"
          class="weather-provider-label"
          style="margin-top: var(--space-3)"
        >
          Anzeigedauer von Toast-Benachrichtigungen
          <select id="auto-id-1788301175449-32" v-model.number="uiSettings.toastTimeout">
            <option
              v-for="option in TOAST_TIMEOUT_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="card">
        <h2><AppIcon :icon="BELL_ICON" group="navigation" :size="20" /> Push-Benachrichtigungen</h2>
        <p class="hint" v-if="!pushSupported">
          Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
        </p>
        <template v-else>
          <p class="hint intro-hint">
            Benachrichtigt dich, wenn andere Mitglieder eines Urlaubs etwas ändern – auch wenn
            Reisotor gerade nicht offen ist. Über die Stufe lässt sich einstellen, wie viel davon
            ankommt.
          </p>
          <Button v-if="pushEnabled === null" class="secondary" disabled> Wird geprüft… </Button>
          <Button
            v-else-if="!pushEnabled"
            class="secondary"
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
              class="secondary small push-details-toggle"
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
            <ul v-if="showPushDetails" class="nav-config-list push-domain-list">
              <li
                v-for="domain in NOTIFICATION_DOMAINS"
                :key="domain"
                class="nav-config-row push-domain-row"
              >
                <span class="nav-config-icon">{{ NOTIFICATION_DOMAIN_META[domain].icon }}</span>
                <span class="nav-config-label">{{ NOTIFICATION_DOMAIN_META[domain].label }}</span>
                <label for="auto-id-1788301175449-33" class="nav-config-visible">
                  <input
                    id="auto-id-1788301175449-33"
                    type="checkbox"
                    :checked="notificationPrefs.preferences?.[domain] ?? true"
                    :aria-label="`${NOTIFICATION_DOMAIN_META[domain].label}-Push aktiv`"
                    @change="
                      setDomainPreference(domain, ($event.target as HTMLInputElement).checked)
                    "
                  />
                </label>
              </li>
            </ul>
          </template>
          <p v-if="pushError || notificationPrefs.error" class="hint error">
            {{ pushError || notificationPrefs.error }}
          </p>
        </template>
      </div>
    </template>

    <template v-if="activeTab === 'data'">
      <div class="card">
        <h2><AppIcon :icon="ACTION_ICONS.delete" group="navigation" :size="20" /> Papierkorb</h2>
        <p class="hint intro-hint">
          Gelöschte Termine, Ausflüge, Spots und mehr bleiben eine Weile hier erhalten und lassen
          sich wiederherstellen.
        </p>
        <router-link to="/trash" class="card-action-btn">Papierkorb öffnen</router-link>
      </div>

      <div class="card" v-if="auth.user?.is_admin">
        <h2>Datensicherung</h2>
        <p>
          Vor einem Neu-Deployment mit neuen Features könnt ihr hier alle Daten (Urlaub, Kalender,
          Packlisten, Touren, Unterkünfte, Budget, Nutzer) als JSON-Datei sichern und später
          wiederherstellen.
        </p>

        <div class="backup-actions">
          <Button class="secondary" :disabled="exporting" @click="exportBackup">
            <template v-if="exporting">Exportiere…</template>
            <template v-else
              ><AppIcon :icon="ACTION_ICONS.download" :size="14" group="actions" /> Backup
              exportieren</template
            >
          </Button>
          <Button class="secondary" :disabled="importing" @click="triggerImportPicker">
            <template v-if="importing">Importiere…</template>
            <template v-else
              ><AppIcon :icon="ACTION_ICONS.upload" :size="14" group="actions" /> Backup
              importieren</template
            >
          </Button>
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
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
          Import erfolgreich ({{ Object.values(importResult).reduce((a, b) => a + b, 0) }}
          Einträge). Seite wird neu geladen…
        </p>
        <p class="hint warning">
          <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Import
          überschreibt alle aktuellen Daten unwiderruflich.
        </p>
      </div>
    </template>

    <template v-if="activeTab === 'about'">
      <div class="card">
        <h2>
          <AppIcon :icon="ACTION_ICONS.installApp" group="actions" :size="20" /> Als App
          installieren
        </h2>
        <p v-if="pwaInstall.isStandalone" class="hint intro-hint">
          Du nutzt Reisotor bereits als installierte App auf diesem Gerät. 🎉
        </p>
        <template v-else>
          <p class="hint intro-hint">
            Installiere Reisotor auf deinem Start-/Homebildschirm für schnelleren Zugriff, ein
            eigenes App-Icon und Offline-Nutzung.
          </p>
          <Button type="button" class="secondary" @click="showPwaInstallDialog = true"
            >Anleitung anzeigen</Button
          >
        </template>
      </div>

      <div class="card">
        <h2><AppIcon :icon="FEEDBACK_ICON" group="navigation" :size="20" /> Feedback</h2>
        <p class="hint intro-hint">
          Bug gefunden oder eine Idee für eine neue Funktion? Landet direkt als Issue im
          Reisotor-Repository.
        </p>
        <Button type="button" class="secondary" @click="showFeedbackDialog = true"
          >Feedback geben</Button
        >
      </div>

      <div class="card build-info-card">
        <div v-if="backendBuildInfo?.changelog">
          <h2><AppIcon :icon="INFO_ICON" group="navigation" :size="20" /> Versions-Info</h2>
          <h3>Was ist neu in v{{ backendBuildInfo.changelog.version }}</h3>
          <RichTextDisplay
            class="changelog-notes"
            :content="
              backendBuildInfo.changelog.notes
                .map((note) => (note.startsWith('- ') ? note : `- ${note}`))
                .join('\n')
            "
          />
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
        <AppFooterLinks
          v-if="backendBuildInfo"
          :repo-url="backendBuildInfo.repoUrl"
          :hosting-location="backendBuildInfo.hostingLocation"
        />
      </div>
    </template>
  </div>
  <ViewLoadingState v-else />

  <FeedbackDialog v-model="showFeedbackDialog" />
  <PwaInstallDialog v-model="showPwaInstallDialog" />
  <CreateUserDialog v-model="showCreateUserDialog" @created="onUserCreated" />
</template>

<style scoped>
.page > .card {
  margin-bottom: var(--space-4);
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.card-header-row h2 {
  margin: 0;
}

.users-table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.users-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.users-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
}

.user-avatar {
  font-size: 1.2rem;
}

.email-cell {
  color: var(--color-text-muted);
}

.actions-col {
  text-align: right;
}

.user-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

h3 {
  font-size: 1rem;
  margin: var(--space-4) 0 var(--space-3) 0;
}

/* Karten-Überschriften, die (#94) ein AppIcon statt eines rohen Emoji-Zeichens voranstellen -
   h2/h3 sind sonst reine Block-Elemente ohne Flex, das Icon würde ohne das hier leicht
   unausgerichtet zur Textgrundlinie sitzen (gleiches Muster wie ExcursionsView.vue's
   .category-heading). */
.card h2:has(.app-icon) {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Tab-Leiste jetzt die gemeinsame TabBar-Komponente (components/TabBar.vue) statt eines eigenen,
   lokal duplizierten Style-Blocks - siehe dortiger Kommentar zur Redundanz, die Issue #71 (Gleit-
   Animation fehlte hier, obwohl ListenView.vue's identisches Muster sie hatte) erst ermöglichte.
   Nur noch der Seiten-spezifische Abstand bleibt hier lokal (.page trägt bereits Breite/
   Innenabstand der ganzen Seite, TabBar selbst kennt keine Umgebungs-Margins). */
.tab-bar-wrap {
  margin-bottom: var(--space-4);
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
  margin: var(--space-3) 0 var(--space-2);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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

/* Compound-Selektor (.hint.nav-config-hint) statt nur .nav-config-hint: beide Klassen haben
   dieselbe Spezifität, und diese Regel steht im Stylesheet VOR der späteren .hint{margin:0}-Regel
   unten - ohne den Compound-Selektor hätte die spätere Regel bei gleicher Spezifität gewonnen und
   margin-top/-bottom hier wieder auf 0 zurückgesetzt (genau der in DESIGN.md dokumentierte
   Deklarations-Reihenfolge-Stolperstein, der bei diesem Fix zunächst selbst reingefallen ist - der
   Abstand zwischen den Oben-/Unten-Dropdowns und diesem Hinweistext blieb dadurch bei 0). */
.hint.nav-config-hint {
  margin-top: var(--space-3);
  /* Ohne das klebte die Liste direkt darunter (▲▼✓-Zeilen) an der letzten Textzeile - derselbe
     .hint-Stolperstein wie .intro-hint unten, hier separat gehalten, weil nav-config-hint zusätzlich
     den margin-top von der Zeile darüber braucht. */
  margin-bottom: var(--space-3);
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

.push-details-caret {
  margin-left: 4px;
  opacity: 0.6;
  transition: transform 0.15s ease;
}

.push-details-caret.open {
  transform: rotate(180deg);
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
  margin: 0 0 var(--space-3);
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

/* .hint's margin:0 ist bewusst für knapp unter einem Eingabefeld sitzende Validierungs-/
   Erfolgsmeldungen gedacht (siehe DESIGN.md "Beschreibungstext vor einer Karte/Liste/einem Grid" -
   derselbe .hint-Klassen-Stolperstein wie dort, nur diesmal vor einem Steuerelement statt vor einer
   Karte/Liste). Ein erklärender Absatz direkt VOR einem Button/Dropdown/Toggle braucht dagegen
   sichtbar Luft - ohne diese Klasse klebte der Absatz sonst direkt am folgenden Steuerelement (Issue
   #69: "Feedback geben"-Button, "Papierkorb öffnen"-Button, Push-"Aktivieren"-Button sowie mehrere
   Dropdown-/Listen-Gruppen in dieser View betroffen). */
.hint.intro-hint {
  margin-bottom: var(--space-3);
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

.account-header {
  align-items: flex-start;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.name-and-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.name-and-status h2 {
  margin: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-badge.online .status-dot {
  background-color: var(--color-success);
}
.status-badge.offline .status-dot {
  background-color: var(--color-text-muted);
}
.status-badge.retrying .status-dot {
  background: conic-gradient(
    var(--color-success) 0deg,
    var(--color-success) 90deg,
    transparent 180deg
  );
  animation: spin 1s linear infinite;
  border-radius: 50%;
}

.offline-description {
  margin: 0;
  max-width: 350px;
  line-height: 1.4;
}

.pending-description {
  margin: 0;
  max-width: 350px;
  line-height: 1.4;
}

.pending-sync-btn {
  color: var(--color-accent);
}

.pending-sync-btn .is-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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

.changelog-list {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.about-repo-link,
.about-copyright {
  margin: var(--space-2) 0 0;
}
</style>
