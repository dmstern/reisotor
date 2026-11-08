<script setup lang="ts">
import { ref, computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { useToast } from '../../composables/useToast';

const props = withDefaults(
  defineProps<{
    /** Der zu kopierende Text */
    text: string;
    /** Barrierefreie Beschriftung und Hover-Titel */
    label?: string;
    /** Toast-Meldung nach erfolgreichem Kopieren */
    toastMessage?: string;
    /** Größe des Buttons: 'sm' (24px, 14px Icon), 'md' (28px, 16px Icon), 'lg' (32px, 18px Icon) */
    size?: 'sm' | 'md' | 'lg';
    /**
     * Wenn true, wird der Button auf Desktop-Mausgeräten nur beim Hovern
     * über die Zeile / den Container eingeblendet. Auf Touchscreens bleibt
     * er immer sichtbar.
     */
    hoverOnly?: boolean;
  }>(),
  {
    label: 'In die Zwischenablage kopieren',
    toastMessage: 'In die Zwischenablage kopiert.',
    size: 'sm',
    hoverOnly: true,
  }
);

const emit = defineEmits<{
  (e: 'copy', text: string): void;
}>();

const { showToast } = useToast();
const copied = ref(false);
let resetTimeout: ReturnType<typeof setTimeout> | null = null;

const iconSize = computed(() => {
  if (props.size === 'lg') {
    return 18;
  }

  if (props.size === 'md') {
    return 16;
  }

  return 14;
});

async function handleCopy(event: MouseEvent) {
  event.stopPropagation();

  if (!props.text) {
    return;
  }

  let success = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.text);
      success = true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = props.text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = props.text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      success = false;
    }
  }

  if (success) {
    copied.value = true;
    showToast({ message: props.toastMessage, type: 'success' });
    emit('copy', props.text);

    if (resetTimeout) {
      clearTimeout(resetTimeout);
    }

    resetTimeout = setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}
</script>

<template>
  <button
    type="button"
    class="copy-btn"
    :class="[
      `copy-btn--${size}`,
      {
        'copy-btn--hover-only': hoverOnly,
        'is-copied': copied,
      },
    ]"
    :aria-label="copied ? 'Kopiert!' : label"
    :title="copied ? 'Kopiert!' : label"
    @click="handleCopy"
  >
    <AppIcon
      :icon="copied ? ACTION_ICONS.check : ACTION_ICONS.copy"
      :size="iconSize"
      group="actions"
    />
  </button>
</template>

<style lang="scss" scoped>
.copy-btn {
  @include touch-target($size: 36px, $pseudo: 'before', $only-touch: false, $expand: true) {
    @media (pointer: coarse) {
      min-width: 44px;
      min-height: 44px;
    }
  }
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  box-sizing: border-box;
  flex-shrink: 0;
  vertical-align: middle;
  line-height: 1;
  transition:
    opacity 0.18s ease,
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);
  user-select: none;
}

/* Größen */
.copy-btn--sm {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
}

.copy-btn--md {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
}

.copy-btn--lg {
  width: 38px;
  height: 38px;
  min-width: 38px;
  min-height: 38px;
}

/* Standard: Auf Touch/Coarse dezent sichtbar (nicht aufdringlich, aber auffindbar) */
.copy-btn {
  opacity: 0.65;
}

.copy-btn:hover:not(.is-copied) {
  opacity: 1;
  color: var(--color-text);
  background-color: var(--color-hover);
}

.copy-btn:active:not(.is-copied) {
  transform: scale(0.92);
}

/* Desktop-Pointer: Erst bei Zeilen- oder Button-Hover sanft einblenden */
@media (hover: hover) and (pointer: fine) {
  .copy-btn--hover-only {
    opacity: 0;
    pointer-events: none;
  }

  :global(.detail-row:hover .copy-btn--hover-only),
  :global(.copy-container:hover .copy-btn--hover-only),
  :global(*:hover > .copy-btn--hover-only) {
    opacity: 0.65;
    pointer-events: auto;
  }

  :global(.detail-row:hover .copy-btn--hover-only:hover),
  :global(.copy-container:hover .copy-btn--hover-only:hover),
  .copy-btn--hover-only:hover {
    opacity: 1;
    pointer-events: auto;
  }
}

/* Barrierefreiheit: Tastatur-Navigation (Focus-Visible) MUSS immer sofort sichtbar sein */
.copy-btn:focus-visible {
  opacity: 1 !important;
  pointer-events: auto !important;
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
  background-color: var(--color-surface);
}

/* Erfolgs-Zustand nach dem Kopieren */
.copy-btn.is-copied {
  opacity: 1 !important;
  pointer-events: auto !important;
  color: var(--color-success, #16a34a);
  background-color: var(--color-success-tint, rgba(22, 163, 74, 0.12));
  border-color: var(--color-success, #16a34a);
  transform: scale(1.08);
}
</style>
