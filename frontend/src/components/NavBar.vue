<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const links = [
  { to: '/', label: 'Übersicht', icon: '🏠' },
  { to: '/schedule', label: 'Ablauf', icon: '📅' },
  { to: '/packing', label: 'Packliste', icon: '🧳' },
  { to: '/ideas', label: 'Ideen', icon: '💡' },
  { to: '/spots', label: 'Spots', icon: '📍' },
  { to: '/accommodation', label: 'Unterkunft', icon: '🛏️' },
  { to: '/budget', label: 'Budget', icon: '💶' },
  { to: '/map', label: 'Karte', icon: '🗺️' },
];

async function onLogout() {
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <nav class="navbar">
    <div class="brand">Reisotor</div>
    <div class="links">
      <router-link v-for="link in links" :key="link.to" :to="link.to" class="link">
        <span class="icon">{{ link.icon }}</span>
        <span class="label">{{ link.label }}</span>
      </router-link>
    </div>
    <button class="secondary logout" @click="onLogout">Abmelden</button>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  overflow-x: auto;
  z-index: 10;
}

.brand {
  display: none;
}

.links {
  display: flex;
  gap: var(--space-1);
  flex: 1;
}

.link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.7rem;
  white-space: nowrap;
}

.link.router-link-active {
  color: var(--color-primary-dark);
  background: #eaf3f1;
}

.icon {
  font-size: 1.2rem;
}

.logout {
  display: none;
}

@media (min-width: 800px) {
  .navbar {
    position: sticky;
    top: 0;
    bottom: auto;
    border-top: none;
    border-bottom: 1px solid var(--color-border);
  }

  .brand {
    display: block;
    font-weight: 700;
    color: var(--color-primary-dark);
    margin-right: var(--space-4);
    font-size: 1.1rem;
  }

  .link {
    flex-direction: row;
    font-size: 0.85rem;
  }

  .logout {
    display: inline-block;
  }
}
</style>
