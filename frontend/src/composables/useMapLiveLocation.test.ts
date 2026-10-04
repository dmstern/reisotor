// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useMapLiveLocation, headingFromOrientationEvent } from './useMapLiveLocation';
import { useLiveSyncStore } from '../stores/liveSync';
import { useAuthStore } from '../stores/auth';
import type { User } from '../api/types';

describe('useMapLiveLocation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('headingFromOrientationEvent', () => {
    it('returns webkitCompassHeading if present', () => {
      const event = { webkitCompassHeading: 45 } as unknown as DeviceOrientationEvent;
      expect(headingFromOrientationEvent(event)).toBe(45);
    });

    it('converts alpha to compass heading', () => {
      const event = { alpha: 90 } as unknown as DeviceOrientationEvent;
      expect(headingFromOrientationEvent(event)).toBe(270);
    });

    it('returns null if no heading or alpha is present', () => {
      const event = {} as unknown as DeviceOrientationEvent;
      expect(headingFromOrientationEvent(event)).toBeNull();
    });
  });

  describe('member location jumping and status', () => {
    it('filters out current user from otherMembers', () => {
      const auth = useAuthStore();
      auth.user = { id: 1, username: 'me', avatar: '🐱', is_admin: false };

      const users = ref<User[]>([
        { id: 1, username: 'me', avatar: '🐱', is_admin: false },
        { id: 2, username: 'other', avatar: '🐶', is_admin: false },
      ]);

      const liveLoc = useMapLiveLocation({ users });
      expect(liveLoc.otherMembers.value.length).toBe(1);
      expect(liveLoc.otherMembers.value[0].id).toBe(2);
    });

    it('checks member online and position sharing status', () => {
      const liveSync = useLiveSyncStore();
      liveSync.onlineUserIds = [2];
      liveSync.memberPositions = { 2: { lat: 48.1, lng: 11.5, updatedAt: '2026-01-01T10:00:00Z' } };

      const users = ref<User[]>([]);
      const liveLoc = useMapLiveLocation({ users });

      expect(liveLoc.isMemberOnline(2)).toBe(true);
      expect(liveLoc.isMemberOnline(3)).toBe(false);
      expect(liveLoc.hasMemberPosition(2)).toBe(true);
      expect(liveLoc.hasMemberPosition(3)).toBe(false);
    });

    it('jumps to member location and invokes clearFocus and centerOnPoint', () => {
      const liveSync = useLiveSyncStore();
      liveSync.memberPositions = {
        5: { lat: 48.12, lng: 11.58, updatedAt: '2026-01-01T10:00:00Z' },
      };

      const onClearFocus = vi.fn();
      const centerOnPoint = vi.fn();
      const users = ref<User[]>([]);

      const liveLoc = useMapLiveLocation({ users, onClearFocus, centerOnPoint });
      liveLoc.jumpToMemberLocation(5);

      expect(onClearFocus).toHaveBeenCalled();
      expect(centerOnPoint).toHaveBeenCalledWith([48.12, 11.58], 16);
    });

    it('jumps to my location when ownPosition is present', async () => {
      const onClearFocus = vi.fn();
      const centerOnPoint = vi.fn();
      const users = ref<User[]>([]);

      const liveLoc = useMapLiveLocation({ users, onClearFocus, centerOnPoint });
      liveLoc.ownPosition.value = { lat: 50.1, lng: 8.6 };

      await liveLoc.jumpToMyLocation();
      expect(onClearFocus).toHaveBeenCalled();
      expect(centerOnPoint).toHaveBeenCalledWith([50.1, 8.6], 16);
    });
  });
});
