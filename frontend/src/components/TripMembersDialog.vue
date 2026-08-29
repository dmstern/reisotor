<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api, ApiError } from '../api/client';
import type { Trip, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import IconButton from './primitives/IconButton.vue';
import Button from './primitives/Button.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

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
      error.value = '';
      searching.value = false;
      hasSearched.value = false;
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
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    results.value = [];
    searching.value = false;
    hasSearched.value = false;
    return;
  }
  searching.value = true;
  searchTimeout = setTimeout(async () => {
    if (!props.trip) return;
    try {
      results.value = await api.get<User[]>(
        `/users/search?q=${encodeURIComponent(trimmed)}&trip_id=${props.trip.id}`
      );
    } catch {
      results.value = [];
    } finally {
      searching.value = false;
      hasSearched.value = true;
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
      <div class="section-title">Aktuelle Mitglieder</div>
      <ul class="member-list">
        <li v-for="u in members" :key="u.id">
          <span class="member-user">{{ u.avatar }} {{ u.username }}</span>
          <IconButton
            variant="danger"
            size="sm"
            :icon="ACTION_ICONS.delete"
            title="Mitglied entfernen"
            aria-label="Mitglied entfernen"
            @click="removeMember(u)"
          />
        </li>
        <li v-if="!members.length" class="empty">Noch keine Mitglieder.</li>
      </ul>

      <p v-if="memberCapReached" class="hint warning-hint">
        Eingeschränkter Modus – Maximal drei Nutzer:innen pro Urlaub
      </p>
      <div v-else class="invite-section">
        <FormField :icon="FORM_FIELD_ICONS.person" label="Nutzer:in einladen">
          <Input v-model="query" type="text" placeholder="Benutzername oder E-Mail-Adresse…" />
        </FormField>
        <p class="hint">
          Es können nur bereits registrierte Nutzer:innen gesucht werden (mindestens 2 Zeichen).
        </p>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="searching" class="search-status">
        <p class="hint">Suche läuft…</p>
      </div>

      <ul v-else-if="results.length" class="search-results">
        <li v-for="u in results" :key="u.id">
          <span class="member-user">{{ u.avatar }} {{ u.username }}</span>
          <Button variant="primary" size="sm" :disabled="loading" @click="invite(u)">
            <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Einladen
          </Button>
        </li>
      </ul>

      <p
        v-else-if="hasSearched && !searching && query.trim().length >= 2"
        class="hint empty-search"
      >
        Keine registrierten Nutzer:innen für „{{ query.trim() }}“ gefunden.
      </p>
    </div>
  </Modal>
</template>

<style scoped>
.members-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.member-list,
.search-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.member-list li,
.search-results li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint);
}

.member-user {
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.95rem;
}

.member-list .empty {
  background: none;
  padding: var(--space-1) 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  justify-content: flex-start;
}

.invite-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hint {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.85rem;
}

.warning-hint {
  color: var(--color-danger);
  font-weight: 500;
}

.empty-search {
  font-style: italic;
  padding: var(--space-1) 0;
}

.error {
  color: var(--color-danger);
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
}

.search-status {
  padding: var(--space-1) 0;
}
</style>
