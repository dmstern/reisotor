import { ref, type Ref } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';

export interface UseDiarySocialOptions {
  users: Ref<User[]>;
}

export function useDiarySocial(options: UseDiarySocialOptions) {
  const { users } = options;
  const auth = useAuthStore();

  const likes = ref<DiaryLike[]>([]);
  const comments = ref<DiaryComment[]>([]);
  const openComments = ref<Set<number>>(new Set());

  function author(id: number) {
    return users.value.find((u) => u.id === id);
  }

  function likesFor(entryId: number) {
    return likes.value.filter((l) => l.entry_id === entryId);
  }

  function likedByMe(entryId: number) {
    return likesFor(entryId).some((l) => l.user_id === auth.user?.id);
  }

  function commentsFor(entryId: number) {
    return comments.value
      .filter((c) => c.entry_id === entryId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  function commentItemsFor(entryId: number) {
    return commentsFor(entryId).map((c) => ({
      id: c.id,
      avatar: c.author_avatar ?? author(c.author_id)?.avatar ?? '❓',
      username: c.author_username ?? author(c.author_id)?.username ?? '?',
      content: c.content,
      created_at: c.created_at,
      updated_at: c.updated_at,
      canRemove: c.author_id === auth.user?.id,
      canEdit: c.author_id === auth.user?.id,
      likeCount: c.like_count ?? 0,
      liked: Boolean(c.liked),
    }));
  }

  async function toggleLike(entryId: number) {
    if (!auth.user) return;
    const result = await api.post<{ liked: boolean }>(`/diary/${entryId}/like`);
    if (result.liked) {
      likes.value.push({ id: Date.now(), entry_id: entryId, user_id: auth.user.id });
    } else {
      likes.value = likes.value.filter(
        (l) => !(l.entry_id === entryId && l.user_id === auth.user!.id)
      );
    }
  }

  function toggleComments(entryId: number) {
    if (openComments.value.has(entryId)) openComments.value.delete(entryId);
    else openComments.value.add(entryId);
  }

  async function submitComment(entryId: number, content: string) {
    const created = await api.post<DiaryComment>(`/diary/${entryId}/comments`, { content });
    comments.value.push(created);
  }

  async function removeComment(id: number) {
    await api.delete(`/diary/comments/${id}`);
    comments.value = comments.value.filter((c) => c.id !== id);
  }

  async function updateComment(id: number, content: string) {
    const updated = await api.put<DiaryComment>(`/diary/comments/${id}`, { content });
    const idx = comments.value.findIndex((c) => c.id === id);
    if (idx !== -1) {
      comments.value[idx] = updated;
    }
  }

  async function toggleCommentLike(commentId: number) {
    const c = comments.value.find((item) => item.id === commentId);
    if (c) {
      const wasLiked = Boolean(c.liked);
      c.liked = !wasLiked;
      c.like_count = Math.max(0, (c.like_count ?? 0) + (wasLiked ? -1 : 1));
    }
    try {
      const result = await api.post<{ liked: boolean; like_count: number }>(
        `/diary/comments/${commentId}/like`
      );
      if (c) {
        c.liked = result.liked;
        c.like_count = result.like_count;
      }
    } catch (err) {
      if (c) {
        const wasLiked = Boolean(c.liked);
        c.liked = !wasLiked;
        c.like_count = Math.max(0, (c.like_count ?? 0) + (wasLiked ? -1 : 1));
      }
      throw err;
    }
  }

  return {
    likes,
    comments,
    openComments,
    likesFor,
    likedByMe,
    commentsFor,
    commentItemsFor,
    toggleLike,
    toggleComments,
    submitComment,
    removeComment,
    updateComment,
    toggleCommentLike,
  };
}
