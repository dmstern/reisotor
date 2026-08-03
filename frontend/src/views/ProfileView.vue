<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useWeatherProviderStore, WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import { useHomeCurrencyStore, HOME_CURRENCY_OPTIONS } from '../stores/homeCurrency';
import { useCalendarSettingsStore, WEEK_START_OPTIONS, DATE_FORMAT_OPTIONS } from '../stores/calendarSettings';
import { getExistingSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../utils/push';
import PasswordInput from '../components/PasswordInput.vue';

const auth = useAuthStore();
const router = useRouter();
const navPosition = useNavPositionStore();
const weatherProvider = useWeatherProviderStore();
const homeCurrency = useHomeCurrencyStore();
const calendarSettings = useCalendarSettingsStore();
const users = ref<User[]>([]);
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

const newUserForm = ref({ username: '', password: '', avatar: '🙂' });
const newUserError = ref('');
const newUserSaving = ref(false);
const showNewUserForm = ref(false);

const pushSupported = isPushSupported();
// null = wird noch geprüft, sonst tatsächlicher Abo-Status beim Browser (nicht nur ein lokaler
// Toggle-Zustand, da das Abo z. B. auch über die Browser-Einstellungen widerrufen worden sein kann).
const pushEnabled = ref<boolean | null>(null);
const pushLoading = ref(false);
const pushError = ref('');

async function togglePush() {
  pushError.value = '';
  pushLoading.value = true;
  try {
    if (pushEnabled.value) {
      await unsubscribeFromPush();
      pushEnabled.value = false;
    } else {
      await subscribeToPush();
      pushEnabled.value = true;
    }
  } catch (err) {
    pushError.value = err instanceof Error ? err.message : 'Push-Benachrichtigungen konnten nicht geändert werden';
  } finally {
    pushLoading.value = false;
  }
}

const exporting = ref(false);
const exportError = ref('');
const importing = ref(false);
const importError = ref('');
const importResult = ref<Record<string, number> | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  users.value = await api.get<User[]>('/users');
  usernameForm.value.username = auth.user?.username ?? '';
  loading.value = false;
  backendBuildInfo.value = await api.get<BuildInfo>('/build-info');
  if (pushSupported) {
    pushEnabled.value = !!(await getExistingSubscription());
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
    const idx = users.value.findIndex((u) => u.id === updated.id);
    if (idx !== -1) users.value[idx] = updated;
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
    const idx = users.value.findIndex((u) => u.id === updated.id);
    if (idx !== -1) users.value[idx] = updated;
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

async function createUser() {
  newUserError.value = '';
  if (!newUserForm.value.username.trim() || newUserForm.value.password.length < 6) {
    newUserError.value = 'Benutzername erforderlich, Passwort mindestens 6 Zeichen';
    return;
  }
  newUserSaving.value = true;
  try {
    const created = await api.post<User>('/users', {
      username: newUserForm.value.username.trim(),
      password: newUserForm.value.password,
      avatar: newUserForm.value.avatar,
    });
    users.value.push(created);
    newUserForm.value = { username: '', password: '', avatar: '🙂' };
    showNewUserForm.value = false;
  } catch (err) {
    newUserError.value = err instanceof ApiError ? err.message : 'Nutzer konnte nicht angelegt werden';
  } finally {
    newUserSaving.value = false;
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
    a.download = `reisotor-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    </div>

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

    <div class="card">
      <h2>🗑️ Papierkorb</h2>
      <p class="hint">
        Gelöschte Termine, Ausflüge, Spots und mehr bleiben eine Weile hier erhalten und lassen sich
        wiederherstellen.
      </p>
      <router-link to="/trash" class="card-action-btn">Papierkorb öffnen</router-link>
    </div>

    <div class="card">
      <h2>🔔 Push-Benachrichtigungen</h2>
      <p class="hint" v-if="!pushSupported">
        Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
      </p>
      <template v-else>
        <p class="hint">
          Benachrichtigt dich, wenn andere Mitglieder eines Urlaubs etwas ändern – auch wenn Reisotor
          gerade nicht offen ist.
        </p>
        <button class="secondary" :disabled="pushLoading || pushEnabled === null" @click="togglePush">
          {{ pushLoading ? 'Wird geändert…' : pushEnabled ? 'Deaktivieren' : 'Aktivieren' }}
        </button>
        <p v-if="pushError" class="hint error">{{ pushError }}</p>
      </template>
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

    <div class="card">
      <div class="header">
        <h2>Nutzer</h2>
        <button @click="showNewUserForm = !showNewUserForm">
          {{ showNewUserForm ? 'Abbrechen' : '+ Neuer Nutzer' }}
        </button>
      </div>

      <ul class="user-list">
        <li v-for="u in users" :key="u.id">{{ u.avatar }} {{ u.username }}</li>
      </ul>

      <form v-if="showNewUserForm" class="form new-user-form" @submit.prevent="createUser">
        <label>
          Benutzername
          <input v-model="newUserForm.username" type="text" required />
        </label>
        <div class="field">
          <label for="new-user-password">Passwort</label>
          <PasswordInput
            id="new-user-password"
            v-model="newUserForm.password"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </div>
        <div>
          <p class="avatar-label">Avatar</p>
          <div class="emoji-scroll">
            <div v-for="cat in EMOJI_CATEGORIES" :key="cat.label" class="emoji-category">
              <p class="emoji-category-label">{{ cat.label }}</p>
              <div class="emoji-grid">
                <button
                  v-for="emoji in cat.emojis"
                  :key="emoji"
                  type="button"
                  class="emoji-btn secondary"
                  :class="{ active: emoji === newUserForm.avatar }"
                  @click="newUserForm.avatar = emoji"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-if="newUserError" class="hint error">{{ newUserError }}</p>
        <button type="submit" :disabled="newUserSaving">
          {{ newUserSaving ? 'Anlegen…' : 'Nutzer anlegen' }}
        </button>
      </form>
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

    <div class="card build-info-card">
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
</template>

<style scoped>
.page > .card {
  margin-bottom: var(--space-4);
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

.user-list {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.avatar-label {
  font-weight: 600;
  font-size: 0.9rem;
  margin: 0;
}

.new-user-form {
  margin-top: var(--space-3);
  max-width: 360px;
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
