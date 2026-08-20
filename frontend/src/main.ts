import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useThemeStore } from './stores/theme';
import './style.css';

// Vor dem ersten Render anwenden, damit die Seite nicht kurz im falschen Theme aufblitzt.
const pinia = createPinia();
setActivePinia(pinia);
useThemeStore().init();

const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount('#app');

// Statischer Splash aus index.html (siehe dort) - erst hier entfernen, nicht dort per Timer, damit
// er bis zum tatsächlichen ersten Vue-Render sichtbar bleibt (App.vue zeigt selbst noch einen
// eigenen SplashScreen.vue, solange Trips/Live-Sync laden - beide reichen sich damit nahtlos die
// Hand statt einer Lücke dazwischen).
const splash = document.getElementById('splash');
if (splash) {
  splash.classList.add('splash-hide');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
}

// Service-Worker-Registrierung läuft jetzt über vite-plugin-pwa's virtual:pwa-register-Modul (siehe
// components/PwaUpdatePrompt.vue, in App.vue gemountet) statt eines manuellen
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
