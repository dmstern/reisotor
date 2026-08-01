<script setup lang="ts">
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });
const model = defineModel<string>({ required: true });
const visible = ref(false);
</script>

<template>
  <div class="password-field">
    <input v-model="model" :type="visible ? 'text' : 'password'" v-bind="$attrs" />
    <button
      type="button"
      class="toggle-visibility"
      :aria-label="visible ? 'Eingabe verbergen' : 'Eingabe anzeigen'"
      :title="visible ? 'Eingabe verbergen' : 'Eingabe anzeigen'"
      @click="visible = !visible"
    >
      {{ visible ? '🙈' : '👁️' }}
    </button>
  </div>
</template>

<style scoped>
.password-field {
  position: relative;
  display: flex;
}

.password-field input {
  flex: 1;
  padding-right: 40px;
}

.toggle-visibility {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 36px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
}

.toggle-visibility:hover {
  background: transparent;
  color: var(--color-text);
}
</style>
