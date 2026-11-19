<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import AppIcon from '../AppIcon.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import { useSlots, computed, Comment, provide } from 'vue';

// Button-Primitive für alle Buttons (Formularknöpfe, Aktionsbuttons, Card-Actions, Icon-Only-Buttons) – siehe Issue #239.
// Unterstützt sowohl Text, Text + Icon als auch reine Icon-Buttons, sowie Link-Rendering (to/href).

const ICON_SIZE_XS = 16;
const ICON_SIZE_SM = 18;
const ICON_SIZE_MD = 20;
const ICON_SIZE_LG = 22;

const _props = withDefaults(
  defineProps<{
    /**
     * Button-Variante (Issue #810):
     * - 'primary': Haupt-Aktionsbutton (gefüllt mit --color-primary, leicht erhaben)
     * - 'secondary': Sekundärbutton (initial flach mit Rahmen, Progressive 3D bei Hover/Active)
     * - 'tonal': Sanft getönte Kontext-Aktion in Cards/Modals (initial flach, Progressive 3D bei Hover/Active)
     * - 'ghost': Leise Hilfsaktion ohne Rahmen/Schatten (Progressive 3D bei Hover/Active)
     * - 'danger': Destruktive Aktion (gefüllt mit --color-danger; mit secondary-Flag gerahmt & initial flach)
     * - 'overlay': Kontrast-gesicherter Frosted-Glass-Button auf Fotos/Bannern/Karten (initial schattenlos)
     *
     * Abwärtskompatible Übergangs-Aliase (werden am Ende von Phase 4 entfernt):
     * - 'card-action' → Alias für 'tonal'
     * - 'surface' → Alias für 'overlay'
     * - 'floating' → Freischwebender Liquid-Glass-Button (Map-FABs)
     * - 'glass' → Eingebetteter Glass-Button (Header-Pills)
     * - 'linked-entity' → Interne Variante für LinkedEntityButton.vue
     */
    variant?:
      | 'primary'
      | 'secondary'
      | 'tonal'
      | 'ghost'
      | 'danger'
      | 'overlay'
      | 'surface'
      | 'card-action'
      | 'floating'
      | 'glass'
      | 'linked-entity';
    /** Ob der Button als Sekundär-Variante gestylt werden soll (z. B. in Kombination mit variant="danger"). */
    secondary?: boolean;
    /** Button-Größe: 'xs' (30px), 'sm' (36px), 'md' (46px, Standard), 'lg' (52px). */
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
    icon?: IconDef;
    /** Form-Variante: 'squircle' (Standard), 'circle' (kreisrund) oder 'pill' (Pille/Stadium). */
    shape?: 'squircle' | 'circle' | 'pill';
    /** Ob der Button als aktiv/ausgewählt markiert ist (z. B. ausgewählter Avatar). */
    active?: boolean;
    /** Native Button-Type (Standard: 'button'). */
    type?: 'button' | 'submit' | 'reset';
    /** Deaktiviert-Zustand. */
    disabled?: boolean;
    /** Ladezustand: Zeigt einen rotierenden Spinner und deaktiviert Interaktionen. */
    loading?: boolean;
    /** Zugänglichkeits-Beschriftung (für Icon-only Buttons). */
    ariaLabel?: string;
    /** Tooltip/Titel. */
    title?: string;
    /** Ob der Button explizit im quadratischen Icon-Only-Modus gerendert werden soll. */
    iconOnly?: boolean;
    /** Vue-Router Ziel für Link-Buttons. */
    to?: RouteLocationRaw | string;
    /** Externer Link für a-Buttons. */
    href?: string;
    /** Expliziter HTML-Tag (Fallback). */
    as?: string;
  }>(),
  {
    variant: 'primary',
    secondary: false,
    size: 'md',
    shape: 'squircle',
    active: false,
    type: 'button',
    disabled: false,
    loading: false,
    iconOnly: false,
    to: undefined,
    href: undefined,
    as: undefined,
  }
);

const slots = useSlots();
const hasDefaultSlot = () =>
  !!slots.default && slots.default().some((node) => node.type !== Comment);

