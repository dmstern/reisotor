<script setup lang="ts">
/**
 * PolaroidPhoto – ein wiederverwendbarer Polaroid-Foto-Rahmen.
 *
 * Stellt ein Bild (oder Slot-Inhalt als Platzhaler) in einem weißen Papier-Rahmen mit
 * leichtem Schlagschatten und abgerundeten Ecken dar, analog zu einem echten Polaroid-Foto.
 * Optional kann eine Bildunterschrift ("Chin") unter dem Foto angezeigt werden.
 *
 * Größe und Rotation werden über CSS Custom Properties gesteuert:
 *   --polaroid-padding     Außen-Rand des weißen Rahmens (Standard: 4px)
 *   --polaroid-chin-height Höhe des Chin-Bereichs (Standard: 28px)
 *   --polaroid-rotate      Rotations-Winkel (Standard: 0deg), nur aktiv mit prop rotated
 */

defineProps<{
  /** URL des anzuzeigenden Bilds. Ohne URL wird der `placeholder`-Slot gerendert. */
  imageUrl?: string | null;
  /** Alt-Text für das Bild. */
  alt?: string;
  /** Optionaler Kurztext für die Bildunterschrift ("Chin"). */
  caption?: string;
  /** Ob der Chin-Bereich angezeigt werden soll. */
  showChin?: boolean;
  /** Ob das Foto mit --polaroid-rotate gedreht dargestellt werden soll. */
  rotated?: boolean;
}>();
</script>

<template>
  <div class="polaroid" :class="{ 'polaroid--rotated': rotated }">
    <div class="polaroid-photo-frame">
      <img v-if="imageUrl" :src="imageUrl" :alt="alt ?? ''" class="polaroid-photo" loading="lazy" />
      <div v-else class="polaroid-placeholder">
        <slot name="placeholder" />
      </div>
      <slot name="overlay" />
    </div>
    <div v-if="showChin || caption || $slots.chin" class="polaroid-chin">
      <slot name="chin">
        <span v-if="caption" class="polaroid-caption">{{ caption }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.polaroid {
  display: inline-flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  padding: var(--polaroid-padding, 4px);
  box-sizing: border-box;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.14),
    0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transform-origin: center bottom;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1),
    box-shadow 0.25s ease;
  user-select: none;
}

.polaroid--rotated {
  transform: rotate(var(--polaroid-rotate, 0deg));
}

:root[data-theme='dark'] .polaroid {
  background: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.22);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid {
    background: #f1f5f9;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.4),
      0 1px 3px rgba(0, 0, 0, 0.22);
  }
}

.polaroid-photo-frame {
  flex: 1;
  border-radius: calc(var(--radius-sm-squircle, 6px) - 2px);
  overflow: hidden;
  position: relative;
  background: var(--color-surface-sunken, #f3f4f6);
}

.polaroid-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.polaroid-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.polaroid-placeholder :deep(svg) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
}

.polaroid-chin {
  height: var(--polaroid-chin-height, 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 2px;
  margin-top: var(--polaroid-padding, 4px);
  flex-shrink: 0;
}

.polaroid-caption {
  font-size: 0.72rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1;
  text-align: center;
}
</style>
