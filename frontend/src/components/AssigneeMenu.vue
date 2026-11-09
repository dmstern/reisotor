<script setup lang="ts">
import { computed, ref } from 'vue';
import type { User } from '../api/types';
import { ACTION_ICONS } from '../utils/actionIcons';
import Button from './primitives/Button.vue';
import DropdownMenu from './primitives/DropdownMenu.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';

// AssigneeMenu: Runder Avatar-Button (initial ghost, beim Hover 3D) mit Aktions-Menü zum Neuzuweisen
// eines Listeneintrags (Einkaufsliste: Käufer:in, ToDo-Liste: Zuständige:r). Die Auswahl löst direkt
// die Neuzuweisung aus (Aktion, kein Formularfeld) – daher DropdownMenu statt Select.vue.

const UNASSIGNED_AVATAR = '👤';
const FORMER_MEMBER_LABEL = 'Ehemaliges Mitglied';

const props = defineProps<{
  users: User[];
  assignedUserId: number | null;
  /** Rolle der zugewiesenen Person für Tooltip und ARIA, z. B. "Käufer:in" */
  roleLabel: string;
}>();

const emit = defineEmits<{
  (e: 'select', userId: number | null): void;
}>();

const isOpen = ref(false);

const assignedUser = computed(
  () => props.users.find((candidate) => candidate.id === props.assignedUserId) ?? null
);
const isFormerMember = computed(() => props.assignedUserId != null && !assignedUser.value);
const avatar = computed(() => assignedUser.value?.avatar ?? UNASSIGNED_AVATAR);
const assignedName = computed(() => {
  if (isFormerMember.value) {
    return FORMER_MEMBER_LABEL;
  }

  return assignedUser.value?.username ?? 'Nicht zugewiesen';
});
const title = computed(() => `${props.roleLabel}: ${assignedName.value}`);

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function select(userId: number | null) {
  close();

  if (userId !== props.assignedUserId) {
    emit('select', userId);
  }
}
</script>

<template>
  <DropdownMenu :open="isOpen" align="right" aria-haspopup="menu" @toggle="toggle">
    <template #trigger="{ toggle: toggleMenu }">
      <Button
        variant="ghost"
        shape="circle"
        size="sm"
        :title="title"
        :aria-label="title"
        :aria-expanded="isOpen"
        aria-haspopup="menu"
        :active="isOpen"
        class="assignee-menu-trigger"
        @click.stop="toggleMenu"
      >
        <span class="assignee-avatar" aria-hidden="true">{{ avatar }}</span>
      </Button>
    </template>

    <PickerMenu position="absolute" origin="top-right" :aria-label="roleLabel" @close="close">
      <DropdownMenuItem
        label="Nicht zugewiesen"
        :active="assignedUserId == null"
        :trailing-icon="assignedUserId == null ? ACTION_ICONS.done : undefined"
        @click="select(null)"
      />
      <DropdownMenuItem v-if="isFormerMember" :label="FORMER_MEMBER_LABEL" active disabled />
      <DropdownMenuItem
        v-for="user in users"
        :key="user.id"
        :label="`${user.avatar} ${user.username}`"
        :active="user.id === assignedUserId"
        :trailing-icon="user.id === assignedUserId ? ACTION_ICONS.done : undefined"
        @click="select(user.id)"
      />
    </PickerMenu>
  </DropdownMenu>
</template>

<style scoped>
.assignee-avatar {
  font-size: var(--font-size-sm);
  line-height: 1;
}
</style>
