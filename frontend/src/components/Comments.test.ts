// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import Comments, { type CommentItem } from './Comments.vue';

describe('Comments', () => {
  let pinia: Pinia;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountComments(
    props: { comments: CommentItem[] },
    listeners: Record<string, unknown> = {}
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(Comments, { ...props, ...listeners }),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders comment with username, content, and formatted creation date', () => {
    const comments: CommentItem[] = [
      {
        id: 1,
        avatar: '👩',
        username: 'Alice',
        content: 'Schöner Ausblick!',
        created_at: '2026-06-01T14:30:00Z',
        canRemove: false,
      },
    ];

    const { container, cleanUp } = mountComments({ comments });
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Schöner Ausblick!');
    expect(container.querySelector('.comment-date')).not.toBeNull();
    expect(container.querySelector('.comment-edited')).toBeNull();
    cleanUp();
  });

  it('shows (bearbeitet) when updated_at is present', () => {
    const comments: CommentItem[] = [
      {
        id: 2,
        avatar: '👨',
        username: 'Bob',
        content: 'Toller Spot',
        created_at: '2026-06-01T14:30:00Z',
        updated_at: '2026-06-01T15:00:00Z',
        canRemove: false,
      },
    ];

    const { container, cleanUp } = mountComments({ comments });
    const edited = container.querySelector('.comment-edited');
    expect(edited).not.toBeNull();
    expect(edited?.textContent).toBe('(bearbeitet)');
    cleanUp();
  });

  it('shows edit and delete buttons for own comments and supports editing', async () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const comments: CommentItem[] = [
      {
        id: 3,
        avatar: '👩',
        username: 'Alice',
        content: 'Ursprünglicher Text',
        created_at: '2026-06-01T14:30:00Z',
        canRemove: true,
        canEdit: true,
      },
    ];

    const { container, cleanUp } = mountComments({ comments }, { onUpdate, onRemove });

    const editBtn = container.querySelector('.edit-btn') as HTMLButtonElement | null;
    const deleteBtn = container.querySelector('.delete-btn') as HTMLButtonElement | null;
    expect(editBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    // Click edit button
    editBtn?.click();
    await nextTick();

    // Inline edit form should appear
    const editForm = container.querySelector('.comment-edit-form');
    expect(editForm).not.toBeNull();
    const input = editForm?.querySelector('input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.value).toBe('Ursprünglicher Text');

    // Change input value
    if (input) {
      input.value = 'Neuer Text';
      input.dispatchEvent(new Event('input'));
    }
    await nextTick();

    // Submit edit form
    editForm?.dispatchEvent(new Event('submit'));
    await nextTick();

    expect(onUpdate).toHaveBeenCalledWith(3, 'Neuer Text');
    cleanUp();
  });

  it('does not render edit/delete buttons when user cannot edit or remove', () => {
    const comments: CommentItem[] = [
      {
        id: 4,
        avatar: '👨',
        username: 'Bob',
        content: 'Fremder Kommentar',
        created_at: '2026-06-01T14:30:00Z',
        canRemove: false,
        canEdit: false,
      },
    ];

    const { container, cleanUp } = mountComments({ comments });
    expect(container.querySelector('.edit-btn')).toBeNull();
    expect(container.querySelector('.delete-btn')).toBeNull();
    cleanUp();
  });

  it('renders like button and emits toggle-like event when clicked', async () => {
    const onToggleLike = vi.fn();
    const comments: CommentItem[] = [
      {
        id: 5,
        avatar: '👩',
        username: 'Alice',
        content: 'Toller Kommentar',
        created_at: '2026-06-01T14:30:00Z',
        canRemove: false,
        likeCount: 3,
        liked: true,
      },
    ];

    const { container, cleanUp } = mountComments({ comments }, { onToggleLike });
    const likeBtn = container.querySelector('.like-btn') as HTMLButtonElement | null;
    expect(likeBtn).not.toBeNull();
    expect(likeBtn?.classList.contains('liked')).toBe(true);
    expect(container.querySelector('.social-count')?.textContent).toBe('3');

    likeBtn?.click();
    await nextTick();
    expect(onToggleLike).toHaveBeenCalledWith(5);
    cleanUp();
  });
});
