import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IconUser,
  IconUserFilled,
  IconUsers,
  IconShieldLock,
  IconShieldLockFilled,
  IconDeviceDesktop,
  IconDeviceDesktopFilled,
  IconBell,
  IconBellFilled,
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
export const ADMIN_ICON: IconDef = {
  id: 'shield-lock',
  emoji: '🛡️',
  outline: IconShieldLock,
  filled: IconShieldLockFilled,
};

export type SettingsTab =
  'account' | 'admin' | 'users' | 'app' | 'trip' | 'notifications' | 'data' | 'about';

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
  { key: 'admin', label: 'Admin-Oberfläche', icon: ADMIN_ICON, adminOnly: true },
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
    let tab = route.query.tab as string;
    if (tab === 'users' || tab === 'data') tab = 'admin';
    return (tabKeys.value as string[]).includes(tab) ? (tab as SettingsTab) : 'account';
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
