<script setup lang="ts">
import { computed } from 'vue';
import { useSpotsStore } from '../stores/spots';
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
const placeNames = computed(() => spotsStore.spots.map((spot) => spot.title));
</script>

<template>
  <CollapsibleFieldset
    v-model="expanded"
    label="Ortsangaben"
    :icon="FORM_FIELD_ICONS.location"
    icon-group="formFields"
  >
    <FormField icon="location" label="Ort aus Spots (optional)" v-slot="{ id }">
      <Select :id="id" v-model="linkKey">
        <option value="">Keinen Spot als Ort wählen</option>
        <option v-for="s in spotsStore.spots" :key="`spot:${s.id}`" :value="`spot:${s.id}`">
          {{ s.title }}
        </option>
      </Select>
    </FormField>
    <FormField v-if="!linkKey" icon="location" label="Ort (Freitext)" v-slot="{ id }">
      <Combobox :id="id" v-model="location" :options="placeNames" placeholder="Ort" />
    </FormField>
    <FormField v-if="!linkKey" icon="maps" label="Maps-Link" v-slot="{ id }">
      <Input :id="id" v-model="mapsLink" type="url" placeholder="Maps-Link (Google/Apple)" />
    </FormField>
  </CollapsibleFieldset>
</template>
