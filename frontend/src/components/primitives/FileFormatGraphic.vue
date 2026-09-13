<script setup lang="ts">
import { computed, useId } from 'vue';

export type FileCategory =
  'pdf' | 'word' | 'excel' | 'powerpoint' | 'text' | 'archive' | 'audio' | 'generic';

const props = withDefaults(
  defineProps<{
    extension?: string;
    mimeType?: string;
    filename?: string;
    size?: number | 'sm' | 'md' | 'lg' | 'xl';
  }>(),
  {
    extension: '',
    mimeType: '',
    filename: '',
    size: 'md',
  }
);

const uid = useId();

const normalizedExt = computed<string>(() => {
  if (props.extension) {
    return props.extension.replace(/^\./, '').trim().toLowerCase();
  }
  if (props.filename) {
    const dot = props.filename.lastIndexOf('.');
    if (dot !== -1) {
      return props.filename.slice(dot + 1).toLowerCase();
    }
  }
  if (props.mimeType) {
    if (props.mimeType === 'application/pdf') return 'pdf';
    if (props.mimeType.includes('word') || props.mimeType.includes('document')) return 'docx';
    if (props.mimeType.includes('excel') || props.mimeType.includes('sheet')) return 'xlsx';
    if (props.mimeType.includes('powerpoint') || props.mimeType.includes('presentation'))
      return 'pptx';
    if (props.mimeType.includes('zip') || props.mimeType.includes('compressed')) return 'zip';
    if (props.mimeType.startsWith('text/')) return 'txt';
    if (props.mimeType.startsWith('audio/')) return 'mp3';
  }
  return 'file';
});

const category = computed<FileCategory>(() => {
  const ext = normalizedExt.value;
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return 'word';
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) return 'excel';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'powerpoint';
  if (['txt', 'md', 'markdown', 'log', 'json', 'yaml', 'yml', 'xml'].includes(ext)) return 'text';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive';
  if (['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'].includes(ext)) return 'audio';
  return 'generic';
});

const displayLabel = computed<string>(() => {
  const ext = normalizedExt.value.toUpperCase();
  if (ext === 'PDF') return 'PDF';
  if (['DOC', 'DOCX', 'ODT', 'RTF'].includes(ext)) return ext.slice(0, 4);
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) return ext.slice(0, 4);
  if (['PPT', 'PPTX'].includes(ext)) return ext.slice(0, 4);
  if (['TXT', 'MD'].includes(ext)) return ext;
  if (['ZIP', 'RAR', '7Z'].includes(ext)) return ext;
  if (category.value === 'audio') return 'AUDIO';
  if (ext.length > 0 && ext.length <= 4 && ext !== 'FILE') return ext;
  return 'DOC';
});

const pixelSize = computed<number>(() => {
  if (typeof props.size === 'number') return props.size;
  switch (props.size) {
    case 'sm':
      return 20;
    case 'md':
      return 26;
    case 'lg':
      return 36;
    case 'xl':
      return 48;
    default:
      return 26;
  }
});

interface ThemeConfig {
  gradStart: string;
  gradEnd: string;
  foldStart: string;
  foldEnd: string;
  accent: string;
  glow: string;
}

