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
    if (userId == null) {
      return null;
    }

    const user = users.value.find((item) => item.id === userId);
    return user ? `${user.avatar} ${user.username}` : null;
  }

  function author(id: number) {
    return users.value.find((user) => user.id === id);
  }

  function spotCommentItemsFor(spotId: number) {
    return spotsStore.commentsFor(spotId).map((comment) => ({
      id: comment.id,
      avatar: author(comment.author_id)?.avatar ?? '❓',
      username: author(comment.author_id)?.username ?? '?',
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      canRemove: comment.author_id === auth.user?.id,
      canEdit: comment.author_id === auth.user?.id,
      likeCount: comment.like_count ?? 0,
      liked: Boolean(comment.liked),
    }));
  }

  async function toggleSpotLike(spotId: number) {
    if (!auth.user) {
      return;
    }

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
    return excursionLikes.value.filter((like) => like.idea_id === ideaId);
  }

  function excursionLikedByMe(ideaId: number) {
    return excursionLikesFor(ideaId).some((like) => like.user_id === auth.user?.id);
  }

  function excursionCommentsFor(ideaId: number) {
    return excursionComments.value
      .filter((comment) => comment.idea_id === ideaId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  function excursionCommentItemsFor(ideaId: number) {
    return excursionCommentsFor(ideaId).map((comment) => ({
      id: comment.id,
      avatar: author(comment.author_id)?.avatar ?? '❓',
      username: author(comment.author_id)?.username ?? '?',
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      canRemove: comment.author_id === auth.user?.id,
      canEdit: comment.author_id === auth.user?.id,
      likeCount: comment.like_count ?? 0,
      liked: Boolean(comment.liked),
    }));
  }

  async function toggleExcursionLike(ideaId: number) {
    if (!auth.user) {
      return;
    }

    const result = await api.post<{ liked: boolean }>(`/ideas/${ideaId}/like`);

    if (result.liked) {
      excursionLikes.value.push({ id: Date.now(), idea_id: ideaId, user_id: auth.user.id });
    } else {
      excursionLikes.value = excursionLikes.value.filter(
        (like) => !(like.idea_id === ideaId && like.user_id === auth.user!.id)
      );
    }
  }

  async function toggleExcursionCommentLike(commentId: number) {
    const targetComment = excursionComments.value.find((item) => item.id === commentId);

    if (targetComment) {
      const wasLiked = Boolean(targetComment.liked);
      targetComment.liked = !wasLiked;
      targetComment.like_count = Math.max(0, (targetComment.like_count ?? 0) + (wasLiked ? -1 : 1));
    }

    try {
      const result = await api.post<{ liked: boolean; like_count: number }>(
        `/ideas/comments/${commentId}/like`
      );

      if (targetComment) {
        targetComment.liked = result.liked;
        targetComment.like_count = result.like_count;
      }
    } catch (err) {
      if (targetComment) {
        const wasLiked = Boolean(targetComment.liked);
        targetComment.liked = !wasLiked;
        targetComment.like_count = Math.max(
          0,
          (targetComment.like_count ?? 0) + (wasLiked ? -1 : 1)
        );
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
    excursionComments.value = excursionComments.value.filter((comment) => comment.id !== id);
  }

  async function updateExcursionComment(id: number, content: string) {
    const updated = await api.put<ExcursionComment>(`/ideas/comments/${id}`, { content });
    const idx = excursionComments.value.findIndex((comment) => comment.id === id);

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
