import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IconUser,
  IconUserFilled,
  IconUsers,
  IconDeviceDesktop,
  IconDeviceDesktopFilled,
  IconBell,
  IconBellFilled,
  IconDatabase,
  IconDatabaseFilled,
  IconInfoCircle,
  IconInfoCircleFilled,
} from '@tabler/icons-vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { IconDef } from '../utils/icon';

export const BELL_ICON: IconDef = {
  id: 'bell',
  emoji: '🔔',
  outline: IconBell,
  filled: IconBellFilled,
};
export const USERS_ICON: IconDef = { id: 'users', emoji: '👥', outline: IconUsers };

export type SettingsTab = 'account' | 'users' | 'app' | 'trip' | 'notifications' | 'data' | 'about';

export interface SettingsTabItem {
  key: SettingsTab;
  label: string;
  icon: IconDef;
  adminOnly?: boolean;
}

export const ALL_SETTINGS_TABS: SettingsTabItem[] = [
  {
    key: 'account',
    label: 'Account',
    icon: { id: 'user', emoji: '👤', outline: IconUser, filled: IconUserFilled },
  },
  { key: 'users', label: 'Nutzerverwaltung', icon: USERS_ICON, adminOnly: true },
  {
    key: 'app',
    label: 'App-Einstellungen',
    icon: {
      id: 'device-desktop',
      emoji: '🖥️',
      outline: IconDeviceDesktop,
      filled: IconDeviceDesktopFilled,
    },
  },
  { key: 'trip', label: 'Reise-Anzeige', icon: FORM_FIELD_ICONS.date },
  { key: 'notifications', label: 'Benachrichtigungen', icon: BELL_ICON },
  {
    key: 'data',
    label: 'Daten',
    icon: { id: 'database', emoji: '🗄️', outline: IconDatabase, filled: IconDatabaseFilled },
    adminOnly: true,
  },
  {
    key: 'about',
    label: 'Über',
    icon: { id: 'info-circle', emoji: 'ℹ️', outline: IconInfoCircle, filled: IconInfoCircleFilled },
  },
];

export function useSettingsTabs(isAdmin: MaybeRefOrGetter<boolean | undefined>) {
  const route = useRoute();
  const router = useRouter();

  const tabs = computed(() => ALL_SETTINGS_TABS.filter((t) => !t.adminOnly || toValue(isAdmin)));
  const tabKeys = computed(() => tabs.value.map((t) => t.key));

  const activeTab = computed<SettingsTab>(() => {
    const tab = route.query.tab;
    return (tabKeys.value as string[]).includes(tab as string) ? (tab as SettingsTab) : 'account';
  });

  function selectTab(tab: string) {
    router.replace({ query: { ...route.query, tab: tab as SettingsTab } });
  }

  return {
    tabs,
    tabKeys,
    activeTab,
    selectTab,
    allTabs: ALL_SETTINGS_TABS,
  };
}
