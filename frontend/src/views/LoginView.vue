<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, ApiError } from '../api/client';
import PasswordInput from '../components/PasswordInput.vue';
import ReisotorRobot from '../components/ReisotorRobot.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';
import AppFooterLinks from '../components/AppFooterLinks.vue';
import ContactAdminDialog from '../components/ContactAdminDialog.vue';
import Button from '../components/primitives/Button.vue';
import Input from '../components/primitives/Input.vue';
import Alert from '../components/primitives/Alert.vue';

const auth = useAuthStore();
const router = useRouter();

const mode = ref<'login' | 'register' | 'forgot-password'>('login');
const username = ref('');
const email = ref('');
const password = ref('');
const passwordVisible = ref(false);
const error = ref('');
const isUnverifiedOrNoMailError = ref(false);
const successMessage = ref('');
const loading = ref(false);

const showContactDialog = ref(false);

// Backend-Setting REGISTRATION_MODE (Issue #96)
const registrationMode = ref<'off' | 'full' | 'restricted'>('off');
const emailConfigured = ref(false);
const requireEmailVerification = ref(false);
const contactAdminEnabled = ref(true);

const landingUrl = __LANDING_URL__;

onMounted(async () => {
  try {
    const config = await api.get<{
      registrationMode: 'off' | 'full' | 'restricted';
      emailConfigured?: boolean;
      requireEmailVerification?: boolean;
      contactAdminEnabled?: boolean;
    }>('/auth/config');
    registrationMode.value = config.registrationMode;
    emailConfigured.value = Boolean(config.emailConfigured);
    requireEmailVerification.value = Boolean(config.requireEmailVerification);
    contactAdminEnabled.value = config.contactAdminEnabled !== false;
  } catch {
    // Bleibt bei Defaults
  }
});

function setMode(newMode: 'login' | 'register' | 'forgot-password') {
  mode.value = newMode;
  error.value = '';
  isUnverifiedOrNoMailError.value = false;
  successMessage.value = '';
}

function toggleMode() {
  setMode(mode.value === 'login' ? 'register' : 'login');
}

function openContactDialog() {
  if (
    !contactInitialMessage.value &&
    mode.value === 'register' &&
    requireEmailVerification.value &&
    !emailConfigured.value
  ) {
    const userDetail = username.value.trim() ? ` als "${username.value.trim()}"` : '';
    contactInitialMessage.value = `Hallo, ich möchte mich${userDetail} auf dieser Instanz registrieren. Da kein Mailserver eingerichtet ist, bitte ich um Freischaltung bzw. Erstellung meines Accounts.`;
  }

  showContactDialog.value = true;
}

const contactInitialMessage = ref('');

