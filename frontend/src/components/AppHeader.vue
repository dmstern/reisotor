<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import TripSwitcher from './TripSwitcher.vue';

const auth = useAuthStore();
const theme = useThemeStore();
</script>

<template>
  <header class="app-header">
    <router-link to="/" class="brand">
      <img src="/reisotor_logo.svg" alt="Reisotor Logo" class="logo" />
      <span class="wordmark">Reisotor</span>
    </router-link>
    <TripSwitcher class="switcher" />
    <button
      type="button"
      class="secondary theme-toggle"
      :title="theme.isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'"
      :aria-label="theme.isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'"
      @click="theme.toggle"
    >
      {{ theme.isDark ? '☀️' : '🌙' }}
    </button>
    <router-link to="/profile" class="profile-link" title="Profil">
      <span class="avatar">{{ auth.user?.avatar || '👤' }}</span>
    </router-link>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 11;
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  padding: 0 var(--space-4);
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  width: fit-content;
  flex-shrink: 0;
}

.switcher {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.logo {
  width: 32px;
  height: 32px;
}

.wordmark {
  font-weight: 700;
  color: var(--color-primary-dark);
  font-size: 1.1rem;
}

.theme-toggle {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-tint);
  text-decoration: none;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.profile-link:hover,
.profile-link.router-link-active {
  background: var(--color-primary);
}

.avatar {
  font-size: 1.2rem;
  line-height: 1;
}
</style>