const theme = computed<ThemeConfig>(() => {
  switch (category.value) {
    case 'pdf':
      return {
        gradStart: '#f43f5e', // Vibrant rose-red
        gradEnd: '#be123c', // Deep ruby
        foldStart: '#fecdd3',
        foldEnd: '#fda4af',
        accent: '#ffffff',
        glow: 'rgba(244, 63, 94, 0.4)',
      };
    case 'word':
      return {
        gradStart: '#3b82f6', // Royal blue
        gradEnd: '#1d4ed8', // Dark cobalt
        foldStart: '#bfdbfe',
        foldEnd: '#93c5fd',
        accent: '#ffffff',
        glow: 'rgba(59, 130, 246, 0.4)',
      };
    case 'excel':
      return {
        gradStart: '#10b981', // Emerald green
        gradEnd: '#047857', // Deep forest
        foldStart: '#a7f3d0',
        foldEnd: '#6ee7b7',
        accent: '#ffffff',
        glow: 'rgba(16, 185, 129, 0.4)',
      };
    case 'powerpoint':
      return {
        gradStart: '#f97316', // Bright amber-orange
        gradEnd: '#c2410c', // Burnt orange
        foldStart: '#fed7aa',
        foldEnd: '#fdba74',
        accent: '#ffffff',
        glow: 'rgba(249, 115, 22, 0.4)',
      };
    case 'text':
      return {
        gradStart: '#64748b', // Slate
        gradEnd: '#334155', // Charcoal
        foldStart: '#cbd5e1',
        foldEnd: '#94a3b8',
        accent: '#ffffff',
        glow: 'rgba(100, 116, 139, 0.3)',
      };
    case 'archive':
      return {
        gradStart: '#f59e0b', // Golden amber
        gradEnd: '#b45309', // Dark bronze
        foldStart: '#fde68a',
        foldEnd: '#fcd34d',
        accent: '#ffffff',
        glow: 'rgba(245, 158, 11, 0.4)',
      };
    case 'audio':
      return {
        gradStart: '#a855f7', // Vivid purple
        gradEnd: '#6b21a8', // Deep violet
        foldStart: '#e9d5ff',
        foldEnd: '#d8b4fe',
        accent: '#ffffff',
        glow: 'rgba(168, 85, 247, 0.4)',
      };
    case 'generic':
    default:
      return {
        gradStart: '#06b6d4', // Cyan
        gradEnd: '#0e7490', // Deep ocean
        foldStart: '#cffafe',
        foldEnd: '#a5f3fc',
        accent: '#ffffff',
        glow: 'rgba(6, 182, 212, 0.35)',
      };
  }
});
</script>