const btnClasses = computed(() => [
  `btn--${_props.variant}`,
  _props.secondary && _props.variant !== 'secondary' ? 'btn--secondary' : undefined,
  _props.size !== 'md' ? `btn--${_props.size}` : undefined,
  _props.shape !== 'squircle' ? `btn--${_props.shape}` : undefined,
  {
    'is-disabled': _props.disabled,
    'is-loading': _props.loading,
    'is-active': _props.active,
    'btn--icon-only':
      _props.iconOnly ||
      _props.shape === 'circle' ||
      (!hasDefaultSlot() && (!!_props.icon || _props.loading)),
    'icon-only':
      _props.iconOnly ||
      _props.shape === 'circle' ||
      (!hasDefaultSlot() && (!!_props.icon || _props.loading)),
  },
]);

const isSpinnerInverted = computed(
  () => !_props.secondary && (_props.variant === 'primary' || _props.variant === 'danger')
);

const iconSize = computed(() => {
  if (_props.size === 'xs') {
    return ICON_SIZE_XS;
  }

  if (_props.size === 'sm' || _props.variant === 'card-action' || _props.variant === 'tonal') {
    return ICON_SIZE_SM;
  }

  if (_props.size === 'lg') {
    return ICON_SIZE_LG;
  }

  return ICON_SIZE_MD;
});

provide(
  'buttonActive',
  computed(() => _props.active)
);
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    :aria-label="ariaLabel"
    :aria-busy="loading ? 'true' : undefined"
    :title="title"
    class="btn"
    :class="btnClasses"
  >
    <LoadingSpinner
      v-if="loading"
      :size="size === 'lg' ? 'md' : 'sm'"
      :inverted="isSpinnerInverted"
      decorative
      class="btn-spinner"
    />
    <AppIcon v-else-if="icon" :icon="icon" group="actions" :active="active" :size="iconSize" />
    <slot v-if="hasDefaultSlot()" />
  </RouterLink>
  <a
    v-else-if="href"
    :href="href"
    :aria-label="ariaLabel"
    :aria-busy="loading ? 'true' : undefined"
    :title="title"
    class="btn"
    :class="btnClasses"
  >
    <LoadingSpinner
      v-if="loading"
      :size="size === 'lg' ? 'md' : 'sm'"
      :inverted="isSpinnerInverted"
      decorative
      class="btn-spinner"
    />
    <AppIcon v-else-if="icon" :icon="icon" group="actions" :active="active" :size="iconSize" />
    <slot v-if="hasDefaultSlot()" />
  </a>
  <component
    v-else-if="as"
    :is="as"
    :aria-label="ariaLabel"
    :aria-pressed="active ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :title="title"
    class="btn"
    :class="btnClasses"
  >
    <LoadingSpinner
      v-if="loading"
      :size="size === 'lg' ? 'md' : 'sm'"
      :inverted="isSpinnerInverted"
      decorative
      class="btn-spinner"
    />
    <AppIcon v-else-if="icon" :icon="icon" group="actions" :active="active" :size="iconSize" />
    <slot v-if="hasDefaultSlot()" />
  </component>
  <button
    v-else
    :type="type"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :aria-pressed="active ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :title="title"
    class="btn"
    :class="btnClasses"
  >
    <LoadingSpinner
      v-if="loading"
      :size="size === 'lg' ? 'md' : 'sm'"
      :inverted="isSpinnerInverted"
      decorative
      class="btn-spinner"
    />
    <AppIcon v-else-if="icon" :icon="icon" group="actions" :active="active" :size="iconSize" />
    <slot v-if="hasDefaultSlot()" />
  </button>
</template>

<style lang="scss" scoped>
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--control-gap-md, var(--space-2));
  padding: 10px 18px;
  min-height: var(--control-height-md, 46px);
  box-sizing: border-box;
  font-size: var(--font-size-md);
  font-family: inherit;
  font-weight: 600;
  border-radius: var(--radius-btn-squircle, var(--radius-btn, 12px));
  corner-shape: squircle;
  /* Verlauf bis unter den (transparenten) Rand ziehen, sonst kachelt er dort und zeigt unten einen hellen Streifen */
  background-origin: border-box;
  cursor: pointer;
  box-shadow: none;
  transition: var(--transition-control);
  user-select: none;
}

.btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

@include can-hover {
  .btn:hover:not(:disabled):not(.is-disabled) {
    translate: 0 -1px;
    box-shadow: var(--shadow-control-hover);
  }
}

.btn:active:not(:disabled):not(.is-disabled) {
  transform: translateY(1px) scale(0.985);
  translate: 0 0;
  box-shadow: var(--shadow-control-active);
}

.btn:disabled,
.btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  box-shadow: none !important;
  transform: none !important;
  translate: none !important;
}

.btn.is-loading {
  opacity: 0.85;
  cursor: wait !important;
  pointer-events: none;
}

