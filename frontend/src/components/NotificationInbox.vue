<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IconBell, IconBellFilled } from '@tabler/icons-vue';
import { useNotificationsStore } from '../stores/notifications';
import { useDrawersStore } from '../stores/drawers';
import { usePwaUpdateStore } from '../stores/pwaUpdate';
import { usePwaInstallStore } from '../stores/pwaInstall';
import IconButton from './primitives/IconButton.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import UnseenDot from './primitives/UnseenDot.vue';
import PwaInstallDialog from './PwaInstallDialog.vue';
import type { NotificationItem } from '../api/types';
import { notificationTarget } from '../utils/notificationTarget';
import { formatDateTime } from '../utils/dateFormat';
import { ACTION_ICONS } from '../utils/actionIcons';

// Notification-Inbox (#97): GitHub-artiges Glocken-Icon im Header mit Dropdown der ungelesenen (und
// zuletzt gelesenen) Aktivitäten anderer Mitglieder sowie systemweiten Benachrichtigungen (PWA-Update,
// Offline-Bereitschaft, App-Installation) - Datenhaltung/Realtime-Anbindung siehe stores/notifications.ts
// und stores/pwaUpdate.ts. Gleiches Dropdown-Muster wie TripSwitcher.vue.
const notifications = useNotificationsStore();
const drawers = useDrawersStore();
const pwaUpdate = usePwaUpdateStore();
const pwaInstall = usePwaInstallStore();
const router = useRouter();
const open = ref(false);
const showInstallDialog = ref(false);

const BELL_ICON = { id: 'bell', emoji: '🔔', outline: IconBell, filled: IconBellFilled };

const hasSystemNotices = computed(() => {
  return (
    pwaUpdate.needRefresh ||
    pwaUpdate.offlineReady ||
    (!pwaInstall.isStandalone && !pwaInstall.dismissed)
  );
});

// Ungelesene Aktivitäten zeigen einen Zähler-Badge. Liegen stattdessen System-Benachrichtigungen
// (Update verfügbar, Offline-Bereitschaft, App-Installation) vor, lenkt der rote Punkt (UnseenDot)
// Nutzer:innen zur Glocke.
const bellAriaLabel = computed(() => {
  if (notifications.unreadCount > 0) {
    return `Benachrichtigungen (${notifications.unreadCount} ungelesen)`;
  }
  if (hasSystemNotices.value) {
    return 'Benachrichtigungen (Neuigkeiten verfügbar)';
  }
  return 'Benachrichtigungen';
});

function openInstallDialog() {
  showInstallDialog.value = true;
  close();
}

// Domäne → Emoji, rein für die Wiedererkennung in der Liste (dieselben Zuordnungen wie
// utils/sectionIcons.ts, dessen SectionKey-Schlüssel aber teils anders benannt sind als die
// activity.ts-Domänen ('todo' vs. 'todos', 'excursions' vs. 'ideas'/'spots') - eigene, kleine Map
// statt dort eine zweite Schlüsselwelt einzuführen.
const DOMAIN_EMOJI: Record<string, string> = {
  schedule: '📅',
  packing: '🧳',
  shopping: '🛒',
  todos: '📋',
  spots: '🗺️',
  ideas: '🎒',
  travel: '✈️',
  budget: '💶',
  diary: '📔',
  notes: '📝',
  members: '👥',
};

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

async function selectNotification(n: NotificationItem) {
  notifications.markRead(n.id);
  close();
  if (n.domain === 'schedule') {
    drawers.openCalendar();
    return;
  }
  const target = notificationTarget(n);
  if (target) router.push(target);
}

function markAllRead() {
  notifications.markAllRead();
}
</script>