<template>
  <div
    class="file-format-graphic"
    :style="{ width: `${pixelSize}px`, height: `${Math.round(pixelSize * 1.18)}px` }"
    :title="`${displayLabel}-Datei`"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 32 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="file-graphic-svg"
    >
      <defs>
        <!-- Hauptverlauf für den Dokumentkörper -->
        <linearGradient :id="`ff-grad-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="theme.gradStart" />
          <stop offset="100%" :stop-color="theme.gradEnd" />
        </linearGradient>

        <!-- Verlauf für die gefaltete Ecke (Dog-Ear) -->
        <linearGradient :id="`ff-fold-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="theme.foldStart" />
          <stop offset="100%" :stop-color="theme.foldEnd" />
        </linearGradient>

        <!-- Glanz-Highlight auf der oberen Hälfte -->
        <linearGradient :id="`ff-gloss-${uid}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>

        <!-- Schatten unter der gefalteten Ecke -->
        <linearGradient :id="`ff-fold-shadow-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.05" />
        </linearGradient>
      </defs>

      <!-- Dokument-Körper mit Schnitt für gefaltete Ecke -->
      <path
        d="M 6 2 H 21 L 29 10 V 33 A 3 3 0 0 1 26 36 H 6 A 3 3 0 0 1 3 33 V 5 A 3 3 0 0 1 6 2 Z"
        :fill="`url(#ff-grad-${uid})`"
      />

      <!-- Subtiler oberer Glanz / Wölbung -->
      <path
        d="M 6 2.5 H 20.5 L 28.5 10.5 V 20 C 28.5 20 18 18 3.5 22 V 5 A 2.5 2.5 0 0 1 6 2.5 Z"
        :fill="`url(#ff-gloss-${uid})`"
      />

      <!-- Schatten unter der Falte -->
      <path d="M 21 10 H 29 L 21 2 Z" :fill="`url(#ff-fold-shadow-${uid})`" />

      <!-- Gefaltete obere rechte Ecke (Folded Flap) -->
      <path
        d="M 21 2 V 7 A 3 3 0 0 0 24 10 H 29 Z"
        :fill="`url(#ff-fold-${uid})`"
        stroke="rgba(255, 255, 255, 0.4)"
        stroke-width="0.5"
      />

      <!-- Feiner Rand-Highlight oben & links -->
      <path
        d="M 6 2.5 H 20.5 M 3.5 5 V 33"
        stroke="rgba(255, 255, 255, 0.4)"
        stroke-width="0.8"
        stroke-linecap="round"
      />

      <!-- ============================================== -->
      <!-- Format-spezifische Grafiken & Embleme -->
      <!-- ============================================== -->

      <!-- PDF: Elegante weiße Acrobat-Kurve -->
      <g v-if="category === 'pdf'">
        <path
          d="M 9.5 21 C 8 19 8.5 15.5 10.5 14 C 12.5 12.5 14 14 15 16 C 16 18 17.5 21.5 21.5 21.5 C 23.5 21.5 24 19.5 23 18 C 21.5 16 18 16.8 15 17.5"
          fill="none"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="10.5" cy="14" r="1.2" fill="#ffffff" />
      </g>

      <!-- WORD: 3 Dokumentzeilen mit Einzug -->
      <g v-else-if="category === 'word'">
        <line
          x1="8"
          y1="13"
          x2="19"
          y2="13"
          stroke="#ffffff"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="8"
          y1="17"
          x2="24"
          y2="17"
          stroke="#ffffff"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="8"
          y1="21"
          x2="18"
          y2="21"
          stroke="#ffffff"
          stroke-width="2"
          stroke-linecap="round"
        />
      </g>

      <!-- EXCEL: Tabellen-Raster mit Kopfzeile -->
      <g v-else-if="category === 'excel'">
        <rect
          x="7.5"
          y="12"
          width="17"
          height="10.5"
          rx="1.5"
          fill="rgba(255, 255, 255, 0.15)"
          stroke="#ffffff"
          stroke-width="1.2"
        />
        <line x1="7.5" y1="15.5" x2="24.5" y2="15.5" stroke="#ffffff" stroke-width="1.2" />
        <line x1="13.5" y1="12" x2="13.5" y2="22.5" stroke="#ffffff" stroke-width="1" />
        <line x1="19" y1="12" x2="19" y2="22.5" stroke="#ffffff" stroke-width="1" />
      </g>

      <!-- POWERPOINT: Kreisdiagramm mit abgetrenntem Segment -->
      <g v-else-if="category === 'powerpoint'">
        <circle cx="16" cy="17" r="5.2" fill="none" stroke="#ffffff" stroke-width="1.6" />
        <path d="M 16 11.8 A 5.2 5.2 0 0 1 21.2 17 H 16 Z" fill="#ffffff" />
      </g>

      <!-- TEXT / CODE: Monospace Textzeilen -->
      <g v-else-if="category === 'text'">
        <line
          x1="8"
          y1="13"
          x2="14"
          y2="13"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="17"
          y1="13"
          x2="24"
          y2="13"
          stroke="rgba(255, 255, 255, 0.6)"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="8"
          y1="17"
          x2="22"
          y2="17"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="11"
          y1="21"
          x2="20"
          y2="21"
          stroke="rgba(255, 255, 255, 0.75)"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </g>

      <!-- ARCHIV (ZIP): Reißverschluss-Bahn mit Schieber -->
      <g v-else-if="category === 'archive'">
        <line
          x1="16"
          y1="11"
          x2="16"
          y2="24"
          stroke="#ffffff"
          stroke-width="2"
          stroke-linecap="square"
          stroke-dasharray="2 1.5"
        />
        <rect x="13.5" y="15" width="5" height="4.5" rx="1.2" fill="#ffffff" />
        <circle cx="16" cy="17.2" r="0.8" fill="#b45309" />
      </g>

      <!-- AUDIO: Frequenzbalken / Waveform -->
      <g v-else-if="category === 'audio'">
        <line
          x1="9"
          y1="16.5"
          x2="9"
          y2="19.5"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="12.5"
          y1="14"
          x2="12.5"
          y2="22"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="16"
          y1="12"
          x2="16"
          y2="24"
          stroke="#ffffff"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="19.5"
          y1="14.5"
          x2="19.5"
          y2="21.5"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="23"
          y1="17"
          x2="23"
          y2="19"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </g>

      <!-- GENERIC / DEFAULT: Zartes Dokument-Motiv -->
      <g v-else>
        <line
          x1="8"
          y1="14"
          x2="21"
          y2="14"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="8"
          y1="18"
          x2="24"
          y2="18"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <line
          x1="8"
          y1="22"
          x2="16"
          y2="22"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </g>

      <!-- ============================================== -->
      <!-- Kontrastreiches Typo-Badge im unteren Bereich -->
      <!-- ============================================== -->
      <rect x="4.5" y="25.5" width="23" height="8.5" rx="2" fill="rgba(0, 0, 0, 0.32)" />
      <text
        x="16"
        y="32"
        text-anchor="middle"
        font-size="6"
        font-weight="900"
        fill="#ffffff"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letter-spacing="0.5"
      >
        {{ displayLabel }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.file-format-graphic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  user-select: none;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.22));
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.file-graphic-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
</style>