.btn-spinner {
  flex-shrink: 0;
}

a.btn.is-disabled,
a.btn.is-loading {
  pointer-events: none;
}

.btn--circle {
  border-radius: var(--radius-full);
  corner-shape: round;
  padding: 0;
  flex-shrink: 0;
  width: var(--control-height-md, 46px);
  height: var(--control-height-md, 46px);
  min-width: var(--control-height-md, 46px);
  min-height: var(--control-height-md, 46px);
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
}

.btn--pill {
  border-radius: var(--radius-pill);
  corner-shape: round;
}

/* Primary CTA: einzige dauerhaft leicht erhabene Standard-Variante für klare Hierarchie */
.btn--primary {
  background-color: var(--color-primary);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  color: var(--color-primary-contrast, white);
  border: 1.5px solid transparent;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 1px 2px rgba(0, 0, 0, 0.12),
    0 2px 4px rgba(0, 0, 0, 0.08);
}

@include can-hover {
  .btn--primary:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-primary-dark);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 3px 8px rgba(0, 0, 0, 0.16),
      0 1px 3px rgba(0, 0, 0, 0.1);
  }
}

.btn--primary:active:not(:disabled):not(.is-disabled) {
  background-color: var(--color-primary-dark);
  box-shadow:
    inset 0 1.5px 3px rgba(0, 0, 0, 0.25),
    0 1px 1px rgba(0, 0, 0, 0.06);
}

/* Secondary: initial ruhig & flach mit Rahmen, Progressive 3D erst bei Hover/Active (#810) */
.btn--secondary {
  @include control-physics-progressive;
  background-color: var(--color-surface);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border-strong);
}

.btn--secondary.btn--icon-only,
.btn--secondary.icon-only {
  color: var(--color-text);
}

@include can-hover {
  .btn--secondary:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-hover);
    border-color: var(--color-primary);
  }
}

.btn--secondary:active:not(:disabled):not(.is-disabled) {
  background-color: var(--color-control-active-bg);
}

/* Danger Solid CTA */
.btn--danger {
  background-color: var(--color-danger);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  color: white;
  border: 1.5px solid transparent;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 1px 2px rgba(0, 0, 0, 0.14),
    0 2px 4px rgba(0, 0, 0, 0.08);
}

@include can-hover {
  .btn--danger:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-danger-dark, #b91c1c);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 3px 8px rgba(0, 0, 0, 0.18),
      0 1px 3px rgba(0, 0, 0, 0.1);
  }
}

.btn--danger:active:not(:disabled):not(.is-disabled) {
  background-color: var(--color-danger-dark, #b91c1c);
  box-shadow:
    inset 0 1.5px 3px rgba(0, 0, 0, 0.25),
    0 1px 1px rgba(0, 0, 0, 0.06);
}

/* Danger Secondary: initial flach mit rotem Rahmen, Progressive 3D bei Hover/Active */
.btn--danger.btn--secondary {
  @include control-physics-progressive;
  background-color: transparent;
  color: var(--color-danger);
  border: 1.5px solid var(--color-danger);
}

@include can-hover {
  .btn--danger.btn--secondary:hover:not(:disabled):not(.is-disabled) {
    background-color: color-mix(in srgb, var(--color-danger) 12%, transparent);
    border-color: var(--color-danger-dark, #b91c1c);
    color: var(--color-danger-dark, #b91c1c);
  }
}

.btn--danger.btn--secondary:active:not(:disabled):not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-danger) 18%, transparent);
}

/* Tonal (und Übergangs-Alias card-action): sanft getönte Kontext-Aktion, initial flach -> Progressive 3D */
.btn--tonal,
.btn--card-action {
  @include control-physics-progressive;
  @include touch-target($expand: true);
  gap: var(--control-gap-sm, 6px);
  padding: 6px 12px;
  min-height: var(--control-height-sm, 36px);
  border: 1.5px solid transparent;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background-color: var(--color-control-active-tint);
  color: var(--color-primary-dark);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  line-height: 1.3;
}

@include can-hover {
  .btn--tonal:hover:not(:disabled):not(.is-disabled),
  .btn--card-action:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-control-active-tint-hover);
    border-color: var(--color-primary);
  }
}

.btn--tonal:active:not(:disabled):not(.is-disabled),
.btn--card-action:active:not(:disabled):not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
}

