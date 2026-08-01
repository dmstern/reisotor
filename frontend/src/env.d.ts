/// <reference types="vite/client" />

// Von vite.config.ts's `define` zur Build-Zeit eingesetzt (siehe ProfileView.vue's Build-Info-Card,
// die diese Werte in lokale <script setup>-Bindings kopiert statt sie direkt im Template zu
// referenzieren – vue-tsc's Template-Typprüfung löst Ambient-Globals aus einer .d.ts sonst nicht auf).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
