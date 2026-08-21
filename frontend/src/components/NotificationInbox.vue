<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IconBell, IconBellFilled } from '@tabler/icons-vue';
import { useNotificationsStore } from '../stores/notifications';
import { useDrawersStore } from '../stores/drawers';
import AppIcon from './AppIcon.vue';
import type { NotificationItem } from '../api/types';
import { notificationTarget } from '../utils/notificationTarget';
import { formatDateTime } from '../utils/dateFormat';

// Notification-Inbox (#97): GitHub-artiges Glocken-Icon im Header mit Dropdown der ungelesenen (und
// zuletzt gelesenen) Aktivitäten anderer Mitglieder - Datenhaltung/Realtime-Anbindung siehe
// stores/notifications.ts. Gleiches Dropdown-Muster (Backdrop + absolut positioniertes Panel,
// squircle) wie TripSwitcher.vue.
const notifications = useNotificationsStore();
const drawers = useDrawersStore();
const router = useRouter();
const open = ref(false);

const BELL_ICON = { id: 'bell', emoji: '🔔', outline: IconBell, filled: IconBellFilled };

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
    <button
      type="button"
      class="bell-btn"
      title="Benachrichtigungen"
      aria-label="Benachrichtigungen"
      @click="toggle"
    >
      <AppIcon :icon="BELL_ICON" group="navigation" :size="22" />
      <span v-if="notifications.unreadCount > 0" class="unread-badge">{{
        notifications.unreadCount > 9 ? '9+' : notifications.unreadCount
      }}</span>
    </button>

    <template v-if="open">
      <div class="backdrop" @click="close"></div>
      <div class="dropdown">
        <div class="dropdown-header">
          <span class="dropdown-title">Benachrichtigungen</span>
          <button
            v-if="notifications.unreadCount > 0"
            type="button"
            class="mark-all-btn"
            @click="markAllRead"
          >
            Alle als gelesen markieren
          </button>
        </div>
        <div class="notification-list">
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
          <p v-if="notifications.loaded && !notifications.items.length" class="empty">
            Keine Benachrichtigungen.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notification-inbox {
  position: relative;
  display: flex;
}

.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: none;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.bell-btn:hover {
  background: var(--color-hover);
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
   Glocke sitzt selbst NICHT am rechten Header-Rand (PresenceAvatars/Theme-Toggle/Profil-Avatar
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
}

.mark-all-btn:hover {
  text-decoration: underline;
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
}

.notification-row:hover {
  background: var(--color-hover);
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
</style>
