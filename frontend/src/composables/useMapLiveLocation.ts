import { computed, ref, type Ref } from 'vue';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useLiveSyncStore } from '../stores/liveSync';
import { useMapOrientationStore } from '../stores/mapOrientation';
import { useLocationSharingStore } from '../stores/locationSharing';

export function headingFromOrientationEvent(event: DeviceOrientationEvent): number | null {
  const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading;
  if (typeof webkitHeading === 'number') return webkitHeading;
  if (event.alpha == null) return null;
  return (360 - event.alpha) % 360;
}

export interface UseMapLiveLocationOptions {
  users: Ref<User[]>;
  onPositionUpdate?: () => void;
  setMapBearing?: (bearing: number) => void;
  centerOnPoint?: (latlng: [number, number], zoom: number) => void;
  onClearFocus?: () => void;
}

export function useMapLiveLocation(options: UseMapLiveLocationOptions) {
  const auth = useAuthStore();
  const liveSync = useLiveSyncStore();
  const mapOrientation = useMapOrientationStore();
  const locationSharing = useLocationSharingStore();

  const ownPosition = ref<{ lat: number; lng: number } | null>(null);
  let geoWatchId: number | null = null;

  const ownHeading = ref<number | null>(null);
  let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
  let orientationEventName: 'deviceorientationabsolute' | 'deviceorientation' = 'deviceorientation';

  const currentBearing = ref(0);

  function handleOrientation(event: DeviceOrientationEvent) {
    const heading = headingFromOrientationEvent(event);
    if (heading == null) return;
    ownHeading.value = heading;
    if (mapOrientation.mode === 'heading') {
      options.setMapBearing?.(heading);
    }
    options.onPositionUpdate?.();
  }

  function startCompass() {
    if (orientationHandler || typeof window === 'undefined') return;
    orientationEventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    orientationHandler = handleOrientation;
    window.addEventListener(orientationEventName, orientationHandler as EventListener);
  }

  function stopCompass() {
    if (!orientationHandler || typeof window === 'undefined') return;
    window.removeEventListener(orientationEventName, orientationHandler as EventListener);
    orientationHandler = null;
  }

  function toggleMapOrientation() {
    mapOrientation.toggle();
    if (mapOrientation.mode === 'north') {
      options.setMapBearing?.(0);
    } else if (ownHeading.value != null) {
      options.setMapBearing?.(ownHeading.value);
    }
  }

  function setMapOrientationMode(mode: 'north' | 'heading') {
    if (mapOrientation.mode !== mode) toggleMapOrientation();
  }

  function startLocationWatch() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        ownPosition.value = { lat: position.coords.latitude, lng: position.coords.longitude };
        liveSync.sendPosition(position.coords.latitude, position.coords.longitude);
        options.onPositionUpdate?.();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
  }

  function stopLocationWatch() {
    if (typeof navigator !== 'undefined' && geoWatchId != null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    stopCompass();
    if (locationSharing.activeDuration === 'off') {
      liveSync.stopSharingPosition();
    }
  }

  const otherMembers = computed(() => options.users.value.filter((u) => u.id !== auth.user?.id));

  function isMemberOnline(userId: number) {
    return liveSync.onlineUserIds.includes(userId);
  }

  function hasMemberPosition(userId: number) {
    return userId in liveSync.memberPositions;
  }

  function jumpToMemberLocation(userId: number) {
    const position = liveSync.memberPositions[userId];
    if (!position) return;
    options.onClearFocus?.();
    options.centerOnPoint?.([position.lat, position.lng], 16);
  }

  async function jumpToMyLocation() {
    if (!ownPosition.value) return;
    if (typeof window !== 'undefined') {
      const OrientationEventCtor = (
        window as unknown as {
          DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
        }
      ).DeviceOrientationEvent;
      if (OrientationEventCtor?.requestPermission && !orientationHandler) {
        try {
          const state = await OrientationEventCtor.requestPermission();
          if (state === 'granted') startCompass();
        } catch {}
      }
    }
    options.onClearFocus?.();
    options.centerOnPoint?.([ownPosition.value.lat, ownPosition.value.lng], 16);
  }

  function initCompassAuto() {
    if (typeof window === 'undefined') return;
    const OrientationEventCtor = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    if (OrientationEventCtor && !OrientationEventCtor.requestPermission) {
      startCompass();
    }
  }

  return {
    ownPosition,
    ownHeading,
    currentBearing,
    mapOrientation,
    otherMembers,
    startCompass,
    stopCompass,
    toggleMapOrientation,
    setMapOrientationMode,
    startLocationWatch,
    stopLocationWatch,
    initCompassAuto,
    isMemberOnline,
    hasMemberPosition,
    jumpToMemberLocation,
    jumpToMyLocation,
  };
}
