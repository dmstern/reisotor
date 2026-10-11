// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useDiarySocial } from './useDiarySocial';
import { useAuthStore } from '../stores/auth';
import type { User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../api/client';

describe('useDiarySocial', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const auth = useAuthStore();
    auth.user = { id: 1, username: 'testuser', avatar: '🐱', role: 'user' } as User;
  });

  const mockUsers = ref<User[]>([
    { id: 1, username: 'user1', avatar: '🐱', role: 'user' } as User,
    { id: 2, username: 'user2', avatar: '🦊', role: 'user' } as User,
  ]);

  it('filters likes for an entry and checks if liked by me', () => {
    const social = useDiarySocial({ users: mockUsers });
    social.likes.value = [
      { id: 10, entry_id: 100, user_id: 1 },
      { id: 11, entry_id: 100, user_id: 2 },
      { id: 12, entry_id: 200, user_id: 2 },
    ];

    expect(social.likesFor(100)).toHaveLength(2);
    expect(social.likedByMe(100)).toBe(true);
    expect(social.likedByMe(200)).toBe(false);
  });

  it('toggles likes correctly via api', async () => {
    const social = useDiarySocial({ users: mockUsers });
    social.likes.value = [];

    vi.mocked(api.post).mockResolvedValueOnce({ liked: true });
    await social.toggleLike(100);
    expect(social.likedByMe(100)).toBe(true);

    vi.mocked(api.post).mockResolvedValueOnce({ liked: false });
    await social.toggleLike(100);
    expect(social.likedByMe(100)).toBe(false);
  });

  it('formats comment items with user avatar, name, and permissions', () => {
    const social = useDiarySocial({ users: mockUsers });
    social.comments.value = [
      {
        id: 1,
        entry_id: 100,
        author_id: 1,
        content: 'Super Tag!',
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
        like_count: 2,
        liked: true,
      },
      {
        id: 2,
        entry_id: 100,
        author_id: 2,
        content: 'Toll!',
        created_at: '2026-07-01T11:00:00Z',
        updated_at: '2026-07-01T11:00:00Z',
        like_count: 0,
        liked: false,
      },
    ];

    const items = social.commentItemsFor(100);
    expect(items).toHaveLength(2);
    expect(items[0].username).toBe('user1');
    expect(items[0].avatar).toBe('🐱');
    expect(items[0].canEdit).toBe(true);
    expect(items[1].username).toBe('user2');
    expect(items[1].canEdit).toBe(false);
  });

  it('toggles comments open state', () => {
    const social = useDiarySocial({ users: mockUsers });
    expect(social.openComments.value.has(100)).toBe(false);

    social.toggleComments(100);
    expect(social.openComments.value.has(100)).toBe(true);

    social.toggleComments(100);
    expect(social.openComments.value.has(100)).toBe(false);
  });

  it('submits, updates, and deletes comments', async () => {
    const social = useDiarySocial({ users: mockUsers });

    vi.mocked(api.post).mockResolvedValueOnce({
      id: 5,
      entry_id: 100,
      author_id: 1,
      content: 'Neu',
      created_at: '2026-07-01T12:00:00Z',
      updated_at: '2026-07-01T12:00:00Z',
    });
    await social.submitComment(100, 'Neu');
    expect(social.comments.value).toHaveLength(1);
    expect(social.comments.value[0].id).toBe(5);

    vi.mocked(api.put).mockResolvedValueOnce({
      id: 5,
      entry_id: 100,
      author_id: 1,
      content: 'Aktualisiert',
      created_at: '2026-07-01T12:00:00Z',
      updated_at: '2026-07-01T12:30:00Z',
    });
    await social.updateComment(5, 'Aktualisiert');
    expect(social.comments.value[0].content).toBe('Aktualisiert');

    vi.mocked(api.delete).mockResolvedValueOnce({});
    await social.removeComment(5);
    expect(social.comments.value).toHaveLength(0);
  });
});
