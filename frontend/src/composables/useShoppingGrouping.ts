import { computed, watch, type Ref } from 'vue';
import type { ShoppingItem, User } from '../api/types';
import { usePersistedRef } from './usePersistedRef';
import { useUiSettingsStore } from '../stores/uiSettings';
import { PERIOD_META } from '../utils/period';
import { sortWithDoneLast } from './useCheckedSort';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { IconDef } from '../utils/icon';

export type ShoppingGroupBy = 'buyer' | 'shop' | 'period';

export interface ShoppingGroup {
  key: string;
  label: string;
  iconDef?: IconDef;
  items: ShoppingItem[];
}

export const UNASSIGNED_SHOP = 'Ohne Shop';

export function useShoppingGrouping(items: Ref<ShoppingItem[]>, users: Ref<User[]>) {
  const uiSettings = useUiSettingsStore();

  const groupBy = usePersistedRef<ShoppingGroupBy>('reisotor-shopping-group-by', 'buyer');

  const defaultGroupBy = computed<ShoppingGroupBy>(() =>
    users.value.length > 1 ? 'buyer' : 'shop'
  );

  watch(users, () => {
    if (users.value.length <= 1 && groupBy.value === 'buyer') {
      groupBy.value = 'period';
    }
  });

  const groupByOptions = computed<Array<{ value: ShoppingGroupBy; label: string; icon: IconDef }>>(
    () => {
      const opts = [];
      if (users.value.length > 1) {
        opts.push({
          value: 'buyer' as const,
          label: 'nach Einkäufer:in',
          icon: FORM_FIELD_ICONS.person,
        });
      }
      opts.push({ value: 'shop' as const, label: 'nach Shop', icon: FORM_FIELD_ICONS.shop });
      opts.push({
        value: 'period' as const,
        label: 'nach Zeitraum',
        icon: FORM_FIELD_ICONS.period,
      });
      return opts;
    }
  );

  function userAvatar(id: number | null | undefined) {
    if (id == null) return null;
    const u = users.value.find((u) => u.id === id);
    return u ? u.avatar : '👤';
  }

  function userName(id: number | null | undefined) {
    if (id == null) return null;
    const u = users.value.find((u) => u.id === id);
    return u ? u.username : 'Ehemaliges Mitglied';
  }

  function isChecked(item: ShoppingItem) {
    return !!item.checked;
  }

  const groupedItems = computed<ShoppingGroup[]>(() => {
    const visibleItems = uiSettings.hideCompletedShopping
      ? items.value.filter((i) => !isChecked(i))
      : items.value;

    if (groupBy.value === 'shop') {
      const groups = new Map<string, ShoppingItem[]>();
      for (const item of visibleItems) {
        const key = item.shop?.trim() || UNASSIGNED_SHOP;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      return [...groups.entries()]
        .sort(([a], [b]) =>
          a === UNASSIGNED_SHOP ? 1 : b === UNASSIGNED_SHOP ? -1 : a.localeCompare(b, 'de')
        )
        .map(([shop, shopItems]) => ({
          key: shop,
          label: shop,
          iconDef: FORM_FIELD_ICONS.shop,
          items: sortWithDoneLast(shopItems, isChecked),
        }));
    }
    if (groupBy.value === 'period') {
      const groups: ShoppingGroup[] = [
        {
          key: 'before',
          label: PERIOD_META.before,
          items: sortWithDoneLast(
            visibleItems.filter((i) => i.period === 'before'),
            isChecked
          ),
        },
        {
          key: 'during',
          label: PERIOD_META.during,
          items: sortWithDoneLast(
            visibleItems.filter((i) => i.period === 'during'),
            isChecked
          ),
        },
        {
          key: 'none',
          label: 'Ohne Zeitraum',
          items: sortWithDoneLast(
            visibleItems.filter((i) => !i.period),
            isChecked
          ),
        },
      ];
      return groups;
    }
    // buyer
    const memberIds = new Set(users.value.map((u) => u.id));
    const perUser: ShoppingGroup[] = users.value.map((u) => ({
      key: `user-${u.id}`,
      label: `${u.avatar} ${u.username}`,
      items: sortWithDoneLast(
        visibleItems.filter((i) => i.assigned_to_user_id === u.id),
        isChecked
      ),
    }));
    const unassigned: ShoppingGroup = {
      key: 'unassigned',
      label: 'Nicht zugewiesen',
      items: sortWithDoneLast(
        visibleItems.filter(
          (i) => i.assigned_to_user_id == null || !memberIds.has(i.assigned_to_user_id)
        ),
        isChecked
      ),
    };
    return [...perUser, unassigned];
  });

  const knownShops = computed(() => {
    const set = new Set<string>();
    items.value.forEach((i) => i.shop && set.add(i.shop));
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  });

  function hasItemMeta(item: ShoppingItem): boolean {
    return Boolean(
      item._pending ||
      (groupBy.value !== 'shop' && item.shop) ||
      (groupBy.value !== 'period' && item.period) ||
      item.link ||
      item.note
    );
  }

  return {
    groupBy,
    defaultGroupBy,
    groupByOptions,
    groupedItems,
    knownShops,
    userAvatar,
    userName,
    isChecked,
    hasItemMeta,
  };
}
