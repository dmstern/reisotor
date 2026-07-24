<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from './components/NavBar.vue';

const route = useRoute();
const showNav = computed(() => route.name !== 'login');
</script>

<template>
  <NavBar v-if="showNav" />
  <router-view />
</template>
