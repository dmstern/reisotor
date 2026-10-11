import type { Component } from 'vue';
import {
  IconCalendarEvent,
  IconCoin,
  IconListCheck,
  IconMapPin,
  IconBook,
} from '@tabler/icons-vue';

export interface ScrollyFeature {
  id: string;
  kicker: string;
  title: string;
  description: string;
  highlights: string[];
  icon: Component;
  color: string;
  iconBg: string;
  screenshotLight: string;
  screenshotDark: string;
  screenshotMobileLight: string;
  screenshotMobileDark: string;
  alt: string;
  routePill: string;
}

export interface UseLandingFeaturesOptions {
  baseUrl?: string;
  repoUrl?: string;
  demoUrl?: string;
  storybookUrl?: string;
}

export function getBaseUrl(envBaseUrl?: string): string {
  const raw =
    envBaseUrl ??
    (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/');
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function getScrollyFeatures(baseUrl: string): ScrollyFeature[] {
  return [
    {
      id: 'dashboard',
      kicker: 'ZENTRALE REISEÜBERSICHT',
      title: 'Alles an einem Ort: Euer Urlaubs-Dashboard',
      description:
        'Der gemeinsame Startpunkt für euren Urlaub: Termine, Etappen, Countdown und 14-Tage-Wettervorhersage auf einen Blick. Der integrierte Kalender hält alle Mitreisenden live synchron.',
      highlights: [
        'Gemeinsamer Kalender mit Live-Synchronisation',
        '14-Tage Wettervorhersage für das Reiseziel',
        'Flug- & Unterkunfts-Countdown auf einen Blick',
        'Schnellzugriffs-Kacheln für Status-Überblick (Budgets, Packliste & Co.)',
      ],
      icon: IconCalendarEvent,
      color: 'var(--color-primary)',
      iconBg: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
      screenshotLight: `${baseUrl}landing/screenshot-dashboard-light.png`,
      screenshotMobileLight: `${baseUrl}landing/screenshot-dashboard-mobile-light.png`,
      screenshotMobileDark: `${baseUrl}landing/screenshot-dashboard-mobile-dark.png`,
      screenshotDark: `${baseUrl}landing/screenshot-dashboard-dark.png`,
      alt: 'Reisotor Dashboard mit Kalender und Wetter',
      routePill: 'Dashboard & Kalender',
    },
    {
      id: 'spots',
      kicker: 'INTERAKTIVE KARTE & ROUTEN',
      title: 'Spots & Touren mit dynamischem Routen-Verlauf',
      description:
        'Unterkünfte, Sehenswürdigkeiten und Ausflugsziele auf der Karte markieren. Die neue Tour-Ansicht verbindet besuchte Stationen mit eleganten Farbverläufen und gestrichelten Linien.',
      highlights: [
        'Visuelle Tour-Pfade mit geschwungenen Verlaufslinien',
        'Kategorisierte Spots mit Notizen, Likes & Kommentaren',
        'Offline-fähige Navigation auf der Karte',
        'An- und Abreise mit Tickets und Umsteigezeiten tracken',
      ],
      icon: IconMapPin,
      color: 'var(--color-tour)',
      iconBg: 'color-mix(in srgb, var(--color-tour) 15%, transparent)',
      screenshotLight: `${baseUrl}landing/screenshot-tour-light.png`,
      screenshotMobileLight: `${baseUrl}landing/screenshot-tour-mobile-light.png`,
      screenshotMobileDark: `${baseUrl}landing/screenshot-tour-mobile-dark.png`,
      screenshotDark: `${baseUrl}landing/screenshot-tour-dark.png`,
      alt: 'Reisotor Spots und Tourenansicht mit Routenverlauf',
      routePill: 'Spots & Touren',
    },
    {
      id: 'budget',
      kicker: 'TRANSPARENTE FINANZEN',
      title: 'Budget & Ausgaben ohne Tabellen-Chaos',
      description:
        'Wer hat was bezahlt? Erfasst Ausgaben in gemeinsamen oder persönlichen Töpfen. Reisotor berechnet den automatischen Schuldenausgleich transparent und ohne Kopfzerbrechen.',
      highlights: [
        'Gemeinsame & persönliche Budget-Töpfe',
        'Automatischer Verrechnungs- und Ausgleichsrechner',
        'Kategoriestatistiken & Ausgabenverlauf',
      ],
      icon: IconCoin,
      color: 'var(--color-success)',
      iconBg: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
      screenshotLight: `${baseUrl}landing/screenshot-budget-light.png`,
      screenshotMobileLight: `${baseUrl}landing/screenshot-budget-mobile-light.png`,
      screenshotMobileDark: `${baseUrl}landing/screenshot-budget-mobile-dark.png`,
      screenshotDark: `${baseUrl}landing/screenshot-budget-dark.png`,
      alt: 'Reisotor Budget und Ausgabenübersicht',
      routePill: 'Budget & Kasse',
    },
    {
      id: 'packing',
      kicker: 'PERFEKT VORBEREITET',
      title: 'Packlisten & Vorräte gemeinsam abhaken',
      description:
        'Nichts vergessen – strukturierte Listen für Kleidung, Dokumente, Reiseapotheke und Vorräte. Weist Gegenstände Personen zu und verfolgt den Packfortschritt in Echtzeit.',
      highlights: [
        'Kategorisierte Listen mit Packfortschrittsbalken',
        'Zuweisung von Gegenständen an Mitreisende',
        '100% offline nutzbar im Flugzeug und unterwegs',
      ],
      icon: IconListCheck,
      color: 'var(--color-warning)',
      iconBg: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
      screenshotLight: `${baseUrl}landing/screenshot-packing-light.png`,
      screenshotMobileLight: `${baseUrl}landing/screenshot-packing-mobile-light.png`,
      screenshotMobileDark: `${baseUrl}landing/screenshot-packing-mobile-dark.png`,
      screenshotDark: `${baseUrl}landing/screenshot-packing-dark.png`,
      alt: 'Reisotor Packlisten und Einkäufe',
      routePill: 'Packlisten & Einkauf',
    },
    {
      id: 'diary',
      kicker: 'REISE-TAGEBUCH',
      title: 'Erinnerungen festhalten und teilen',
      description:
        'Dokumentiert eure schönsten Momente. Verknüpft Tagebucheinträge automatisch mit Ausflügen und teilt eure Notizen und Bilder mit der ganzen Gruppe.',
      highlights: [
        'Gemeinsames Tagebuch für die Reisegruppe',
        'Direkte Verknüpfung mit Spots und Touren',
        'Offline-verfügbar für das Schreiben unterwegs',
      ],
      icon: IconBook,
      color: 'var(--color-accent-secondary)',
      iconBg: 'color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)',
      screenshotLight: `${baseUrl}landing/screenshot-diary-light.png`,
      screenshotMobileLight: `${baseUrl}landing/screenshot-diary-mobile-light.png`,
      screenshotMobileDark: `${baseUrl}landing/screenshot-diary-mobile-dark.png`,
      screenshotDark: `${baseUrl}landing/screenshot-diary-dark.png`,
      alt: 'Reisotor Tagebuch mit Einträgen und Fotos',
      routePill: 'Tagebuch & Fotos',
    },
  ];
}

/**
 * Verwaltet die Feature-Beschreibungen, Screenshots, Bildpfade und Links
 * der öffentlichen Landingpage.
 */
export function useLandingFeatures(options: UseLandingFeaturesOptions = {}) {
  const baseUrl = getBaseUrl(options.baseUrl);
  const repoUrl =
    options.repoUrl ??
    (typeof __REPO_URL__ !== 'undefined' ? __REPO_URL__ : 'https://github.com/dmstern/reisotor');
  const demoUrl = options.demoUrl ?? './demo/';
  const storybookUrl = options.storybookUrl ?? './storybook/';

  const scrollyFeatures = getScrollyFeatures(baseUrl);

  return {
    baseUrl,
    repoUrl,
    demoUrl,
    storybookUrl,
    scrollyFeatures,
  };
}
