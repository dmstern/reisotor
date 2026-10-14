<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Period, User } from '../api/types';
import type { ShoppingFormInput } from '../composables/useShoppingList';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useToast } from '../composables/useToast';
import { PERIOD_META } from '../utils/period';
import { ACTION_ICONS } from '../utils/actionIcons';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Combobox from './Combobox.vue';
import Button from './primitives/Button.vue';
import Accordion from './primitives/Accordion.vue';
import AppIcon from './AppIcon.vue';
import DraftStatusBar from './DraftStatusBar.vue';

const props = defineProps<{
  users: User[];
  knownShops: string[];
}>();

const emit = defineEmits<{
  (e: 'submit', form: ShoppingFormInput): void;
}>();

const { showToast } = useToast();

const newLabel = ref('');
const newBuyer = ref('');
const newLink = ref('');
const newNote = ref('');
const newShop = usePersistedRef('reisotor-shopping-last-shop', '');
const newPeriod = usePersistedRef<Period | ''>('reisotor-shopping-last-period', '');
const showNewDetails = usePersistedRef('reisotor-shopping-show-details', false);

const newFormBundle = computed<Record<string, unknown>>({
  get: () => ({
    newLabel: newLabel.value,
    newBuyer: newBuyer.value,
    newLink: newLink.value,
    newNote: newNote.value,
    newShop: newShop.value,
    newPeriod: newPeriod.value,
  }),
  set: (v) => {
    newLabel.value = (v.newLabel as string) ?? '';
    newBuyer.value = (v.newBuyer as string) ?? '';
    newLink.value = (v.newLink as string) ?? '';
    newNote.value = (v.newNote as string) ?? '';
    newShop.value = (v.newShop as string) ?? '';
    newPeriod.value = (v.newPeriod as Period | '') ?? '';
  },
});

const newDraft = useDraftAutosave('shopping:new', newFormBundle, ref(true));

watch(
  () => newDraft.restored.value,
  (restored) => {
    if (restored && (newLink.value || newNote.value)) {
      showNewDetails.value = true;
    }
  }
);

function handleSubmit() {
  if (!newLabel.value.trim()) return;
  emit('submit', {
    label: newLabel.value.trim(),
    assigned_to_user_id: newBuyer.value ? Number(newBuyer.value) : undefined,
    link: newLink.value || undefined,
    note: newNote.value || undefined,
    shop: newShop.value || undefined,
    period: newPeriod.value || undefined,
  });
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  newDraft.clear();
}

function discardDraft() {
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  showNewDetails.value = false;
  newDraft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
}
</script>

<template>
  <form class="add-form card" @submit.prevent="handleSubmit">
    <div class="quick-input-row">
      <div class="main-input-wrap">
        <FormField icon="title" label="Artikel" required v-slot="{ id }">
          <div class="input-inline-action-wrap">
            <Input :id="id" v-model="newLabel" type="text" placeholder="Neuer Artikel" required />
            <Button
              type="submit"
              class="inline-submit-btn"
              variant="primary"
              size="sm"
              :icon="ACTION_ICONS.send"
              :disabled="!newLabel.trim()"
              aria-label="Hinzufügen"
              title="Hinzufügen"
            />
          </div>
        </FormField>
      </div>

      <div class="quick-input-actions">
        <Button
          type="button"
          variant="ghost"
          class="details-toggle-btn"
          :aria-expanded="showNewDetails"
          @click="showNewDetails = !showNewDetails"
        >
          <AppIcon
            :icon="showNewDetails ? ACTION_ICONS.chevronUp : ACTION_ICONS.chevronDown"
            :size="14"
            group="actions"
          />
          <span>Details</span>
        </Button>
      </div>
    </div>

    <!-- Sanft ausklappbare Detail-Felder -->
    <Accordion :expanded="showNewDetails" :inert-when-closed="false">
      <div class="form-details-grid">
        <FormField icon="shop" label="Shop" v-slot="{ id }">
          <Combobox :id="id" v-model="newShop" :options="knownShops" placeholder="Shop/Laden" />
        </FormField>
        <FormField v-if="users.length > 1" icon="person" label="Einkäufer:in" v-slot="{ id }">
          <Select :id="id" v-model="newBuyer">
            <option value="">Kein:e Einkäufer:in</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
        <FormField icon="period" label="Zeitraum" v-slot="{ id }">
          <Select :id="id" v-model="newPeriod">
            <option value="">Kein Zeitraum</option>
            <option value="before">{{ PERIOD_META.before }}</option>
            <option value="during">{{ PERIOD_META.during }}</option>
          </Select>
        </FormField>
        <FormField icon="link" label="Link" v-slot="{ id }">
          <Input :id="id" v-model="newLink" type="url" placeholder="Link (z. B. Amazon)" />
        </FormField>
        <FormField icon="note" label="Notiz" v-slot="{ id }">
          <Input :id="id" v-model="newNote" type="text" placeholder="Notiz" />
        </FormField>
      </div>
    </Accordion>

    <DraftStatusBar
      :status="newDraft.status.value"
      :restored="newDraft.restored.value"
      :can-discard="true"
      @discard="discardDraft"
    />
  </form>
</template>

<style scoped>
.add-form {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
}

.quick-input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.main-input-wrap {
  flex: 1 1 240px;
  min-width: 160px;
}

.input-inline-action-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-inline-action-wrap :deep(.input) {
  width: 100%;
  padding-right: 44px;
}

.inline-submit-btn {
  position: absolute;
  right: 6px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  translate: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.quick-input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 2px;
}

@container app-main (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

.details-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
}

.details-toggle-btn:hover {
  color: var(--color-text);
}

.form-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}
</style>
