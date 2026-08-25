/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Von vite.config.ts's `define` zur Build-Zeit eingesetzt (siehe SettingsView.vue's Build-Info-Card,
// die diese Werte in lokale <script setup>-Bindings kopiert statt sie direkt im Template zu
// referenzieren – vue-tsc's Template-Typprüfung löst Ambient-Globals aus einer .d.ts sonst nicht auf).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;
// Fallback-Werte für AppFooterLinks.vue, wenn keine Session/kein Backend-Build-Info verfügbar ist
// (Login-Seite, statische Landingpage/Demo-Build) - siehe Issue #172.
declare const __REPO_URL__: string;
declare const __LANDING_URL__: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
  export default component;
}