/* Ghost: transparent im Ruhezustand, ruhiger flacher Hover ohne 3D-Verlauf/Schatten (#810) */
.btn--ghost {
  background-color: transparent;
  background-image: none;
  border: 1px solid transparent;
  color: var(--color-text);
  box-shadow: none;
}

@include can-hover {
  .btn--ghost:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-control-hover-bg);
    box-shadow: none;
    translate: none;
  }
}

.btn--ghost:active:not(:disabled):not(.is-disabled) {
  background-color: var(--color-control-active-bg);
  box-shadow: none;
  transform: scale(0.96);
  translate: none;
}

/* Overlay (und Übergangs-Alias surface): Frosted Glass über Fotos/Bannern/Karten, initial schattenlos (#810) */
.btn--overlay,
.btn--surface {
  @include control-overlay-interactive;
}

/* Floating Buttons: Liquid-Glass-Style für frei schwebende Map-FABs (#701, #729) */
.btn--floating {
  @include control-glass-interactive('floating');
}

.btn--floating.is-active,
.btn--floating.active {
  background-color: var(--color-primary);
  background-image: none;
  backdrop-filter: var(--backdrop-blur-md);
  color: var(--color-primary-contrast, white);
  border-color: var(--color-primary-dark);
  box-shadow: var(--shadow-floating-island);

  @include can-hover {
    &:hover:not(:disabled):not(.is-disabled) {
      background-color: var(--color-primary-dark);
      box-shadow: var(--shadow-floating-island-hover);
      translate: 0 -1.5px;
    }
  }

  &:active:not(:disabled):not(.is-disabled) {
    background-color: var(--color-primary-dark);
    box-shadow: var(--shadow-floating-island-active);
    transform: translateY(1px) scale(0.985);
    translate: 0 0;
  }
}

/* Glass Buttons: Transluzente Glaskapsel für Bedienelemente innerhalb von Glass-Pills/Headern */
.btn--glass {
  @include control-glass-interactive('embedded');
}

.btn--glass.is-active,
.btn--glass.active {
  background-color: var(--color-control-active-tint);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary-dark);
  box-shadow: inset 0 1px 0.5px rgba(255, 255, 255, 0.4);
}

/* Aktiver Zustand für körperhafte sekundäre/getönte Button-Varianten */
.btn--secondary.is-active,
.btn--overlay.is-active,
.btn--surface.is-active,
.btn--tonal.is-active,
.btn--card-action.is-active {
  --control-grad-top: var(--gradient-control-top);
  --control-grad-bottom: var(--gradient-control-bottom);
  background-color: var(--color-control-active-tint);
  background-image: linear-gradient(
    180deg,
    var(--control-grad-top) 0%,
    var(--control-grad-bottom) 100%
  );
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary-dark);
  box-shadow:
    0 0 0 1px var(--color-primary),
    var(--shadow-control);
  font-weight: 700;
}

@include can-hover {
  .btn--secondary.is-active:hover:not(:disabled):not(.is-disabled),
  .btn--overlay.is-active:hover:not(:disabled):not(.is-disabled),
  .btn--surface.is-active:hover:not(:disabled):not(.is-disabled),
  .btn--tonal.is-active:hover:not(:disabled):not(.is-disabled),
  .btn--card-action.is-active:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-control-active-tint-hover);
    border-color: var(--color-primary-dark);
    box-shadow:
      0 0 0 1px var(--color-primary-dark),
      var(--shadow-control-hover);
  }
}

.btn--secondary.is-active:active:not(:disabled):not(.is-disabled),
.btn--overlay.is-active:active:not(:disabled):not(.is-disabled),
.btn--surface.is-active:active:not(:disabled):not(.is-disabled),
.btn--tonal.is-active:active:not(:disabled):not(.is-disabled),
.btn--card-action.is-active:active:not(:disabled):not(.is-disabled) {
  box-shadow:
    0 0 0 1px var(--color-primary-dark),
    var(--shadow-control-active);
}

.btn--secondary.is-active:focus-visible,
.btn--overlay.is-active:focus-visible,
.btn--surface.is-active:focus-visible,
.btn--tonal.is-active:focus-visible,
.btn--card-action.is-active:focus-visible {
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface)), var(--shadow-control);
}

/* Aktiver Zustand für Ghost: bleibt flach & ruhig (weicher Primary-Tint ohne 3D/Schatten) */
.btn--ghost.is-active {
  background-color: var(--color-control-active-tint);
  background-image: none;
  border-color: color-mix(in srgb, var(--color-primary) 28%, transparent);
  color: var(--color-primary-dark);
  box-shadow: none;
  font-weight: 600;
}

