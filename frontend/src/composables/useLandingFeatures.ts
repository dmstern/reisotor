import type { Component } from 'vue';
import {
  IconCalendarEvent,
  IconPigMoney,
  IconListCheck,
  IconMapPin,
  IconBook,
} from '@tabler/icons-vue';

export interface ScrollyHighlight {
  text: string;
  screenshotLight?: string;
  screenshotDark?: string;
  screenshotMobileLight?: string;
  screenshotMobileDark?: string;
  alt?: string;
  routePill?: string;
}

export type HighlightItem = string | ScrollyHighlight;

export interface ScrollyFeature {
  id: string;
  kicker: string;
  title: string;
  description: string;
  highlights: HighlightItem[];
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

export interface DistinctFrame {
  id: string;
  stepIndex: number;
  highlightIndices: number[];
  screenshotLight: string;
  screenshotDark: string;
  screenshotMobileLight: string;
  screenshotMobileDark: string;
  routePill: string;
  alt: string;
}

export function getHighlightText(hl: HighlightItem): string {
  return typeof hl === 'string' ? hl : hl.text;
}

export function getHighlightScreenshot(
  feature: ScrollyFeature,
  highlightIndex: number
): {
  screenshotLight: string;
  screenshotDark: string;
  screenshotMobileLight: string;
  screenshotMobileDark: string;
  routePill: string;
  alt: string;
} {
  const maxIdx = Math.max(0, feature.highlights.length - 1);
  const clampedIdx = Math.max(0, Math.min(highlightIndex, maxIdx));

  // If the current highlight has an explicit screenshot, use it.
  // Otherwise, inherit from the most recent previous highlight with an explicit screenshot
  // to avoid jitter when multiple bullet points belong to the same screenshot.
  for (let i = clampedIdx; i >= 0; i--) {
    const hl = feature.highlights[i];
    if (hl && typeof hl === 'object' && hl.screenshotLight) {
      return {
        screenshotLight: hl.screenshotLight,
        screenshotDark: hl.screenshotDark ?? feature.screenshotDark,
        screenshotMobileLight: hl.screenshotMobileLight ?? feature.screenshotMobileLight,
        screenshotMobileDark: hl.screenshotMobileDark ?? feature.screenshotMobileDark,
        routePill: hl.routePill ?? feature.routePill,
        alt: hl.alt ?? feature.alt,
      };
    }
  }

  return {
    screenshotLight: feature.screenshotLight,
    screenshotDark: feature.screenshotDark,
    screenshotMobileLight: feature.screenshotMobileLight,
    screenshotMobileDark: feature.screenshotMobileDark,
    routePill: feature.routePill,
    alt: feature.alt,
  };
}

export function getFeatureDistinctFrames(feature: ScrollyFeature, stepIdx = 0): DistinctFrame[] {
  const frames: DistinctFrame[] = [];
  feature.highlights.forEach((_, hIdx) => {
    const sc = getHighlightScreenshot(feature, hIdx);
    const existing = frames.find((f) => f.screenshotLight === sc.screenshotLight);
    if (existing) {
      existing.highlightIndices.push(hIdx);
    } else {
      frames.push({
        id: `${feature.id}-${frames.length}`,
        stepIndex: stepIdx,
        highlightIndices: [hIdx],
        screenshotLight: sc.screenshotLight,
        screenshotDark: sc.screenshotDark,
        screenshotMobileLight: sc.screenshotMobileLight,
        screenshotMobileDark: sc.screenshotMobileDark,
        routePill: sc.routePill || feature.routePill,
        alt: sc.alt || feature.alt,
      });
    }
  });
  return frames;
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
        {
          text: 'Gemeinsamer Kalender mit Live-Synchronisation',
          screenshotLight: `${baseUrl}landing/screenshot-calendar-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-calendar-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-calendar-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-calendar-mobile-dark.png`,
          routePill: 'Kalender & Etappen',
        },
        {
          text: '14-Tage Wettervorhersage für das Reiseziel',
          screenshotLight: `${baseUrl}landing/screenshot-dashboard-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-dashboard-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-dashboard-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-dashboard-mobile-dark.png`,
          routePill: 'Dashboard & Wetter',
        },
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
      title: 'Spots speichern & Ausflugsideen planen',
      description:
        'Unterkünfte, Sehenswürdigkeiten und Ausflugsziele auf der Karte markieren. Die Touren-Ansicht verbindet besuchte Stationen mit eleganten Farbverläufen und interaktiven Routenpfaden.',
      highlights: [
        {
          text: 'Orte direkt über die App suchen und finden',
          screenshotLight: `${baseUrl}landing/screenshot-dialog-spot-create-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-dialog-spot-create-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-dialog-spot-create-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-dialog-spot-create-mobile-dark.png`,
          routePill: 'Spot-Suche',
        },
        {
          text: 'Integrierter Routenplaner für Fußwege, Auto und Fahrrad',
          screenshotLight: `${baseUrl}landing/screenshot-dialog-leg-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-dialog-leg-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-dialog-leg-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-dialog-leg-mobile-dark.png`,
          routePill: 'Routen- & Wegeplaner',
        },
        {
          text: 'Visuelle Tour-Pfade mit geschwungenen Verlaufslinien',
          screenshotLight: `${baseUrl}landing/screenshot-tour-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-tour-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-tour-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-tour-mobile-dark.png`,
          routePill: 'Touren-Verlauf',
        },
        {
          text: 'Kategorisierte Spots mit Notizen, Likes & Kommentaren',
          screenshotLight: `${baseUrl}landing/screenshot-spots-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-spots-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-spots-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-spots-mobile-dark.png`,
          routePill: 'Spots & Kategorien',
        },
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
        {
          text: 'Gemeinsame & persönliche Budget-Töpfe',
          screenshotLight: `${baseUrl}landing/screenshot-dialog-budget-pot-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-dialog-budget-pot-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-dialog-budget-pot-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-dialog-budget-pot-mobile-dark.png`,
          routePill: 'Budget-Töpfe',
        },
        {
          text: 'Automatischer Verrechnungs- und Ausgleichsrechner',
          screenshotLight: `${baseUrl}landing/screenshot-budget-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-budget-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-budget-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-budget-mobile-dark.png`,
          routePill: 'Ausgleichsrechner',
        },
        'Kategoriestatistiken & Ausgabenverlauf',
      ],
      icon: IconPigMoney,
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
        {
          text: 'Kategorisierte Listen mit Packfortschrittsbalken',
          screenshotLight: `${baseUrl}landing/screenshot-packing-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-packing-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-packing-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-packing-mobile-dark.png`,
          routePill: 'Packlisten-Übersicht',
        },
        {
          text: 'Zuweisung von Gegenständen an Mitreisende',
          screenshotLight: `${baseUrl}landing/screenshot-dialog-packing-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-dialog-packing-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-dialog-packing-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-dialog-packing-mobile-dark.png`,
          routePill: 'Gegenstand zuweisen',
        },
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
        {
          text: 'Gemeinsames Tagebuch für die Reisegruppe',
          screenshotLight: `${baseUrl}landing/screenshot-diary-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-diary-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-diary-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-diary-mobile-dark.png`,
          routePill: 'Reise-Tagebuch',
        },
        {
          text: 'Bilder mit GPS-Standort auf der Karte ansehen und als interaktives Karten-Fotoalbum festhalten',
          screenshotLight: `${baseUrl}landing/screenshot-map-photos-light.png`,
          screenshotDark: `${baseUrl}landing/screenshot-map-photos-dark.png`,
          screenshotMobileLight: `${baseUrl}landing/screenshot-map-photos-mobile-light.png`,
          screenshotMobileDark: `${baseUrl}landing/screenshot-map-photos-mobile-dark.png`,
          routePill: 'Karten-Fotoalbum',
        },
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
