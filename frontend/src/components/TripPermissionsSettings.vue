<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { api, ApiError } from '../api/client';
import type { Trip, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import CornerRemoveButton from './primitives/CornerRemoveButton.vue';
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
const trip = computed(
  () => tripStore.trips.find((candidate) => candidate.id === props.tripId) ?? props.trip
);

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
  if (!props.tripId) {
    return;
  }

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
watch(query, (searchVal) => {
  clearTimeout(searchTimeout);
  const trimmed = searchVal.trim();

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
  if (!props.tripId) {
    return;
  }

  if (memberCapReached.value) {
    openAccountTierModal('members');
    return;
  }

  error.value = '';
  loading.value = true;

  try {
    await api.post(`/trips/${props.tripId}/members`, { user_id: user.id });
    members.value.push(user);
    results.value = results.value.filter((candidate) => candidate.id !== user.id);
    query.value = '';
    await tripStore.loadTrips();
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Einladen fehlgeschlagen';
  } finally {
    loading.value = false;
  }
}

async function removeMember(user: User) {
  if (!props.tripId) {
    return;
  }

  if (user.id === authStore.user?.id) {
    error.value = 'Du kannst dich nicht selbst aus dem Urlaub entfernen.';
    return;
  }

  const confirmed = window.confirm(`"${user.username}" wirklich aus diesem Urlaub entfernen?`);

  if (!confirmed) {
    return;
  }

  try {
    await api.delete(`/trips/${props.tripId}/members/${user.id}`);
    members.value = members.value.filter((candidate) => candidate.id !== user.id);
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
      <li v-for="member in members" :key="member.id" class="member-avatar-item">
        <div class="member-avatar-wrap">
          <div class="member-avatar-circle" :title="member.username">
            <span class="member-avatar-emoji" aria-hidden="true">{{ member.avatar }}</span>
          </div>
          <CornerRemoveButton
            v-if="member.id !== authStore.user?.id"
            class="member-remove-btn"
            title="Mitglied entfernen"
            :aria-label="`${member.username} entfernen`"
            @click="removeMember(member)"
          />
        </div>
        <span class="member-avatar-name" :title="member.username">{{ member.username }}</span>
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

    <div v-if="searching" class="search-status" role="status" aria-live="polite">
      <LoadingSpinner size="sm" decorative /> Suche läuft…
    </div>

    <TransitionGroup v-else-if="results.length" tag="ul" name="list" class="search-results">
      <li v-for="user in results" :key="user.id">
        <div class="search-result-user">
          <div class="search-avatar-circle" aria-hidden="true">
            <span>{{ user.avatar }}</span>
          </div>
          <span class="member-user" :title="user.username">{{ user.username }}</span>
        </div>
        <Button variant="primary" size="sm" :disabled="loading" @click="invite(user)">
          <AppIcon :icon="ACTION_ICONS.userPlus" :size="14" group="actions" /> Einladen
        </Button>
      </li>
    </TransitionGroup>

    <p v-else-if="hasSearched && !searching && query.trim().length >= 2" class="hint empty-search">
      Keine registrierten Nutzer:innen für „{{ query.trim() }}“ gefunden.
    </p>
  </div>
</template>

<style scoped lang="scss">
.trip-permissions-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.member-list {
  list-style: none;
  margin: 0;
  padding: var(--space-2) var(--space-1) var(--space-1) calc(var(--space-1) + 10px);
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  row-gap: var(--space-3);
  position: relative;
}

.member-avatar-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  width: 72px;
  margin-left: -10px;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);

  &:focus-within {
    z-index: 15;
  }
}

@include can-hover {
  .member-avatar-item:hover {
    z-index: 15;
  }

  .member-avatar-item:hover .member-avatar-circle {
    transform: translateY(-3px) scale(1.04);
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-card-hover);
  }
}

.member-avatar-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-avatar-circle,
.search-avatar-circle {
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: var(--line-height-none);
  user-select: none;
  background-color: var(--color-surface);
  background-image: var(--gradient-surface-3d);
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-card-interactive);
}

.member-avatar-circle {
  width: 72px;
  height: 72px;
  font-size: var(--font-size-2xl);
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.member-remove-btn {
  --corner-remove-top: -1px;
  --corner-remove-right: -1px;
}

.member-avatar-name {
  max-width: 58px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-list .empty {
  background: none;
  padding: var(--space-1) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  justify-content: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .member-avatar-item,
  .member-avatar-circle {
    transition: none !important;
  }

  .member-avatar-item:hover .member-avatar-circle {
    transform: none !important;
  }
}

.search-results {
  @include uniform-height-list(0);
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

.search-results li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-1);
  @include divider-engraved-row;
}

.search-result-user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.search-avatar-circle {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  font-size: var(--font-size-xl);
}

.member-user {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.invite-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.hint {
  color: var(--color-text-muted);
  margin: 0;
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.search-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
