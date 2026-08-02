import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

// Häufige Reisewährungen als Auswahl (ProfileView.vue) – keine vollständige ISO-4217-Liste, deckt
// aber die in der Praxis relevanten Fälle ab. 'none' = kein Wechselkurs-Vergleich gewünscht (z. B.
// wenn alle Urlaube ohnehin in derselben Währung wie zuhause liegen).
export const HOME_CURRENCY_OPTIONS = [
  { value: 'none', label: 'Keinen Wechselkurs anzeigen' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US-Dollar (USD)' },
  { value: 'GBP', label: 'Britisches Pfund (GBP)' },
  { value: 'CHF', label: 'Schweizer Franken (CHF)' },
  { value: 'JPY', label: 'Japanischer Yen (JPY)' },
  { value: 'AUD', label: 'Australischer Dollar (AUD)' },
  { value: 'CAD', label: 'Kanadischer Dollar (CAD)' },
] as const;

export type HomeCurrency = (typeof HOME_CURRENCY_OPTIONS)[number]['value'];

const STORAGE_KEY = 'reisotor-home-currency';
const DEFAULT_CURRENCY: HomeCurrency = 'EUR';

function loadCurrency(): HomeCurrency {
  const stored = localStorage.getItem(STORAGE_KEY);
  return HOME_CURRENCY_OPTIONS.some((o) => o.value === stored) ? (stored as HomeCurrency) : DEFAULT_CURRENCY;
}

// Geräte-/Browser-UI-Einstellung (wie stores/weatherProvider.ts/stores/theme.ts) statt Account-
// Daten: bewusst nur lokal in localStorage gehalten, nicht am User-Datensatz im Backend – dieselbe
// Person kann auf verschiedenen Geräten eine andere "zuhause"-Währung hinterlegt haben wollen.
export const useHomeCurrencyStore = defineStore('homeCurrency', () => {
  const currency = ref<HomeCurrency>(loadCurrency());

  watch(currency, (v) => localStorage.setItem(STORAGE_KEY, v));

  return { currency };
});
