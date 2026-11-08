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
    return users.value.find((user) => user.id === id);
  }

  function likesFor(entryId: number) {
    return likes.value.filter((like) => like.entry_id === entryId);
  }

  function likedByMe(entryId: number) {
    return likesFor(entryId).some((like) => like.user_id === auth.user?.id);
  }

  function commentsFor(entryId: number) {
    return comments.value
      .filter((comment) => comment.entry_id === entryId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  function commentItemsFor(entryId: number) {
    return commentsFor(entryId).map((comment) => ({
      id: comment.id,
      avatar: comment.author_avatar ?? author(comment.author_id)?.avatar ?? '❓',
      username: comment.author_username ?? author(comment.author_id)?.username ?? '?',
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      canRemove: comment.author_id === auth.user?.id,
      canEdit: comment.author_id === auth.user?.id,
      likeCount: comment.like_count ?? 0,
      liked: Boolean(comment.liked),
    }));
  }

  async function toggleLike(entryId: number) {
    if (!auth.user) {
      return;
    }

    const result = await api.post<{ liked: boolean }>(`/diary/${entryId}/like`);

    if (result.liked) {
      likes.value.push({ id: Date.now(), entry_id: entryId, user_id: auth.user.id });
    } else {
      likes.value = likes.value.filter(
        (like) => !(like.entry_id === entryId && like.user_id === auth.user!.id)
      );
    }
  }

  function toggleComments(entryId: number) {
    if (openComments.value.has(entryId)) {
      openComments.value.delete(entryId);
    } else {
      openComments.value.add(entryId);
    }
  }

  async function submitComment(entryId: number, content: string) {
    const created = await api.post<DiaryComment>(`/diary/${entryId}/comments`, { content });
    comments.value.push(created);
  }

  async function removeComment(id: number) {
    await api.delete(`/diary/comments/${id}`);
    comments.value = comments.value.filter((comment) => comment.id !== id);
  }

  async function updateComment(id: number, content: string) {
    const updated = await api.put<DiaryComment>(`/diary/comments/${id}`, { content });
    const idx = comments.value.findIndex((comment) => comment.id === id);

    if (idx !== -1) {
      comments.value[idx] = updated;
    }
  }

  async function toggleCommentLike(commentId: number) {
    const targetComment = comments.value.find((item) => item.id === commentId);

    if (targetComment) {
      const wasLiked = Boolean(targetComment.liked);
      targetComment.liked = !wasLiked;
      targetComment.like_count = Math.max(0, (targetComment.like_count ?? 0) + (wasLiked ? -1 : 1));
    }

    try {
      const result = await api.post<{ liked: boolean; like_count: number }>(
        `/diary/comments/${commentId}/like`
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
