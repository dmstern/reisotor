import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUserManagement, getUserRole, getUserRoleLabel } from './useUserManagement';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useAuthStore } from '../stores/auth';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

describe('useUserManagement & role helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('getUserRole & getUserRoleLabel', () => {
    it('correctly maps user flags to roles and labels', () => {
      const adminUser: User = { id: 1, username: 'admin', avatar: '👑', is_admin: true };
      const restrictedUser: User = {
        id: 2,
        username: 'restricted',
        avatar: '🙂',
        is_restricted: true,
      };
      const plusUser: User = {
        id: 3,
        username: 'plus',
        avatar: '🚀',
        is_admin: false,
        is_restricted: false,
      };

      expect(getUserRole(adminUser)).toBe('admin');
      expect(getUserRole(restrictedUser)).toBe('restricted');
      expect(getUserRole(plusUser)).toBe('plus');

      expect(getUserRoleLabel(adminUser)).toBe('Admin');
      expect(getUserRoleLabel(restrictedUser)).toBe('Basis-Konto');
      expect(getUserRoleLabel(plusUser)).toBe('Plus');
    });
  });

  describe('changeUserRole', () => {
    it('calls PUT /users/:id/role and updates user in list', async () => {
      const auth = useAuthStore();
      auth.user = { id: 1, username: 'admin', avatar: '👑', is_admin: true };

      const initialUser: User = { id: 5, username: 'alex', avatar: '🦊', is_restricted: true };
      const updatedUser: User = {
        id: 5,
        username: 'alex',
        avatar: '🦊',
        is_admin: false,
        is_restricted: false,
        restricted: false,
      };

      vi.mocked(api.put).mockResolvedValueOnce(updatedUser);

      const { userList, changeUserRole } = useUserManagement();
      userList.value = [initialUser];

      const result = await changeUserRole(initialUser, 'plus');

      expect(api.put).toHaveBeenCalledWith('/users/5/role', { role: 'plus' });
      expect(result).toEqual(updatedUser);
      expect(userList.value[0]).toEqual(updatedUser);
      expect(getUserRole(userList.value[0])).toBe('plus');
    });
  });

  describe('toggleLockUser', () => {
    it('calls PUT /users/:id/lock and updates user in list', async () => {
      vi.stubGlobal('confirm', () => true);
      const auth = useAuthStore();
      auth.user = { id: 1, username: 'admin', avatar: '👑', is_admin: true };

      const initialUser: User = { id: 5, username: 'alex', avatar: '🦊', is_locked: false };
      const updatedUser: User = { ...initialUser, is_locked: true };

      vi.mocked(api.put).mockResolvedValueOnce(updatedUser);

      const { userList, toggleLockUser } = useUserManagement();
      userList.value = [initialUser];

      const result = await toggleLockUser(initialUser);

      expect(api.put).toHaveBeenCalledWith('/users/5/lock', { is_locked: true });
      expect(result).toEqual(updatedUser);
      expect(userList.value[0].is_locked).toBe(true);
      vi.unstubAllGlobals();
    });
  });
});
