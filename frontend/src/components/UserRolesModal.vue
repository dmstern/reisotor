<script setup lang="ts">
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { UserRole } from '../composables/useUserManagement';

defineProps<{
  modelValue: boolean;
  initialRole?: UserRole | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

interface RolePermissionRow {
  title: string;
  description: string;
  restricted: { allowed: boolean; text: string };
  plus: { allowed: boolean; text: string };
  admin: { allowed: boolean; text: string };
}

const permissions: RolePermissionRow[] = [
  {
    title: 'Eigene Urlaube anlegen',
    description: 'Erstellen und Verwalten von eigenen Urlaubsreisen',
    restricted: { allowed: true, text: 'Max. 1 eigener Urlaub' },
    plus: { allowed: true, text: 'Unbegrenzt' },
    admin: { allowed: true, text: 'Unbegrenzt' },
  },
  {
    title: 'Mitglieder pro Urlaub',
    description:
      'Max. 3 Personen in reinen Basis-Gruppen. Sobald ein Mitglied Vollzugriff hat, unbegrenzt (Sponsor-Prinzip)',
    restricted: { allowed: true, text: 'Max. 3 (ungesponsert)' },
    plus: { allowed: true, text: 'Unbegrenzt (Sponsor)' },
    admin: { allowed: true, text: 'Unbegrenzt (Sponsor)' },
  },
  {
    title: 'Datei- & Foto-Uploads',
    description: 'Anhänge wie Tickets, PDFs, Buchungen & Tagebuch-Fotos',
    restricted: { allowed: false, text: 'Deaktiviert' },
    plus: { allowed: true, text: 'Vollzugriff' },
    admin: { allowed: true, text: 'Vollzugriff' },
  },
  {
    title: 'Urlaubsplanung & Beitreten',
    description: 'Einladungen annehmen, Spots, Touren, Termine, Notizen, Packliste & Ausgaben',
    restricted: { allowed: true, text: 'Unbegrenzt' },
    plus: { allowed: true, text: 'Unbegrenzt' },
    admin: { allowed: true, text: 'Unbegrenzt' },
  },
  {
    title: 'Benutzerverwaltung',
    description: 'Nutzerkonten anlegen, Passwörter zurücksetzen, Rollen vergeben & Konten löschen',
    restricted: { allowed: false, text: 'Kein Zugriff' },
    plus: { allowed: false, text: 'Kein Zugriff' },
    admin: { allowed: true, text: 'Vollzugriff' },
  },
  {
    title: 'Instanz- & Serververwaltung',
    description: 'Instanzeinstellungen, Registrierungsmodus, Datensicherung & Backups',
    restricted: { allowed: false, text: 'Kein Zugriff' },
    plus: { allowed: false, text: 'Kein Zugriff' },
    admin: { allowed: true, text: 'Vollzugriff' },
  },
];

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Rollen & Berechtigungen"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="roles-modal-body">
      <p class="roles-intro">
        Übersicht über alle Benutzerrollen und Berechtigungen in Reisotor. Administrator:innen
        können die Rolle jedes Nutzers in der Benutzerverwaltung über das Dropdown-Menü anpassen.
      </p>

      <!-- Desktop & Tablet: Vergleichstabelle -->
      <div class="roles-table-wrapper">
        <table class="roles-table">
          <thead>
            <tr>
              <th class="feature-col">Berechtigung / Funktion</th>
              <th :class="['role-col', { 'is-highlighted': initialRole === 'restricted' }]">
                <div class="role-header">
                  <Badge variant="warning">Basis-Konto</Badge>
                  <span class="role-desc">Standard bei Selbstregistrierung</span>
                </div>
              </th>
              <th :class="['role-col', { 'is-highlighted': initialRole === 'plus' }]">
                <div class="role-header">
                  <Badge variant="success">Plus</Badge>
                  <span class="role-desc">Vollzugriff auf alle Reise-Features</span>
                </div>
              </th>
              <th :class="['role-col', { 'is-highlighted': initialRole === 'admin' }]">
                <div class="role-header">
                  <Badge variant="accent-secondary">Admin</Badge>
                  <span class="role-desc">Instanz- & Nutzerverwaltung</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in permissions" :key="item.title">
              <td class="feature-col">
                <strong class="feature-title">{{ item.title }}</strong>
                <span class="feature-desc">{{ item.description }}</span>
              </td>
              <td :class="['role-col', { 'is-highlighted': initialRole === 'restricted' }]">
                <div class="cell-content">
                  <span class="icon-wrap" :class="item.restricted.allowed ? 'allowed' : 'denied'">
                    <AppIcon
                      :icon="item.restricted.allowed ? ACTION_ICONS.done : ACTION_ICONS.private"
                      :size="14"
                      group="actions"
                    />
                  </span>
                  <span>{{ item.restricted.text }}</span>
                </div>
              </td>
              <td :class="['role-col', { 'is-highlighted': initialRole === 'plus' }]">
                <div class="cell-content">
                  <span class="icon-wrap" :class="item.plus.allowed ? 'allowed' : 'denied'">
                    <AppIcon
                      :icon="item.plus.allowed ? ACTION_ICONS.done : ACTION_ICONS.private"
                      :size="14"
                      group="actions"
                    />
                  </span>
                  <span>{{ item.plus.text }}</span>
                </div>
              </td>
              <td :class="['role-col', { 'is-highlighted': initialRole === 'admin' }]">
                <div class="cell-content">
                  <span class="icon-wrap" :class="item.admin.allowed ? 'allowed' : 'denied'">
                    <AppIcon
                      :icon="item.admin.allowed ? ACTION_ICONS.done : ACTION_ICONS.private"
                      :size="14"
                      group="actions"
                    />
                  </span>
                  <span>{{ item.admin.text }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: Responsive Karten-Ansicht -->
      <div class="roles-cards-wrapper">
        <div class="role-card" :class="{ 'is-highlighted': initialRole === 'restricted' }">
          <div class="role-card-header">
            <Badge variant="warning">Basis-Konto</Badge>
            <span class="role-desc">Standard bei Selbstregistrierung</span>
          </div>
          <ul class="role-card-list">
            <li v-for="item in permissions" :key="item.title" class="role-card-item">
              <span class="icon-wrap" :class="item.restricted.allowed ? 'allowed' : 'denied'">
                <AppIcon
                  :icon="item.restricted.allowed ? ACTION_ICONS.done : ACTION_ICONS.private"
                  :size="14"
                  group="actions"
                />
              </span>
              <div class="role-card-item-text">
                <strong>{{ item.title }}:</strong> {{ item.restricted.text }}
              </div>
            </li>
          </ul>
        </div>

        <div class="role-card" :class="{ 'is-highlighted': initialRole === 'plus' }">
          <div class="role-card-header">
            <Badge variant="success">Plus</Badge>
            <span class="role-desc">Vollzugriff auf alle Reise-Features</span>
          </div>
          <ul class="role-card-list">
            <li v-for="item in permissions" :key="item.title" class="role-card-item">
              <span class="icon-wrap" :class="item.plus.allowed ? 'allowed' : 'denied'">
                <AppIcon
                  :icon="item.plus.allowed ? ACTION_ICONS.done : ACTION_ICONS.private"
                  :size="14"
                  group="actions"
                />
              </span>
              <div class="role-card-item-text">
                <strong>{{ item.title }}:</strong> {{ item.plus.text }}
              </div>
            </li>
          </ul>
        </div>

        <div class="role-card" :class="{ 'is-highlighted': initialRole === 'admin' }">
          <div class="role-card-header">
            <Badge variant="accent-secondary">Admin</Badge>
            <span class="role-desc">Instanz- & Nutzerverwaltung</span>
          </div>
          <ul class="role-card-list">
            <li v-for="item in permissions" :key="item.title" class="role-card-item">
              <span class="icon-wrap" :class="item.admin.allowed ? 'allowed' : 'denied'">
                <AppIcon
                  :icon="item.admin.allowed ? ACTION_ICONS.done : ACTION_ICONS.private"
                  :size="14"
                  group="actions"
                />
              </span>
              <div class="role-card-item-text">
                <strong>{{ item.title }}:</strong> {{ item.admin.text }}
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="modal-actions actions-row">
        <Button variant="secondary" @click="close">Schließen</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.roles-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.roles-intro {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.roles-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
}

.roles-table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.roles-table th {
  padding: var(--space-3);
  text-align: left;
  border-bottom: 2px solid var(--color-border);
  background: var(--color-hover);
  vertical-align: top;
}

.roles-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.roles-table tr:last-child td {
  border-bottom: none;
}

.feature-col {
  width: 34%;
}

.role-col {
  width: 22%;
}

.role-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-start;
}

.role-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: normal;
  line-height: 1.3;
}

.feature-title {
  display: block;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 2px;
}

.feature-desc {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.3;
}

.cell-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  line-height: 1.4;
}

.icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  margin-top: 1px;
}

.icon-wrap.allowed {
  background: var(--color-success-tint);
  color: var(--color-success);
}

.icon-wrap.denied {
  background: var(--color-hover);
  color: var(--color-text-muted);
}

.role-col.is-highlighted {
  background: var(--color-primary-tint);
}

/* Mobile cards */
.roles-cards-wrapper {
  display: none;
  flex-direction: column;
  gap: var(--space-3);
}

.role-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.role-card.is-highlighted {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  background: var(--color-primary-tint);
}

.role-card-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.role-card-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.role-card-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.role-card-item-text {
  flex: 1;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}

@media (max-width: 640px) {
  .roles-table-wrapper {
    display: none;
  }
  .roles-cards-wrapper {
    display: flex;
  }
}
</style>