async function onSubmit() {
  error.value = '';
  isUnverifiedOrNoMailError.value = false;
  successMessage.value = '';
  loading.value = true;

  try {
    if (mode.value === 'register') {
      const res = await auth.register(username.value, email.value, password.value);

      if (res?.requiresVerification) {
        successMessage.value =
          res.message || 'Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.';
        mode.value = 'login';
        loading.value = false;
        return;
      }

      await router.push('/');
    } else if (mode.value === 'forgot-password') {
      const res = await api.post<{ message: string }>('/auth/forgot-password', {
        email: email.value.trim(),
      });
      successMessage.value =
        res.message || 'Falls ein Konto mit dieser Adresse existiert, wurde ein Link versendet.';
    } else {
      await auth.login(username.value, password.value);
      await router.push('/');
    }
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
      const data = err.data as { unverifiedEmail?: boolean; noMailServer?: boolean } | undefined;

      if (data?.unverifiedEmail || data?.noMailServer) {
        isUnverifiedOrNoMailError.value = true;
        contactInitialMessage.value = data?.noMailServer
          ? `Hallo, ich habe mich als "${username.value}" registriert bzw. wollte mich registrieren. Da kein Mailserver eingerichtet ist, bitte ich um manuelle Freischaltung meines Accounts.`
          : `Hallo, ich kann mich mit meinem Konto "${username.value}" nicht anmelden, da die E-Mail-Bestätigung aussteht. Bitte helft mir bei der Freischaltung.`;
      }
    } else if (err instanceof Error && err.name === 'AbortError') {
      error.value = 'Zeitüberschreitung bei der Serveranfrage. Bitte versuche es erneut.';
    } else if (err instanceof TypeError) {
      error.value = 'Netzwerkfehler: Server nicht erreichbar.';
    } else if (mode.value === 'register') {
      error.value = 'Registrierung fehlgeschlagen';
    } else if (mode.value === 'forgot-password') {
      error.value = 'Anfrage fehlgeschlagen';
    } else {
      error.value = 'Login fehlgeschlagen';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <ThemeModeSelect variant="icon" class="theme-toggle" />
    <form class="card login-card" @submit.prevent="onSubmit">
      <ReisotorRobot :covering-eyes="passwordVisible" size="140px" class="logo" />
      <h1>Reisotor</h1>
      <p>
        <template v-if="mode === 'register'">
          Erstelle ein Konto, um euren Urlaub zu planen.
        </template>
        <template v-else-if="mode === 'forgot-password'"> Passwort zurücksetzen </template>
        <template v-else> Melde dich an, um euren Urlaub zu planen. </template>
      </p>

      <p v-if="mode === 'register' && registrationMode === 'restricted'" class="hint">
        Eingeschränkter Modus - Kein Datei-Upload, nur ein Urlaub, maximal drei Mitglieder pro
        Urlaub möglich.
      </p>

      <Alert
        v-if="mode === 'register' && requireEmailVerification && !emailConfigured"
        variant="warning"
        size="sm"
        class="reg-email-alert"
      >
        <div class="reg-email-alert-content">
          <span v-if="contactAdminEnabled">
            Auf diesem Server ist kein Mailserver eingerichtet und die E-Mail-Bestätigung ist
            verpflichtend. Eine Selbstregistrierung ist daher derzeit nicht möglich. Bitte wende
            dich an die Administration, um einen Zugang zu erhalten.
          </span>
          <span v-else>
            Auf diesem Server ist kein Mailserver eingerichtet und die E-Mail-Bestätigung ist
            verpflichtend. Eine Registrierung ist derzeit nicht möglich.
          </span>
          <Button
            v-if="contactAdminEnabled"
            type="button"
            variant="secondary"
            size="sm"
            class="reg-contact-btn"
            @click="openContactDialog"
          >
            Admin um Freischaltung bitten
          </Button>
        </div>
      </Alert>

      <p v-if="mode === 'forgot-password'" class="hint">
        Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du ein neues Passwort
        vergeben kannst.
      </p>

      <div v-if="successMessage" class="success-banner">
        {{ successMessage }}
      </div>

      <!-- Login / Register Felder -->
      <template v-if="mode !== 'forgot-password'">
        <label for="login-username">
          Benutzername
          <Input
            id="login-username"
            v-model="username"
            type="text"
            autocomplete="username"
            required
          />
        </label>

        <label v-if="mode === 'register'" for="register-email">
          E-Mail-Adresse
          <Input id="register-email" v-model="email" type="email" autocomplete="email" required />
        </label>

        <div class="field">
          <div class="label-with-action">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label for="login-password">Passwort</label>
            <button
              v-if="mode === 'login'"
              type="button"
              class="forgot-link"
              @click="setMode('forgot-password')"
            >
              Passwort vergessen?
            </button>
          </div>
          <PasswordInput
            id="login-password"
            v-model="password"
            v-model:visible="passwordVisible"
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            required
          />
        </div>
      </template>

      <!-- Forgot Password Felder -->
      <template v-else>
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
        <label for="forgot-email">
          E-Mail-Adresse deines Kontos
          <Input
            id="forgot-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          />
        </label>
      </template>

      <div v-if="error" class="error-container">
        <p class="error">{{ error }}</p>
        <Button
          v-if="isUnverifiedOrNoMailError && contactAdminEnabled"
          type="button"
          variant="secondary"
          size="sm"
          class="contact-admin-action"
          @click="openContactDialog"
        >
          Admin um Freischaltung bitten
        </Button>
      </div>

      <Button type="submit" :loading="loading" :disabled="loading">
        {{
          loading
            ? mode === 'register'
              ? 'Registrieren…'
              : mode === 'forgot-password'
                ? 'Link senden…'
                : 'Anmelden…'
            : mode === 'register'
              ? 'Registrieren'
              : mode === 'forgot-password'
                ? 'Link anfordern'
                : 'Anmelden'
        }}
      </Button>

      <Button
        v-if="mode === 'forgot-password'"
        type="button"
        variant="secondary"
        class="mode-toggle"
        @click="setMode('login')"
      >
        Zurück zur Anmeldung
      </Button>

      <Button
        v-else-if="registrationMode !== 'off'"
        type="button"
        variant="secondary"
        class="mode-toggle"
        @click="toggleMode"
      >
        {{ mode === 'register' ? 'Schon registriert? Anmelden' : 'Noch kein Konto? Registrieren' }}
      </Button>

      <button
        v-if="contactAdminEnabled"
        type="button"
        class="forgot-link help-contact-link"
        @click="openContactDialog"
      >
        Probleme bei Registrierung oder Anmeldung?
      </button>
    </form>
    <footer class="login-footer">
      <AppFooterLinks :landing-url="landingUrl" />
    </footer>

    <ContactAdminDialog
      v-model="showContactDialog"
      :initial-username="username"
      :initial-email="email"
      :initial-type="mode === 'register' ? 'registration_help' : 'login_help'"
      :initial-message="contactInitialMessage"
    />
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  gap: var(--space-3);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 60%);
}

