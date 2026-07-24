<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import NavBar from './components/NavBar.vue';

const route = useRoute();
const showNav = computed(() => route.name !== 'login');
</script>

<template>
  <AppHeader v-if="showNav" />
  <NavBar v-if="showNav" />
  <router-view />
</template>
