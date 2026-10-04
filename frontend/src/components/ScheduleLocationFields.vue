<script setup lang="ts">
import { computed } from 'vue';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import FormField from './FormField.vue';
import Select from './primitives/Select.vue';
import Combobox from './Combobox.vue';
import Input from './primitives/Input.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const linkKey = defineModel<string>('linkKey', { default: '' });
const location = defineModel<string>('location', { default: '' });
const mapsLink = defineModel<string>('mapsLink', { default: '' });
const expanded = defineModel<boolean>('expanded', { default: false });

const spotsStore = useSpotsStore();
const excursionsStore = useExcursionsStore();
const placeNames = computed(() => spotsStore.spots.map((s) => s.title));
</script>

<template>
  <CollapsibleFieldset
    v-model="expanded"
    label="Ortsangaben"
    :icon="FORM_FIELD_ICONS.location"
    icon-group="formFields"
  >
    <div class="row">
      <FormField icon="maps" label="Karte" v-slot="{ id }">
        <Select :id="id" v-model="linkKey">
          <option value="">Kein Spot/keine Tour verknüpft</option>
          <optgroup label="Spots" v-if="spotsStore.spots.length">
            <option v-for="s in spotsStore.spots" :key="`spot:${s.id}`" :value="`spot:${s.id}`">
              {{ s.title }}
            </option>
          </optgroup>
          <optgroup label="Touren" v-if="excursionsStore.excursions.length">
            <option
              v-for="e in excursionsStore.excursions"
              :key="`idea:${e.id}`"
              :value="`idea:${e.id}`"
            >
              {{ e.title }}
            </option>
          </optgroup>
        </Select>
      </FormField>
      <FormField v-if="!linkKey" icon="location" label="Ort (Freitext)" v-slot="{ id }">
        <Combobox :id="id" v-model="location" :options="placeNames" placeholder="Ort" />
      </FormField>
    </div>
    <FormField v-if="!linkKey" icon="maps" label="Maps-Link" v-slot="{ id }">
      <Input :id="id" v-model="mapsLink" type="url" placeholder="Maps-Link (Google/Apple)" />
    </FormField>
  </CollapsibleFieldset>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.row > * {
  flex: 1;
  min-width: 140px;
}
</style>
