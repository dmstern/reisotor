<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import Badge from '../primitives/Badge.vue';
import AppIcon from '../AppIcon.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import ViewLoadingState from '../ViewLoadingState.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { formatDateTime } from '../../utils/dateFormat';
import { api, ApiError } from '../../api/client';
import type { AdminMessage } from '../../api/types';
import type { IconDef } from '../../utils/icon';
import { IconMail } from '@tabler/icons-vue';
import { useAdminMessagesStore } from '../../stores/adminMessages';

const props = defineProps<{
  contactAdminEnabled?: boolean;
}>();

const MESSAGES_ICON: IconDef = { id: 'mail', emoji: '✉️', outline: IconMail };
const adminMessagesStore = useAdminMessagesStore();

const messages = ref<AdminMessage[]>([]);
const unreadCount = ref(0);
const loading = ref(true);
const error = ref('');
const actionError = ref('');
const verifyingUserId = ref<number | null>(null);
const updatingId = ref<number | null>(null);

const filter = ref<'all' | 'unread'>('all');

const filteredMessages = computed(() => {
  if (filter.value === 'unread') {
    return messages.value.filter((m) => m.status === 'unread');
  }
  return messages.value;
});

async function loadMessages() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get<{ messages: AdminMessage[]; unreadCount: number }>('/admin/messages');
    messages.value = res.messages;
    unreadCount.value = res.unreadCount;
    adminMessagesStore.setUnreadCount(res.unreadCount);
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Fehler beim Laden der Admin-Nachrichten';
  } finally {
    loading.value = false;
  }
}

async function updateStatus(msg: AdminMessage, newStatus: 'unread' | 'read' | 'resolved') {
  updatingId.value = msg.id;
  actionError.value = '';
  try {
    await api.put(`/admin/messages/${msg.id}/status`, { status: newStatus });
    msg.status = newStatus;
    unreadCount.value = messages.value.filter((m) => m.status === 'unread').length;
    adminMessagesStore.setUnreadCount(unreadCount.value);
  } catch (err) {
    actionError.value =
      err instanceof ApiError ? err.message : 'Fehler beim Aktualisieren des Status';
  } finally {
    updatingId.value = null;
  }
}

async function deleteMessage(msg: AdminMessage) {
  if (!confirm('Möchtest du diese Nachricht wirklich löschen?')) return;
  updatingId.value = msg.id;
  actionError.value = '';
  try {
    await api.delete(`/admin/messages/${msg.id}`);
    messages.value = messages.value.filter((m) => m.id !== msg.id);
    unreadCount.value = messages.value.filter((m) => m.status === 'unread').length;
    adminMessagesStore.setUnreadCount(unreadCount.value);
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Fehler beim Löschen der Nachricht';
  } finally {
    updatingId.value = null;
  }
}

async function verifyMatchedUser(msg: AdminMessage) {
  if (!msg.matchedUser) return;
  verifyingUserId.value = msg.matchedUser.id;
  actionError.value = '';
  try {
    await api.post(`/users/${msg.matchedUser.id}/verify-email`);
    msg.matchedUser.is_email_verified = true;
    await updateStatus(msg, 'resolved');
  } catch (err) {
    actionError.value =
      err instanceof ApiError ? err.message : 'Fehler beim Freischalten des Accounts';
  } finally {
    verifyingUserId.value = null;
  }
}

onMounted(() => {
  loadMessages();
});
</script>