<template>
  <div class="notification-inbox">
    <div class="bell-btn-wrap">
      <IconButton
        variant="ghost"
        shape="circle"
        :icon="BELL_ICON"
        title="Benachrichtigungen"
        :aria-label="bellAriaLabel"
        class="bell-btn"
        @click="toggle"
      />
      <span v-if="notifications.unreadCount > 0" class="unread-badge" aria-hidden="true">{{
        notifications.unreadCount > 9 ? '9+' : notifications.unreadCount
      }}</span>
      <UnseenDot v-else-if="hasSystemNotices" class="bell-dot" aria-label="Neuigkeiten verfügbar" />
    </div>

    <template v-if="open">
      <div
        class="backdrop"
        role="button"
        tabindex="0"
        aria-label="Benachrichtigungen schließen"
        @click="close"
        @keydown.enter.prevent="close"
        @keydown.space.prevent="close"
      ></div>
      <div class="dropdown">
        <div class="dropdown-header">
          <span class="dropdown-title">Benachrichtigungen</span>
          <button
            v-if="notifications.unreadCount > 0"
            type="button"
            class="mark-all-btn"
            title="Alle als gelesen markieren"
            aria-label="Alle als gelesen markieren"
            @click="markAllRead"
          >
            Alle als gelesen markieren
          </button>
        </div>
        <div class="notification-list">
          <!-- System-Benachrichtigungen (PWA-Update, Offline-Bereitschaft, App-Installation) -->
          <div v-if="hasSystemNotices" class="system-notices">
            <!-- 1. Neues Update verfügbar -->
            <div v-if="pwaUpdate.needRefresh" class="system-notice update pwa-pill update">
              <div class="notice-icon update-icon" aria-hidden="true">
                <AppIcon :icon="ACTION_ICONS.refresh" :size="16" group="actions" />
              </div>
              <div class="notice-body">
                <span class="notice-title">Neues Update verfügbar</span>
                <span class="notice-desc">Eine neuere Version von Reisotor steht bereit.</span>
              </div>
              <button type="button" class="pwa-pill-btn reload-btn" @click="pwaUpdate.reload">
                Neu laden
              </button>
            </div>

            <!-- 2. Offline verfügbar -->
            <div v-else-if="pwaUpdate.offlineReady" class="system-notice ready pwa-pill ready">
              <div class="notice-icon ready-icon" aria-hidden="true">
                <AppIcon :icon="ACTION_ICONS.done" :size="16" group="actions" />
              </div>
              <div class="notice-body">
                <span class="notice-title">Offline verfügbar</span>
                <span class="notice-desc">Die App lädt jetzt auch ohne Internetverbindung.</span>
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                :icon="ACTION_ICONS.close"
                aria-label="Hinweis schließen"
                title="Hinweis schließen"
                class="dismiss-btn"
                @click="pwaUpdate.dismissOfflineReady"
              />
            </div>

            <!-- 3. Als App installierbar -->
            <div
              v-if="!pwaInstall.isStandalone && !pwaInstall.dismissed"
              class="system-notice install pwa-pill install"
            >
              <div class="notice-icon install-icon" aria-hidden="true">
                <AppIcon :icon="ACTION_ICONS.installApp" :size="16" group="actions" />
              </div>
              <div class="notice-body">
                <span class="notice-title">Als App installierbar</span>
                <span class="notice-desc">Reisotor zum Startbildschirm hinzufügen.</span>
              </div>
              <div class="notice-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  class="pwa-pill-trigger install-btn"
                  @click="openInstallDialog"
                >
                  Installieren
                </Button>
                <IconButton
                  variant="ghost"
                  size="sm"
                  class="pwa-pill-dismiss-btn dismiss-btn"
                  :icon="ACTION_ICONS.close"
                  aria-label="Hinweis schließen"
                  title="Hinweis schließen"
                  @click="pwaInstall.dismiss()"
                />
              </div>
            </div>
          </div>

          <div
            v-if="hasSystemNotices && notifications.items.length > 0"
            class="system-divider"
            aria-hidden="true"
          ></div>

          <!-- Aktivitäts-Benachrichtigungen -->
          <button
            v-for="n in notifications.items"
            :key="n.id"
            type="button"
            class="notification-row"
            :class="{ unread: !n.read }"
            @click="selectNotification(n)"
          >
            <span class="row-emoji" aria-hidden="true">{{ DOMAIN_EMOJI[n.domain] ?? '🔔' }}</span>
            <span class="row-body">
              <span class="row-text">
                <strong>{{ n.actor.username }}</strong> hat {{ n.action_label }}
                <span class="row-domain">· {{ n.domain_label }}</span>
              </span>
              <span class="row-time">{{ formatDateTime(n.created_at) }}</span>
            </span>
            <span v-if="!n.read" class="unread-dot" aria-hidden="true"></span>
          </button>
          <p
            v-if="notifications.loaded && !notifications.items.length && !hasSystemNotices"
            class="empty"
          >
            Keine Benachrichtigungen.
          </p>
        </div>
      </div>
    </template>
    <PwaInstallDialog v-model="showInstallDialog" />
  </div>
