import { ref, type Ref } from 'vue';
import { api } from '../api/client';
import type { ExcursionComment, ExcursionLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useSpotsStore } from '../stores/spots';

export interface UseExcursionSocialOptions {
  users: Ref<User[]>;
}

export function useExcursionSocial(options: UseExcursionSocialOptions) {
  const { users } = options;
  const auth = useAuthStore();
  const spotsStore = useSpotsStore();

  const excursionLikes = ref<ExcursionLike[]>([]);
  const excursionComments = ref<ExcursionComment[]>([]);

  function creatorLabel(userId: number | null) {
    if (userId == null) return null;
    const u = users.value.find((u) => u.id === userId);
    return u ? `${u.avatar} ${u.username}` : null;
  }

  function author(id: number) {
    return users.value.find((u) => u.id === id);
  }

  function spotCommentItemsFor(spotId: number) {
    return spotsStore.commentsFor(spotId).map((c) => ({
      id: c.id,
      avatar: author(c.author_id)?.avatar ?? '❓',
      username: author(c.author_id)?.username ?? '?',
      content: c.content,
      created_at: c.created_at,
      updated_at: c.updated_at,
      canRemove: c.author_id === auth.user?.id,
      canEdit: c.author_id === auth.user?.id,
      likeCount: c.like_count ?? 0,
      liked: Boolean(c.liked),
    }));
  }

  async function toggleSpotLike(spotId: number) {
    if (!auth.user) return;
    await spotsStore.toggleLike(spotId, auth.user.id);
  }

  async function toggleSpotCommentLike(commentId: number) {
    await spotsStore.toggleCommentLike(commentId);
  }

  async function submitSpotComment(spotId: number, content: string) {
    await spotsStore.submitComment(spotId, content);
  }

  async function removeSpotComment(id: number) {
    await spotsStore.removeComment(id);
  }

  async function updateSpotComment(id: number, content: string) {
    await spotsStore.updateComment(id, content);
  }

  function excursionLikesFor(ideaId: number) {
    return excursionLikes.value.filter((l) => l.idea_id === ideaId);
  }

  function excursionLikedByMe(ideaId: number) {
    return excursionLikesFor(ideaId).some((l) => l.user_id === auth.user?.id);
  }

  function excursionCommentsFor(ideaId: number) {
    return excursionComments.value
      .filter((c) => c.idea_id === ideaId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  function excursionCommentItemsFor(ideaId: number) {
    return excursionCommentsFor(ideaId).map((c) => ({
      id: c.id,
      avatar: author(c.author_id)?.avatar ?? '❓',
      username: author(c.author_id)?.username ?? '?',
      content: c.content,
      created_at: c.created_at,
      updated_at: c.updated_at,
      canRemove: c.author_id === auth.user?.id,
      canEdit: c.author_id === auth.user?.id,
      likeCount: c.like_count ?? 0,
      liked: Boolean(c.liked),
    }));
  }

  async function toggleExcursionLike(ideaId: number) {
    if (!auth.user) return;
    const result = await api.post<{ liked: boolean }>(`/ideas/${ideaId}/like`);
    if (result.liked) {
      excursionLikes.value.push({ id: Date.now(), idea_id: ideaId, user_id: auth.user.id });
    } else {
      excursionLikes.value = excursionLikes.value.filter(
        (l) => !(l.idea_id === ideaId && l.user_id === auth.user!.id)
      );
    }
  }

  async function toggleExcursionCommentLike(commentId: number) {
    const c = excursionComments.value.find((item) => item.id === commentId);
    if (c) {
      const wasLiked = Boolean(c.liked);
      c.liked = !wasLiked;
      c.like_count = Math.max(0, (c.like_count ?? 0) + (wasLiked ? -1 : 1));
    }
    try {
      const result = await api.post<{ liked: boolean; like_count: number }>(
        `/ideas/comments/${commentId}/like`
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

  async function submitExcursionComment(ideaId: number, content: string) {
    const created = await api.post<ExcursionComment>(`/ideas/${ideaId}/comments`, { content });
    excursionComments.value.push(created);
  }

  async function removeExcursionComment(id: number) {
    await api.delete(`/ideas/comments/${id}`);
    excursionComments.value = excursionComments.value.filter((c) => c.id !== id);
  }

  async function updateExcursionComment(id: number, content: string) {
    const updated = await api.put<ExcursionComment>(`/ideas/comments/${id}`, { content });
    const idx = excursionComments.value.findIndex((c) => c.id === id);
    if (idx !== -1) {
      excursionComments.value[idx] = updated;
    }
  }

  return {
    excursionLikes,
    excursionComments,
    creatorLabel,
    author,
    spotCommentItemsFor,
    toggleSpotLike,
    toggleSpotCommentLike,
    submitSpotComment,
    removeSpotComment,
    updateSpotComment,
    excursionLikesFor,
    excursionLikedByMe,
    excursionCommentsFor,
    excursionCommentItemsFor,
    toggleExcursionLike,
    toggleExcursionCommentLike,
    submitExcursionComment,
    removeExcursionComment,
    updateExcursionComment,
  };
}
