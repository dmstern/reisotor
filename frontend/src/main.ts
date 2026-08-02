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

// Registriert den Service Worker früh (unabhängig davon, ob die Person Push je aktiviert) – ein
// aktiviertes Abonnement braucht bei jedem App-Start eine aktive Registration, sonst wäre
// navigator.serviceWorker.ready nie erfüllt (siehe utils/push.ts). Rein additiv: ohne SW-Unterstützung
// (z. B. sehr alter Browser) bleibt die App unverändert funktionsfähig.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Push-Benachrichtigungen sind ein optionales Extra – ein fehlgeschlagenes SW-Setup soll die
    // restliche App nicht beeinträchtigen.
  });
}

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
