<script setup lang="ts">
import { onMounted, ref } from 'vue';
import TabBar from '../components/TabBar.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import SettingsAccountTab from '../components/settings/SettingsAccountTab.vue';
import SettingsUsersTab from '../components/settings/SettingsUsersTab.vue';
import SettingsAppTab from '../components/settings/SettingsAppTab.vue';
import SettingsTripTab from '../components/settings/SettingsTripTab.vue';
import SettingsNotificationsTab from '../components/settings/SettingsNotificationsTab.vue';
import SettingsDataTab from '../components/settings/SettingsDataTab.vue';
import SettingsAboutTab from '../components/settings/SettingsAboutTab.vue';
import { useAuthStore } from '../stores/auth';
import { useUiSettingsStore } from '../stores/uiSettings';
import { useBuildInfoStore } from '../stores/buildInfo';
import { useSettingsTabs } from '../composables/useSettingsTabs';

const auth = useAuthStore();
const uiSettings = useUiSettingsStore();
const buildInfoStore = useBuildInfoStore();

const { tabs: TABS, activeTab, selectTab } = useSettingsTabs(() => auth.user?.is_admin);

const loading = ref(true);

onMounted(async () => {
  try {
    await Promise.all([uiSettings.load(true), buildInfoStore.load()]);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Einstellungen</h1>

    <div class="tab-bar-wrap">
      <TabBar :tabs="TABS" :active-key="activeTab" @select="selectTab" />
    </div>

    <SettingsAccountTab v-if="activeTab === 'account'" />
    <SettingsUsersTab v-else-if="activeTab === 'users' && auth.user?.is_admin" />
    <SettingsAppTab v-else-if="activeTab === 'app'" />
    <SettingsTripTab v-else-if="activeTab === 'trip'" />
    <SettingsNotificationsTab v-else-if="activeTab === 'notifications'" />
    <SettingsDataTab v-else-if="activeTab === 'data'" />
    <SettingsAboutTab v-else-if="activeTab === 'about'" />
  </div>
  <ViewLoadingState v-else message="Lade Einstellungen…" />
</template>

<style scoped>
.tab-bar-wrap {
  margin-bottom: var(--space-4);
}
</style>
