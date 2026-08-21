import { createApp } from 'vue';
import LandingView from './views/LandingView.vue';
// Wiederverwendung derselben Design-Tokens (Farben/Spacing/Radius/Schatten, siehe DESIGN.md) wie
// die Haupt-App - LandingView.vue braucht dafür keine eigene Kopie der CSS-Variablen.
import './style.css';

// Eigenständiger, schlanker Mount-Punkt ohne Pinia/Router (siehe landing.html) - die Landingpage
// ist auth-unabhängig und läuft komplett ohne Backend, braucht also keinen der App-weiten Stores.
createApp(LandingView).mount('#app');
