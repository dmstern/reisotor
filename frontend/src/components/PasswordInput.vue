<script setup lang="ts">
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
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
    <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
    <Input
      v-model="model"
      :type="visible ? 'text' : 'password'"
      class="password-input"
      v-bind="$attrs"
    />
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      class="toggle-visibility"
      :aria-label="visible ? 'Eingabe verbergen' : 'Eingabe anzeigen'"
      :title="visible ? 'Eingabe verbergen' : 'Eingabe anzeigen'"
      :icon="visible ? ACTION_ICONS.hidePassword : ACTION_ICONS.showPassword"
      @click="visible = !visible"
    />
  </div>
</template>

<style scoped>
.password-field {
  position: relative;
  display: flex;
}

.password-input {
  flex: 1;
  width: 100%;
  padding-right: 40px;
}

.toggle-visibility {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  color: var(--color-text-muted);
}

.toggle-visibility:hover {
  color: var(--color-text);
}
</style>
