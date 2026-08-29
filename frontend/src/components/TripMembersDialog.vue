<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api, ApiError } from '../api/client';
import type { Trip, User } from '../api/types';
import Modal from './Modal.vue';
import IconButton from './primitives/IconButton.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Deckel aus Issue #96 (registrationConfig.ts's RESTRICTED_MAX_MEMBERS) - hier dupliziert statt
// importiert, da das Frontend keinen Zugriff auf Backend-Module hat.
const RESTRICTED_MAX_MEMBERS = 3;

const props = defineProps<{ modelValue: boolean; trip: Trip | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const members = ref<User[]>([]);
const query = ref('');
const results = ref<User[]>([]);
const loading = ref(false);
const searching = ref(false);
const hasSearched = ref(false);
const error = ref('');
let searchTimeout: ReturnType<typeof setTimeout> | undefined;

const memberCapReached = computed(
  () => !!props.trip?.owner_restricted && members.value.length >= RESTRICTED_MAX_MEMBERS
);

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.trip) {
      loadMembers();
    } else {
      query.value = '';
      results.value = [];
      searching.value = false;
      hasSearched.value = false;
      error.value = '';
    }
  }
);

async function loadMembers() {
  if (!props.trip) return;
  members.value = await api.get<User[]>(`/trips/${props.trip.id}/members`);
}

// Debounced statt bei jedem Tastendruck sofort zu suchen (Backend verlangt ohnehin erst ab
// 2 Zeichen ein Ergebnis, siehe routes/users.ts's GET /users/search).
watch(query, (q) => {
  clearTimeout(searchTimeout);
  if (q.trim().length < 2) {
    results.value = [];
    searching.value = false;
    hasSearched.value = false;
    return;
  }
  searching.value = true;
  hasSearched.value = false;
  searchTimeout = setTimeout(async () => {
    if (!props.trip) {
      searching.value = false;
      return;
    }
    try {
      results.value = await api.get<User[]>(
        `/users/search?q=${encodeURIComponent(q.trim())}&trip_id=${props.trip.id}`
      );
      hasSearched.value = true;
    } finally {
      searching.value = false;
    }
  }, 300);
});

async function invite(user: User) {
  if (!props.trip) return;
  error.value = '';
  loading.value = true;
  try {
    await api.post(`/trips/${props.trip.id}/members`, { user_id: user.id });
    members.value.push(user);
    results.value = results.value.filter((u) => u.id !== user.id);
    query.value = '';
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Einladen fehlgeschlagen';
  } finally {
    loading.value = false;
  }
}

async function removeMember(user: User) {
  if (!props.trip) return;
  const confirmed = window.confirm(`"${user.username}" wirklich aus diesem Urlaub entfernen?`);
  if (!confirmed) return;
  await api.delete(`/trips/${props.trip.id}/members/${user.id}`);
  members.value = members.value.filter((u) => u.id !== user.id);
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="`Mitglieder – ${trip?.name ?? ''}`"
    @update:model-value="close"
  >
    <div class="members-dialog">
      <ul class="member-list">
        <li v-for="u in members" :key="u.id">
          <span class="member-user">{{ u.avatar }} {{ u.username }}</span>
          <IconButton
            variant="danger"
            size="sm"
            :icon="ACTION_ICONS.delete"
            title="Entfernen"
            aria-label="Entfernen"
            @click="removeMember(u)"
          />
        </li>
        <li v-if="!members.length" class="empty">Noch keine Mitglieder.</li>
      </ul>

      <p v-if="memberCapReached" class="hint">
        Eingeschränkter Modus - Maximal drei Nutzer pro Urlaub
      </p>
      <label v-else>
        Nutzer:in einladen (Benutzername oder E-Mail)
        <Input
          v-model="query"
          type="search"
          inputmode="search"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          placeholder="Mind. 2 Zeichen eingeben…"
        />
      </label>

      <div v-if="searching" class="search-status"><LoadingSpinner size="sm" /> Suche läuft…</div>
      <p v-else-if="hasSearched && !results.length && query.trim().length >= 2" class="hint">
        Keine passenden Nutzer:innen gefunden.
      </p>

      <p v-if="error" class="error">{{ error }}</p>

      <ul v-if="results.length" class="search-results">
        <li v-for="u in results" :key="u.id">
          <span class="member-user">{{ u.avatar }} {{ u.username }}</span>
          <Button variant="primary" size="sm" :disabled="loading" @click="invite(u)">
            <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Einladen
          </Button>
        </li>
      </ul>
    </div>
  </Modal>
</template>

<style scoped>
.members-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.member-list,
.search-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-list li,
.search-results li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 6px 8px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint);
}

.member-list .empty {
  background: none;
  padding: 6px 8px;
  font-size: 0.9rem;
  justify-content: flex-start;
}

label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
}

.hint {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.9rem;
}

.search-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
  margin: 0;
  font-size: 0.9rem;
}
</style>
