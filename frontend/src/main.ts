import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useThemeStore } from './stores/theme';
import { useUiSettingsStore } from './stores/uiSettings';
import { usePwaInstallStore } from './stores/pwaInstall';
import { usePwaUpdateStore } from './stores/pwaUpdate';
import { useErrorNotifier } from './composables/useErrorNotifier';
import type { OutboxEntry } from './api/offline';
import { migrateLocalData } from './utils/localMigrations';
import './style.css';

// Vor dem ersten Render anwenden, damit die Seite nicht kurz im falschen Theme aufblitzt.
const pinia = createPinia();
setActivePinia(pinia);
useThemeStore().init();
useUiSettingsStore().init();
try {
  migrateLocalData();
} catch (e) {
  console.warn('Fehler bei lokaler Datenmigration:', e);
}
// So früh wie möglich, damit das beforeinstallprompt-Event (siehe stores/pwaInstall.ts) sicher
// abgefangen wird, auch wenn es der Browser schon direkt beim Laden feuert.
usePwaInstallStore().init();
usePwaUpdateStore().init();

const app = createApp(App);
app.use(pinia);
app.use(router);

const { notifyError, notifyOutboxRejected, notifyOutboxFailed } = useErrorNotifier();

app.config.errorHandler = (err, instance, info) => {
  console.error(err);
  const compName =
    instance?.$options?.name ||
    (instance?.$options as { __name?: string } | undefined)?.__name ||
    undefined;
  const componentInfo = [compName, info].filter(Boolean).join(' · ') || undefined;
  notifyError(err, { componentInfo });
};

window.addEventListener('unhandledrejection', (event) => {
  notifyError(event.reason, { componentInfo: 'unhandledrejection' });
});

window.addEventListener('reisotor:outbox-rejected', (event) => {
  const detail = (event as CustomEvent<{ entry: OutboxEntry; error: unknown }>).detail;
  if (detail?.entry) {
    notifyOutboxRejected(detail.entry, detail.error);
  }
});

window.addEventListener('reisotor:outbox-failed', (event) => {
  const detail = (event as CustomEvent<{ entry: OutboxEntry; error: unknown }>).detail;
  if (detail?.entry) {
    notifyOutboxFailed(detail.entry, detail.error);
  }
});

app.mount('#app');

// Statischer Splash aus index.html (siehe dort) - erst hier entfernen, nicht dort per Timer, damit
// er bis zum tatsächlichen ersten Vue-Render sichtbar bleibt (App.vue zeigt selbst noch einen
// eigenen SplashScreen.vue, solange Trips/Live-Sync laden - beide reichen sich damit nahtlos die
// Hand statt einer Lücke dazwischen).
const splash = document.getElementById('splash');
if (splash) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWebdriver = Boolean(navigator.webdriver);
  if (reducedMotion || isWebdriver) {
    // Bei prefers-reduced-motion: reduce oder in automatisierten E2E-Tests (navigator.webdriver)
    // die CSS-Transition überspringen und den Splash sofort entfernen. transitionend feuert in
    // headless Chromium bei reduced-motion / E2E-Tests nicht immer zuverlässig - ohne diesen
    // Sonderfall bliebe der Splash bis zum nächsten Repaint sichtbar und würde Screenshots verfälschen.
    splash.remove();
  } else {
    splash.classList.add('splash-hide');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
}

// Service-Worker-Registrierung läuft jetzt über vite-plugin-pwa's virtual:pwa-register-Modul (siehe
// stores/pwaUpdate.ts, dort per init() gestartet) statt eines manuellen
// navigator.serviceWorker.register() hier – registriert weiterhin denselben public/sw.js unter
// demselben Scope, navigator.serviceWorker.ready (siehe utils/push.ts) bleibt unverändert erfüllt.

// Checkboxen/Toggle-Buttons (style.css: input[type=checkbox]:focus-visible, .state-toggle:
// focus-visible) behalten nach einem Klick den DOM-Fokus – Chromium/Firefox behandeln das bei
// Checkbox-artigen Controls bewusst als "focus-visible" (anders als bei <button>), der grüne
// Fokus-Ring bleibt dadurch auch nach dem Ab-/Anhaken sichtbar, obwohl der Klick kein
// Tastatur-Fokuswechsel war. Lässt sich nicht rein per CSS unterscheiden, deshalb global per
// Klick-Delegation: direkt nach dem Klick (der die Checkbox schon um-/abgehakt hat) den Fokus
// wieder entfernen, damit der Zustand danach wieder wie vor dem Anklicken aussieht. Ein Listener
// hier statt in jeder Liste einzeln, da dieselben Controls app-weit (ToDo, Packliste,
// Einkaufsliste, Kategorie-/Status-Filter, …) vorkommen.
document.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest?.('input[type="checkbox"], .state-toggle');
  if (target instanceof HTMLElement) {
    requestAnimationFrame(() => target.blur());
  }
});
