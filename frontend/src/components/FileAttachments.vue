<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Attachment, AttachmentDomain } from '../api/types';
import { compressImage } from '../utils/imageCompression';
import { readAsDataUrl } from '../utils/fileUpload';
import Button from './primitives/Button.vue';
import PolaroidStack from './primitives/PolaroidStack.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useAuthStore } from '../stores/auth';
import AttachmentPreviewModal from './AttachmentPreviewModal.vue';
import AttachmentThumbnails from './AttachmentThumbnails.vue';

const auth = useAuthStore();

// Wiederverwendbare Datei-Anhänge (Tickets/Dokumente) für Reise/Unterkunft/Notizen/Termine/Budget
// (siehe backend/src/routes/attachments.ts) – kapselt GET/POST/DELETE /attachments komplett, damit
// sie 1:1 per <FileAttachments domain="..." :entity-id="item.id" /> in mehrere Views eingebunden
// werden kann, analog zum uploadFiles()-Muster in DiaryView.vue (dort images-Array statt eigener
// Anhang-Tabelle, da Tagebuch-Bilder inline im Beitrag gerendert werden statt als Anhangsliste).
const props = withDefaults(
  defineProps<{
    domain: AttachmentDomain;
    entityId: number;
    /** Steuert, ob Hinzufügen/Löschen von Anhängen möglich ist - Standard AN, damit bestehende
     *  Einbindungen ohne diese Prop unverändert funktionieren. Detail-/Ansichts-Dialoge (kein
     *  Bearbeiten-Kontext, z. B. TravelDetailDialog.vue) setzen das explizit
     *  aus: Anhänge bleiben dort weiterhin sichtbar/herunterladbar, nur eben nicht änderbar - der
     *  Datei-Upload-Button gehört ins jeweilige Bearbeiten-Formular, nicht in die reine Ansicht. */
    editable?: boolean;
    /** Kompakte Badge-Ansicht für eingeklappte Spot-Karten: Zeigt anstelle des vollen
     *  Polaroid-Stapels ein dezentes Büroklammer-Badge mit der Anzahl der Anhänge. Klick auf das
     *  Badge öffnet direkt die Datei-Vorschau. */
    collapsed?: boolean;
    /** Ermöglicht das direkte Übergeben von Anhängen (z. B. für Unit-Tests oder Preloading) */
    initialAttachments?: Attachment[];
  }>(),
  { editable: true, collapsed: false }
);

const attachments = ref<Attachment[]>(props.initialAttachments ?? []);
const uploading = ref(false);
const error = ref('');
const previewOpen = ref(false);
const previewIndex = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

const badgeTooltip = computed(() => {
  const count = attachments.value.length;
  if (!count) return '';
  return `${count} ${count === 1 ? 'Anhang' : 'Anhänge'} (Klicken für Vorschau)`;
});

function openPreview(index?: number) {
  previewIndex.value = typeof index === 'number' ? index : 0;
  previewOpen.value = true;
}

async function load() {
  if (props.initialAttachments) return;
  attachments.value = await api.get<Attachment[]>(
    `/attachments?domain=${props.domain}&entity_id=${props.entityId}`
  );
}

function onAttachmentsChanged(e: Event) {
  if (props.initialAttachments) return;
  const custom = e as CustomEvent<{ domain: string; entityId: number }>;
  if (
    custom.detail &&
    custom.detail.domain === props.domain &&
    custom.detail.entityId === props.entityId
  ) {
    load();
  }
}

onMounted(() => {
  load();
  if (typeof window !== 'undefined') {
    window.addEventListener('attachments-changed', onAttachmentsChanged);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('attachments-changed', onAttachmentsChanged);
  }
});

watch(
  () => props.collapsed,
  () => {
    load();
  }
);

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (!files.length) return;

  uploading.value = true;
  error.value = '';
  try {
    for (const file of files) {
      const data = file.type.startsWith('image/')
        ? await compressImage(file)
        : await readAsDataUrl(file);
      const created = await api.post<Attachment>('/attachments', {
        domain: props.domain,
        entity_id: props.entityId,
        data,
        filename: file.name,
      });
      attachments.value.push(created);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('attachments-changed', {
          detail: { domain: props.domain, entityId: props.entityId },
        })
      );
    }
  } catch {
    error.value = 'Datei-Upload fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    uploading.value = false;
  }
}