</template>

<style scoped>
.notification-inbox {
  position: relative;
  display: flex;
}

.bell-btn-wrap {
  position: relative;
  display: inline-flex;
}

.bell-btn-wrap :deep(.bell-dot),
.bell-dot {
  top: 5px;
  right: 5px;
  pointer-events: none;
}

.unread-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--color-danger);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  border: 1.5px solid var(--color-surface);
  /* #195: line-height-basiertes Zentrieren (line-height == height) setzt die Ziffer optisch auf die
     Zeilen-Baseline statt die vertikale Mitte der Glyphe selbst zu treffen - je nach Schriftmetrik
     wirkt die Zahl dadurch leicht nach unten verschoben. display:flex zentriert stattdessen die
     tatsächliche Glyphen-Box, unabhängig von Font-Metriken. */
  display: flex;
  align-items: center;
  justify-content: center;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

/* position:fixed statt (wie TripSwitcher.vue's .dropdown) absolut relativ zum eigenen Wrapper: die
   Glocke sitzt selbst NICHT am rechten Header-Rand (PresenceAvatars/Theme-Toggle/Avatar
   folgen noch danach), ein "right:0" relativ zum Wrapper würde das Dropdown dadurch zu weit nach
   links schieben (auf schmalen Viewports bis über den linken Bildschirmrand hinaus). --app-header-
   height wird von AppHeader.vue bereits gepflegt (siehe dortiger ResizeObserver), right per
   --space-4 spiegelt dessen .header-row-Padding. */
.dropdown {
  position: fixed;
  top: var(--app-header-height, 56px);
  right: var(--space-4);
  width: min(360px, calc(100vw - 2 * var(--space-4)));
  max-height: min(70vh, 480px);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  z-index: 21;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.dropdown-title {
  font-weight: 700;
  font-size: 0.9rem;
}

.mark-all-btn {
  background: none;
  border: none;
  color: var(--color-primary-dark);
  font-size: 0.78rem;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm-squircle);
}

.mark-all-btn:hover {
  text-decoration: underline;
}

.mark-all-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.notification-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: var(--space-1);
}

.notification-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
}

.notification-row:hover {
  background: var(--color-hover);
}

.notification-row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.notification-row.unread {
  background: var(--color-primary-tint);
}

.notification-row.unread:hover {
  background: var(--color-hover);
}

.row-emoji {
  font-size: 1.1rem;
  line-height: 1.3;
  flex-shrink: 0;
}

.row-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.row-text {
  font-size: 0.85rem;
  color: var(--color-text);
}

.row-domain {
  color: var(--color-text-muted);
}

.row-time {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.unread-dot {
  align-self: center;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  flex-shrink: 0;
}

.empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  padding: var(--space-3);
  text-align: center;
}

.system-notices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-1);
}

.system-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  position: relative;
}

.system-notice.update {
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
}

.system-notice.ready {
  background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-success) 30%, var(--color-border));
}

.system-notice.install {
  background: var(--color-primary-tint);
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
}

.notice-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  corner-shape: round;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notice-icon.update-icon,
.notice-icon.ready-icon {
  background: color-mix(in srgb, var(--color-success) 20%, var(--color-surface));
  color: var(--color-success);
}

.notice-icon.install-icon {
  background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface));
  color: var(--color-primary-dark);
}

.notice-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.notice-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.25;
}

.notice-desc {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.25;
}

.notice-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.reload-btn {
  flex-shrink: 0;
  background: var(--color-success);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}

.reload-btn:hover {
  opacity: 0.9;
}

.reload-btn:focus-visible {
  outline: 2px solid var(--color-success);
  outline-offset: 2px;
}

.system-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) var(--space-2);
}
</style>