@include can-hover {
  .btn--ghost.is-active:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-control-active-tint-hover);
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
    box-shadow: none;
    translate: none;
  }
}

.btn--ghost.is-active:active:not(:disabled):not(.is-disabled) {
  background-color: var(--color-control-active-tint-hover);
  box-shadow: none;
  transform: scale(0.96);
  translate: none;
}

.btn--ghost.is-active:focus-visible {
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.btn--primary.is-active {
  background-color: var(--color-primary-dark);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.2),
    var(--shadow-sm);
}

/* Einheitliche Größenstufen (Issue #810): xs (30px), sm (36px), md (46px), lg (52px) */
.btn--xs {
  @include touch-target($expand: true);
  gap: var(--control-gap-xs, 4px);
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  min-height: var(--control-height-xs, 30px);
  border-radius: var(--control-radius-xs-squircle, 8px);
  box-sizing: border-box;
}

.btn--sm {
  @include touch-target($expand: true);
  gap: var(--control-gap-sm, 6px);
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  min-height: var(--control-height-sm, 36px);
  border-radius: var(--control-radius-sm-squircle, 9.5px);
  box-sizing: border-box;
}

.btn--lg {
  gap: var(--control-gap-md, 8px);
  padding: 12px 22px;
  font-size: var(--font-size-md);
  min-height: var(--control-height-lg, 52px);
  border-radius: var(--control-radius-lg-squircle, 14px);
  box-sizing: border-box;
}

/* Pill & Circle behalten immer ihre vollrunde Form unabhängig von xs/sm/lg */
.btn--pill.btn--xs,
.btn--pill.btn--sm,
.btn--pill.btn--lg,
.btn--circle.btn--xs,
.btn--circle.btn--sm,
.btn--circle.btn--lg {
  border-radius: var(--radius-pill);
  corner-shape: round;
}

/* Icon-only Modus */
.btn--icon-only,
.btn.icon-only {
  padding: 0;
  gap: 0;
  flex-shrink: 0;
  width: var(--control-height-md, 46px);
  height: var(--control-height-md, 46px);
  min-width: var(--control-height-md, 46px);
  min-height: var(--control-height-md, 46px);
  font-size: 1.3rem;
}

.btn--icon-only.btn--xs,
.btn.icon-only.btn--xs,
.btn--circle.btn--xs {
  width: var(--control-height-xs, 30px);
  height: var(--control-height-xs, 30px);
  min-width: var(--control-height-xs, 30px);
  min-height: var(--control-height-xs, 30px);
  font-size: 0.95rem;
}

.btn--icon-only.btn--sm,
.btn.icon-only.btn--sm,
.btn--circle.btn--sm {
  width: var(--control-height-sm, 36px);
  height: var(--control-height-sm, 36px);
  min-width: var(--control-height-sm, 36px);
  min-height: var(--control-height-sm, 36px);
  font-size: 1.1rem;
}

.btn--icon-only.btn--lg,
.btn.icon-only.btn--lg,
.btn--circle.btn--lg {
  width: var(--control-height-lg, 52px);
  height: var(--control-height-lg, 52px);
  min-width: var(--control-height-lg, 52px);
  min-height: var(--control-height-lg, 52px);
  font-size: 1.5rem;
}

/* Linked-Entity Pill: harmonisiert auf sm-Grundlinie (36px) & Progressive 3D (#810) */
.btn--linked-entity {
  @include control-physics-progressive;
  @include touch-target($expand: true);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--control-gap-sm, 6px);
  min-height: var(--control-height-sm, 36px);
  max-width: 100%;
  min-width: 0;
  padding: var(--space-1) 12px var(--space-1) 6px;
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  corner-shape: round;
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  line-height: 1.3;
  text-decoration: none;
}

@include can-hover {
  .btn--linked-entity:hover:not(:disabled):not(.is-disabled) {
    background-color: var(--color-hover);
    border-color: var(--color-primary);
  }
}

.btn--linked-entity:active:not(:disabled):not(.is-disabled) {
  background-color: var(--color-hover);
}

.btn--linked-entity.is-warning {
  border-color: var(--color-warning);
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .btn:hover:not(:disabled):not(.is-disabled),
  .btn:active:not(:disabled):not(.is-disabled) {
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease,
      opacity 0.15s ease !important;
    translate: none !important;
    transform: none !important;
  }
}
</style>
