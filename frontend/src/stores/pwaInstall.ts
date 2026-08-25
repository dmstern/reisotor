import { defineStore } from 'pinia';
import { ref } from 'vue';

// Chrome/Edge/Android feuern dieses Event, sobald die Seite die Installationskriterien (Manifest,
// Service Worker, HTTPS) erfüllt - fängt es ab, um den Installationsdialog später selbst auszulösen
// (z. B. per Klick auf den "Jetzt installieren"-Button in PwaInstallDialog.vue) statt der
// Browser-eigenen Mini-Infoleiste. Kein offizieller TS-Typ in lib.dom.d.ts, deshalb hier nachgebaut.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'reisotor-pwa-install-hint-dismissed';

export type PwaPlatform = 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'other';
export type PwaBrowser = 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';

function detectStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS kennt kein display-mode:standalone, sondern dieses ältere, Safari-eigene Flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function detectPlatform(): PwaPlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ gibt sich per User-Agent als "Macintosh" aus - ein echter Mac hat (bisher) keinen
  // Touchscreen, das unterscheidet beide Fälle zuverlässig genug für diesen Hinweis.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}

function detectBrowser(): PwaBrowser {
  const ua = navigator.userAgent;
  // Reihenfolge wichtig: Edge/Chrome-basierte iOS-Browser (EdgiOS/CriOS) enthalten selbst
  // "Safari" im UA-String, echtes Safari nicht "Chrome"/"Edg".
  if (/Edg(A|iOS)?\//.test(ua)) return 'edge';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

export const usePwaInstallStore = defineStore('pwaInstall', () => {
  const isStandalone = ref(detectStandalone());
  const dismissed = ref(localStorage.getItem(DISMISSED_KEY) === 'true');
  const canPromptInstall = ref(false);
  const platform = detectPlatform();
  const browser = detectBrowser();
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  // Analog zu stores/theme.ts's init(): einmalig, explizit aus main.ts aufgerufen, statt die
  // Listener schon beim reinen Instanziieren des Stores zu registrieren - hier vor allem wichtig,
  // damit beforeinstallprompt so früh wie möglich (vor dem ersten App-Render) abgefangen wird.
  function init() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      canPromptInstall.value = true;
    });
    window.addEventListener('appinstalled', () => {
      isStandalone.value = true;
      deferredPrompt = null;
      canPromptInstall.value = false;
    });
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    canPromptInstall.value = false;
    await prompt.prompt();
    await prompt.userChoice;
  }

  function dismiss() {
    dismissed.value = true;
    localStorage.setItem(DISMISSED_KEY, 'true');
  }

  return {
    isStandalone,
    dismissed,
    canPromptInstall,
    platform,
    browser,
    init,
    promptInstall,
    dismiss,
  };
});
