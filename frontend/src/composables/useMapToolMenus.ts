import { computed, ref, type ComponentPublicInstance, type Ref } from 'vue';
import { useLocationSharingStore, type ShareDuration } from '../stores/locationSharing';

export const WIDE_PICKER_MENU_WIDTH = 252;
export const STANDARD_PICKER_MENU_WIDTH = 216;

export function computeTeleportMenuPosition(
  triggerRef: Ref<HTMLElement | ComponentPublicInstance | null> | null,
  event?: MouseEvent,
  menuWidth = STANDARD_PICKER_MENU_WIDTH,
  align: 'left' | 'right' = 'left'
): { top: string; left?: string; right?: string } {
  const el =
    (event?.currentTarget as HTMLElement) ||
    (triggerRef?.value as ComponentPublicInstance)?.$el ||
    (triggerRef?.value as HTMLElement);
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return { top: '0px', left: '0px' };
  }
  const rect = el.getBoundingClientRect();
  const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  if (align === 'right') {
    return {
      top: `${rect.bottom + 6}px`,
      right: `${Math.max(8, innerWidth - rect.right)}px`,
    };
  }
  return {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.left, innerWidth - menuWidth))}px`,
  };
}

export type TeleportMenuPosition = {
  top: string;
  left?: string;
  right?: string;
};

export interface UseMapToolMenusOptions {
  onFocusMenuOpen?: () => void;
}

export function useMapToolMenus(options: UseMapToolMenusOptions = {}) {
  const locationSharing = useLocationSharingStore();

  // Focus menu
  const focusMenuOpen = ref(false);
  const focusButtonRef = ref<HTMLButtonElement | null>(null);
  const focusMenuStyle = ref<TeleportMenuPosition>({ top: '0px', left: '0px' });

  function toggleFocusMenu(event?: MouseEvent) {
    if (!focusMenuOpen.value) {
      shareMenuOpen.value = false;
      focusMenuStyle.value = computeTeleportMenuPosition(
        focusButtonRef,
        event,
        WIDE_PICKER_MENU_WIDTH
      );
      focusMenuOpen.value = true;
      options.onFocusMenuOpen?.();
    } else {
      focusMenuOpen.value = false;
    }
  }

  function selectFocus(action: () => void) {
    focusMenuOpen.value = false;
    action();
  }

  // Share menu
  const shareMenuOpen = ref(false);
  const shareButtonRef = ref<HTMLButtonElement | null>(null);
  const shareMenuStyle = ref<TeleportMenuPosition>({ top: '0px', left: '0px' });

  const shareDurationLabel = computed(() => {
    if (locationSharing.activeDuration === 'off' || !locationSharing.shareUntil)
      return 'Standort teilen';
    if (locationSharing.activeDuration === 'forever') return 'Standort wird dauerhaft geteilt';
    const until = new Date(locationSharing.shareUntil);
    return `Standort geteilt bis ${until.toLocaleDateString('de-DE')}`;
  });

  function toggleShareMenu(event?: MouseEvent) {
    if (!shareMenuOpen.value) {
      focusMenuOpen.value = false;
      shareMenuStyle.value = computeTeleportMenuPosition(
        shareButtonRef,
        event,
        STANDARD_PICKER_MENU_WIDTH
      );
      shareMenuOpen.value = true;
    } else {
      shareMenuOpen.value = false;
    }
  }

  async function chooseShareDuration(duration: ShareDuration) {
    shareMenuOpen.value = false;
    await locationSharing.setDuration(duration);
  }

  return {
    // Focus & orientation menu
    focusMenuOpen,
    focusButtonRef,
    focusMenuStyle,
    toggleFocusMenu,
    selectFocus,
    // Share menu
    shareMenuOpen,
    shareButtonRef,
    shareMenuStyle,
    shareDurationLabel,
    toggleShareMenu,
    chooseShareDuration,
    locationSharing,
  };
}