.theme-toggle.icon {
  position: absolute;
  top: max(var(--space-4), env(safe-area-inset-top, var(--space-4)));
  right: max(var(--space-4), env(safe-area-inset-right, var(--space-4)));
  background-color: var(--color-surface);
  background-image: var(--gradient-control-3d);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--control-radius-sm);
  box-shadow: var(--shadow-control);
  z-index: var(--z-sticky, 10);
}

.login-card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
  /* Hero-Karte: kräftigerer Verlauf als Standard-Cards (dort in Dark Mode kaum sichtbar) plus
     dezenter Primärfarben-Schein oben, damit Licht von oben zu kommen scheint. */
  --surface-grad-top: var(--gradient-surface-hover-top);
  --surface-grad-bottom: var(--gradient-surface-hover-bottom);
  background-color: var(--color-surface);
  background-image:
    radial-gradient(
      120% 60% at 50% 0%,
      color-mix(in srgb, var(--color-primary) 14%, transparent),
      transparent 70%
    ),
    var(--gradient-surface-3d);
  border: 1px solid var(--color-border);
  border-top-color: color-mix(
    in srgb,
    var(--color-border) 40%,
    var(--shadow-control-highlight-strong)
  );
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-card-elevated);
  padding: var(--space-4);
}

.logo {
  margin-bottom: var(--space-1);
}

.login-card h1 {
  color: var(--color-primary-dark);
  margin: 0;
}

.login-card p {
  margin: 0;
  overflow-wrap: break-word;
}

.login-card label,
.login-card .field {
  width: 100%;
  min-width: 0;
  text-align: left;
}

.login-card button {
  width: 100%;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  width: 100%;
  min-width: 0;
}

.label-with-action label {
  width: auto;
}

.forgot-link {
  @include touch-target($expand: true);
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: 0;
  width: auto !important;
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: var(--radius-xs);
}

.forgot-link:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.mode-toggle {
  font-size: var(--font-size-sm);
  font-weight: 400;
}

.login-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  width: 100%;
}

label,
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.hint {
  color: var(--color-text-muted);
  margin: 0;
  font-size: var(--font-size-xs);
}

.error {
  color: var(--color-danger);
  margin: 0;
  font-size: var(--font-size-sm);
  overflow-wrap: break-word;
}

.success-banner {
  background: var(--color-success-tint);
  color: var(--color-success-dark, var(--color-success));
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-snug);
  text-align: left;
  width: 100%;
}

.reg-email-alert {
  width: 100%;
  text-align: left;
}

.reg-email-alert-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
  min-width: 0;
}

.reg-contact-btn {
  font-size: var(--font-size-xs);
  width: auto !important;
}

.error-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  min-width: 0;
}

.contact-admin-action {
  font-size: var(--font-size-xs);
  width: auto !important;
}

.help-contact-link {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

@include can-hover {
  .help-contact-link:hover {
    color: var(--color-primary);
  }
}

@include media-down('mobile-compact') {
  .login-page {
    padding: var(--space-3);
    padding-top: calc(var(--space-6) + var(--space-2));
  }

  .login-card {
    padding: var(--space-3);
  }
}
</style>
