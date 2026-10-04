import { computed, ref, type ComponentPublicInstance, type Ref } from 'vue';
import { useLocationSharingStore, type ShareDuration } from '../stores/locationSharing';

export const WIDE_PICKER_MENU_WIDTH = 252;
export const STANDARD_PICKER_MENU_WIDTH = 216;

export function computeTeleportMenuPosition(
  triggerRef: Ref<HTMLElement | ComponentPublicInstance | null> | null,
  event?: MouseEvent,
  menuWidth = STANDARD_PICKER_MENU_WIDTH
): { top: string; left: string } {
  const el =
    (event?.currentTarget as HTMLElement) ||
    (triggerRef?.value as ComponentPublicInstance)?.$el ||
    (triggerRef?.value as HTMLElement);
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return { top: '0px', left: '0px' };
  }
  const rect = el.getBoundingClientRect();
  const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  return {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.left, innerWidth - menuWidth))}px`,
  };
}

export interface UseMapToolMenusOptions {
  onFocusMenuOpen?: () => void;
}

export function useMapToolMenus(options: UseMapToolMenusOptions = {}) {
  const locationSharing = useLocationSharingStore();

  // Focus menu
  const focusMenuOpen = ref(false);
  const focusButtonRef = ref<HTMLButtonElement | null>(null);
  const focusMenuStyle = ref({ top: '0px', left: '0px' });

  function toggleFocusMenu(event?: MouseEvent) {
    if (!focusMenuOpen.value) {
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

  // Location menu
  const locationMenuOpen = ref(false);
  const locationButtonRef = ref<HTMLButtonElement | null>(null);
  const locationMenuStyle = ref({ top: '0px', left: '0px' });

  function toggleLocationMenu(event?: MouseEvent) {
    if (!locationMenuOpen.value) {
      locationMenuStyle.value = computeTeleportMenuPosition(
        locationButtonRef,
        event,
        WIDE_PICKER_MENU_WIDTH
      );
      locationMenuOpen.value = true;
    } else {
      locationMenuOpen.value = false;
    }
  }

  function selectLocation(action: () => void) {
    locationMenuOpen.value = false;
    action();
  }

  // Share menu
  const shareMenuOpen = ref(false);
  const shareButtonRef = ref<HTMLButtonElement | null>(null);
  const shareMenuStyle = ref({ top: '0px', left: '0px' });

  const shareDurationLabel = computed(() => {
    if (locationSharing.activeDuration === 'off' || !locationSharing.shareUntil)
      return 'Standort teilen';
    if (locationSharing.activeDuration === 'forever') return 'Standort wird dauerhaft geteilt';
    const until = new Date(locationSharing.shareUntil);
    return `Standort geteilt bis ${until.toLocaleDateString('de-DE')}`;
  });

  function toggleShareMenu(event?: MouseEvent) {
    if (!shareMenuOpen.value) {
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
    // Focus menu
    focusMenuOpen,
    focusButtonRef,
    focusMenuStyle,
    toggleFocusMenu,
    selectFocus,
    // Location menu
    locationMenuOpen,
    locationButtonRef,
    locationMenuStyle,
    toggleLocationMenu,
    selectLocation,
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