async function remove(attachment: Attachment) {
  await api.delete(`/attachments/${attachment.id}`);
  attachments.value = attachments.value.filter((a) => a.id !== attachment.id);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('attachments-changed', {
        detail: { domain: props.domain, entityId: props.entityId },
      })
    );
  }
}
</script>

<template>
  <!-- Im reinen Ansichtsmodus (editable=false) ohne jeden Anhang komplett weglassen statt einer
       leeren "Anhänge"-Überschrift ohne Inhalt und ohne Möglichkeit, etwas hinzuzufügen. -->
  <div
    v-if="editable || attachments.length"
    class="file-attachments"
    :class="{ 'is-collapsed': collapsed }"
  >
    <!-- Im eingeklappten Ansichtsmodus (z. B. auf Spots): dezentes Büroklammer-Badge mit Anzahl -->
    <div v-if="collapsed && !editable" class="attachments-badge-wrap">
      <button
        type="button"
        class="attachments-badge"
        :title="badgeTooltip"
        :aria-label="badgeTooltip"
        @click.stop="openPreview(0)"
      >
        <AppIcon :icon="ACTION_ICONS.attachment" :size="13" group="actions" />
        <span class="attachments-badge-count">{{ attachments.length }}</span>
      </button>
    </div>

    <!-- Im regulären Ansichtsmodus: verspielter Polaroid-Stapel mit Büroklammer -->
    <template v-else>
      <h4 class="heading">Anhänge</h4>
      <!-- Im Ansichtsmodus: verspielter Polaroid-Stapel mit Büroklammer -->
      <div v-if="!editable && attachments.length" class="attachments-polaroid-wrap">
        <PolaroidStack :items="attachments" clipped @click="(idx) => openPreview(idx)" />
      </div>
      <!-- Im Bearbeiten-Modus: Thumbnails mit Direkt-Löschen-Badges -->
      <AttachmentThumbnails
        v-else-if="attachments.length"
        :items="attachments"
        :editable="editable"
        remove-title="Anhang löschen"
        remove-aria-label="Anhang löschen"
        @click="openPreview"
        @remove="(index) => remove(attachments[index])"
      />

      <p v-if="editable && auth.user?.restricted" class="hint">
        Eingeschränkter Modus - Kein Datei-Upload möglich
      </p>
      <div v-else-if="editable" class="upload-control">
        <input
          ref="fileInputRef"
          type="file"
          class="file-input-hidden"
          accept="image/*,application/pdf"
          multiple
          aria-label="Datei auswählen"
          :disabled="uploading"
          @change="onFilesSelected"
        />
        <Button
          variant="secondary"
          size="sm"
          :icon="ACTION_ICONS.add"
          :disabled="uploading"
          type="button"
          @click="fileInputRef?.click()"
        >
          {{ uploading ? 'Lädt hoch …' : 'Datei hinzufügen' }}
        </Button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </template>

    <AttachmentPreviewModal
      v-model="previewOpen"
      :attachments="attachments"
      :initial-index="previewIndex"
      :editable="editable"
      @remove="(index) => remove(attachments[index])"
    />
  </div>
</template>

<style scoped>
.file-attachments {
  margin-top: var(--space-3);
}

.file-attachments.is-collapsed {
  margin-top: 0;
}

.attachments-badge-wrap {
  display: inline-flex;
}

.attachments-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-pill);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition:
    transform 0.18s cubic-bezier(0.32, 0.72, 0, 1),
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  user-select: none;
}

.attachments-badge:hover {
  background: rgba(0, 0, 0, 0.75);
  border-color: rgba(255, 255, 255, 0.45);
  transform: scale(1.06);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
}

.attachments-badge:active {
  transform: scale(0.96);
}

.attachments-badge:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.attachments-badge-count {
  font-size: 0.75rem;
  font-weight: 600;
}

.heading {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.attachments-polaroid-wrap {
  padding: 4px 0 6px 4px;
}

.file-input-hidden {
  display: none;
}

.hint {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin: 0;
}

.error {
  color: var(--color-danger);
  font-size: 0.8rem;
  margin-top: var(--space-1);
}
</style>