<template>
  <Card id="admin-messages" class="admin-card admin-messages-card">
    <div class="card-header-wrap">
      <SettingsCardHeader title="Kontaktanfragen & Anmeldeprobleme" :icon="MESSAGES_ICON" />
      <div class="header-badges">
        <Badge v-if="props.contactAdminEnabled === false" variant="danger" size="sm">
          Deaktiviert
        </Badge>
        <Badge v-if="unreadCount > 0" variant="warning" size="sm">
          {{ unreadCount }} ungelesen
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.refresh"
          title="Aktualisieren"
          @click="loadMessages"
        />
      </div>
    </div>

    <p class="hint">
      Nachrichten und Hilfegesuche von Personen, die sich auf dieser Instanz registrieren oder
      anmelden möchten.
    </p>

    <div v-if="error || actionError" class="error-banner">
      {{ error || actionError }}
    </div>

    <ViewLoadingState v-if="loading" message="Lade Nachrichten…" />

    <template v-else>
      <div v-if="messages.length > 0" class="filter-bar">
        <div class="filter-buttons">
          <Button
            size="sm"
            :variant="filter === 'all' ? 'primary' : 'ghost'"
            @click="filter = 'all'"
          >
            Alle ({{ messages.length }})
          </Button>
          <Button
            size="sm"
            :variant="filter === 'unread' ? 'primary' : 'ghost'"
            @click="filter = 'unread'"
          >
            Ungelesen ({{ unreadCount }})
          </Button>
        </div>
      </div>

      <div v-if="filteredMessages.length === 0" class="empty-state">
        <p class="hint">Keine Nachrichten vorhanden.</p>
      </div>

      <div v-else class="messages-list">
        <div
          v-for="msg in filteredMessages"
          :key="msg.id"
          class="message-item"
          :class="{ unread: msg.status === 'unread', resolved: msg.status === 'resolved' }"
        >
          <div class="message-header">
            <div class="message-meta">
              <span class="sender-name">
                {{ msg.name || msg.username || 'Unbekannt' }}
              </span>
              <span v-if="msg.username && msg.name" class="sender-username">
                (@{{ msg.username }})
              </span>
              <span v-if="msg.email" class="sender-email"> &lt;{{ msg.email }}&gt; </span>
              <span class="message-date">{{ formatDateTime(msg.created_at) }}</span>
            </div>
            <div class="status-badges">
              <Badge :variant="msg.status === 'unread' ? 'warning' : 'default'" size="sm">
                {{
                  msg.status === 'unread'
                    ? 'Neu'
                    : msg.status === 'resolved'
                      ? 'Erledigt'
                      : 'Gelesen'
                }}
              </Badge>
            </div>
          </div>

          <p class="message-body">{{ msg.message }}</p>

          <div v-if="msg.matchedUser" class="matched-user-box">
            <div class="matched-user-info">
              <span
                >Gefundenes Konto: <strong>{{ msg.matchedUser.username }}</strong></span
              >
              <Badge :variant="msg.matchedUser.is_email_verified ? 'success' : 'danger'" size="sm">
                {{ msg.matchedUser.is_email_verified ? 'E-Mail bestätigt' : 'E-Mail unbestätigt' }}
              </Badge>
            </div>
            <Button
              v-if="!msg.matchedUser.is_email_verified"
              size="sm"
              variant="secondary"
              :loading="verifyingUserId === msg.matchedUser.id"
              @click="verifyMatchedUser(msg)"
            >
              <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
              Account freischalten
            </Button>
          </div>
          <div v-else-if="msg.username || msg.email" class="unmatched-user-box">
            <span class="unmatched-hint">
              Kein zugehöriges Konto in der Datenbank (bei fehlgeschlagener Registrierung verworfen
              oder noch nicht angelegt).
            </span>
          </div>

          <div class="message-actions">
            <Button
              v-if="msg.status === 'unread'"
              size="sm"
              variant="ghost"
              :disabled="updatingId === msg.id"
              @click="updateStatus(msg, 'resolved')"
            >
              Als erledigt markieren
            </Button>
            <Button
              v-else
              size="sm"
              variant="ghost"
              :disabled="updatingId === msg.id"
              @click="updateStatus(msg, 'unread')"
            >
              Als neu markieren
            </Button>
            <Button
              size="sm"
              variant="danger"
              :disabled="updatingId === msg.id"
              @click="deleteMessage(msg)"
            >
              <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" />
              Löschen
            </Button>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.admin-messages-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card-header-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-bar {
  display: flex;
  justify-content: flex-start;
  margin-bottom: var(--space-2);
}

.filter-buttons {
  display: flex;
  gap: var(--space-1);
}

.empty-state {
  padding: var(--space-4) 0;
  text-align: center;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.message-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle, 8px);
  background: var(--color-surface);
  transition: border-color var(--transition-fast, 0.15s ease);
}

.message-item.unread {
  border-left: 3px solid var(--color-warning, #f59e0b);
  background: var(--color-surface-hover, rgba(245, 158, 11, 0.03));
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: var(--font-size-sm, 0.85rem);
}

.sender-name {
  font-weight: 600;
  color: var(--color-text);
}

.sender-username,
.sender-email {
  color: var(--color-text-muted);
}

.message-date {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, 0.75rem);
}

.message-body {
  margin: 0;
  white-space: pre-wrap;
  font-size: var(--font-size-sm, 0.9rem);
  color: var(--color-text);
  line-height: 1.5;
}

.matched-user-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle, 6px);
  font-size: var(--font-size-xs, 0.8rem);
  flex-wrap: wrap;
}

.matched-user-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.unmatched-user-box {
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm-squircle, 6px);
  font-size: var(--font-size-xs, 0.8rem);
}

.unmatched-hint {
  color: var(--color-text-muted);
}

.message-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.error-banner {
  padding: var(--space-2) var(--space-3);
  background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
  border-radius: var(--radius-sm-squircle, 6px);
  font-size: var(--font-size-sm, 0.85rem);
}
</style>
