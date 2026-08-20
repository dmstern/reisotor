<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineOptions({ inheritAttrs: false });
const model = defineModel<string>({ required: true });
// Optionales zweites v-model (v-model:visible) – z. B. für LoginView.vue, das den Reisotor die
// Augen zuhalten lässt, solange das Passwort im Klartext angezeigt wird. Ungenutzt bleibt es ein
// rein internes Detail wie zuvor (Default false, kein Verhaltensunterschied für bestehende
// Verwendungsstellen ohne diese Bindung).
const visible = defineModel<boolean>('visible', { default: false });
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
      <AppIcon :icon="visible ? ACTION_ICONS.hidePassword : ACTION_ICONS.showPassword" :size="16" group="actions" />
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
  box-shadow: none;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
}

.toggle-visibility:hover {
  background: transparent;
  box-shadow: none;
  color: var(--color-text);
}
</style>
