<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { api, ApiError } from '../api/client';
import type { Trip, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import IconButton from './primitives/IconButton.vue';
import Button from './primitives/Button.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import AppIcon from './AppIcon.vue';
import PremiumBadge from './PremiumBadge.vue';
import { useAccountTierModal } from '../composables/useAccountTierModal';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

// Deckel aus Issue #96 (registrationConfig.ts's RESTRICTED_MAX_MEMBERS)
const RESTRICTED_MAX_MEMBERS = 3;

const props = defineProps<{
  tripId: number;
  trip?: Trip | null;
}>();

const tripStore = useTripStore();
const authStore = useAuthStore();
const trip = computed(() => tripStore.trips.find((t) => t.id === props.tripId) ?? props.trip);

const members = ref<User[]>([]);
const query = ref('');
const results = ref<User[]>([]);
const loading = ref(false);
const searching = ref(false);
const hasSearched = ref(false);
const initialLoading = ref(false);
const error = ref('');
let searchTimeout: ReturnType<typeof setTimeout> | undefined;

const memberCapReached = computed(
  () =>
    !!authStore.user?.restricted &&
    !!trip.value?.owner_restricted &&
    members.value.length >= RESTRICTED_MAX_MEMBERS
);

const { openAccountTierModal } = useAccountTierModal();

async function loadMembers() {
  if (!props.tripId) return;
  initialLoading.value = true;
  error.value = '';
  try {
    members.value = await api.get<User[]>(`/trips/${props.tripId}/members`);
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Mitglieder konnten nicht geladen werden';
  } finally {
    initialLoading.value = false;
  }
}

onMounted(() => {
  loadMembers();
});

watch(
  () => props.tripId,
  () => {
    query.value = '';
    results.value = [];
    error.value = '';
    searching.value = false;
    hasSearched.value = false;
    loadMembers();
  }
);

onUnmounted(() => {
  clearTimeout(searchTimeout);
});

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
  hasSearched.value = false;
  searchTimeout = setTimeout(async () => {
    if (!props.tripId) {
      searching.value = false;
      return;
    }
    try {
      results.value = await api.get<User[]>(
        `/users/search?q=${encodeURIComponent(trimmed)}&trip_id=${props.tripId}`
      );
      hasSearched.value = true;
    } catch {
      results.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
});

async function invite(user: User) {
  if (!props.tripId) return;
  if (memberCapReached.value) {
    openAccountTierModal('members');
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    await api.post(`/trips/${props.tripId}/members`, { user_id: user.id });
    members.value.push(user);
    results.value = results.value.filter((u) => u.id !== user.id);
    query.value = '';
    await tripStore.loadTrips();
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Einladen fehlgeschlagen';
  } finally {
    loading.value = false;
  }
}

async function removeMember(user: User) {
  if (!props.tripId) return;
  if (user.id === authStore.user?.id) {
    error.value = 'Du kannst dich nicht selbst aus dem Urlaub entfernen.';
    return;
  }
  const confirmed = window.confirm(`"${user.username}" wirklich aus diesem Urlaub entfernen?`);
  if (!confirmed) return;
  try {
    await api.delete(`/trips/${props.tripId}/members/${user.id}`);
    members.value = members.value.filter((u) => u.id !== user.id);
    await tripStore.loadTrips();
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Entfernen fehlgeschlagen';
  }
}
</script>

<template>
  <div class="trip-permissions-settings">
    <div class="section-title">Aktuelle Mitglieder</div>
    <div v-if="initialLoading" class="loading-state">
      <LoadingSpinner size="sm" />
      <span>Mitglieder laden…</span>
    </div>
    <TransitionGroup v-else tag="ul" name="list" class="member-list">
      <li v-for="u in members" :key="u.id">
        <span class="member-user">{{ u.avatar }} {{ u.username }}</span>
        <IconButton
          v-if="u.id !== authStore.user?.id"
          variant="danger"
          size="sm"
          :icon="ACTION_ICONS.delete"
          title="Mitglied entfernen"
          aria-label="Mitglied entfernen"
          @click="removeMember(u)"
        />
      </li>
      <li v-if="!members.length" key="empty-members" class="empty">Noch keine Mitglieder.</li>
    </TransitionGroup>

    <div class="invite-section" :class="{ 'is-capped': memberCapReached }">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div
        class="invite-header-wrap"
        :class="{ 'is-blocked': memberCapReached }"
        @click="memberCapReached && openAccountTierModal('members')"
      >
        <FormField :icon="FORM_FIELD_ICONS.person" label="Nutzer:in einladen">
          <Input
            v-model="query"
            type="search"
            inputmode="search"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            :placeholder="
              memberCapReached
                ? 'Limit erreicht (3 Personen im Basis-Konto)…'
                : 'Benutzername oder E-Mail-Adresse…'
            "
            :disabled="memberCapReached"
          />
        </FormField>
        <PremiumBadge v-if="memberCapReached" feature="members" class="member-cap-badge" />
      </div>

      <p v-if="memberCapReached" class="hint warning-hint">
        Eingeschränkter Modus – Maximal drei Nutzer:innen pro Urlaub
      </p>
      <p v-else class="hint">
        Es können nur bereits registrierte Nutzer:innen gesucht werden (mindestens 2 Zeichen).
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="searching" class="search-status"><LoadingSpinner size="sm" /> Suche läuft…</div>

    <TransitionGroup v-else-if="results.length" tag="ul" name="list" class="search-results">
      <li v-for="u in results" :key="u.id">
        <span class="member-user">{{ u.avatar }} {{ u.username }}</span>
        <Button variant="primary" size="sm" :disabled="loading" @click="invite(u)">
          <AppIcon :icon="ACTION_ICONS.userPlus" :size="14" group="actions" /> Einladen
        </Button>
      </li>
    </TransitionGroup>

    <p v-else-if="hasSearched && !searching && query.trim().length >= 2" class="hint empty-search">
      Keine registrierten Nutzer:innen für „{{ query.trim() }}“ gefunden.
    </p>
  </div>
</template>

<style scoped>
.trip-permissions-settings {
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

.loading-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.member-list,
.search-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
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
  transition: all 0.25s ease;
}

.member-user {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: var(--space-1);
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

.invite-header-wrap {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.invite-header-wrap.is-blocked {
  cursor: pointer;
}

.invite-header-wrap.is-blocked :deep(.form-field) {
  cursor: pointer;
}

.invite-header-wrap.is-blocked :deep(input) {
  cursor: pointer;
  pointer-events: none;
}

.invite-header-wrap :deep(.form-field) {
  flex: 1;
}

.member-cap-badge {
  margin-top: 26px;
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
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>
