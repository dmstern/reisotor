import { describe, expect, it, vi } from 'vitest';
import { ALL_SETTINGS_TABS, useSettingsTabs } from './useSettingsTabs';

const mockRoute = { query: {} as Record<string, string> };
const mockRouter = { replace: vi.fn() };

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

describe('useSettingsTabs', () => {
  it('defines the admin tab as adminOnly with label Admin-Oberfläche', () => {
    const adminTab = ALL_SETTINGS_TABS.find((t) => t.key === 'admin');
    expect(adminTab).toBeDefined();
    expect(adminTab?.label).toBe('Admin-Oberfläche');
    expect(adminTab?.adminOnly).toBe(true);
  });

  it('filters admin tabs for non-admin users', () => {
    mockRoute.query = {};
    const { tabs } = useSettingsTabs(false);
    expect(tabs.value.some((t) => t.key === 'admin')).toBe(false);
  });

  it('includes admin tab for admin users and excludes standalone data tab', () => {
    mockRoute.query = {};
    const { tabs } = useSettingsTabs(true);
    expect(tabs.value.some((t) => t.key === 'admin')).toBe(true);
    expect(tabs.value.some((t) => t.key === 'data')).toBe(false);
  });

  it('maps legacy ?tab=users to admin tab for backwards compatibility', () => {
    mockRoute.query = { tab: 'users' };
    const { activeTab } = useSettingsTabs(true);
    expect(activeTab.value).toBe('admin');
  });

  it('maps legacy ?tab=data to admin tab for backwards compatibility', () => {
    mockRoute.query = { tab: 'data' };
    const { activeTab } = useSettingsTabs(true);
    expect(activeTab.value).toBe('admin');
  });

  it('selects admin tab when ?tab=admin is provided', () => {
    mockRoute.query = { tab: 'admin' };
    const { activeTab } = useSettingsTabs(true);
    expect(activeTab.value).toBe('admin');
  });
});
