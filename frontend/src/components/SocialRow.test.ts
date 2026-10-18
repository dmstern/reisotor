import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SocialRow from './SocialRow.vue';

describe('SocialRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(props: {
    likeCount: number;
    liked: boolean;
    commentCount?: number;
    commentsOpen?: boolean;
    active?: boolean;
    showCommentsButton?: boolean;
    readonly?: boolean;
  }) {
    const app = createApp({
      render: () => h(SocialRow, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders outline comment icon when comments are closed', async () => {
    const html = await mountComponent({
      likeCount: 2,
      liked: false,
      commentCount: 3,
      commentsOpen: false,
    });
    expect(html).toContain('comment-btn');
    expect(html).toContain('tabler-icon-message-circle');
    expect(html).not.toContain('tabler-icon-message-circle-filled');
    expect(html).toContain('aria-label="Kommentare anzeigen"');
    expect(html).toContain('3');
  });

  it('renders filled comment icon and active class when comments are open', async () => {
    const html = await mountComponent({
      likeCount: 2,
      liked: false,
      commentCount: 3,
      commentsOpen: true,
    });
    expect(html).toContain('comment-btn');
    expect(html).toContain('active');
    expect(html).toContain('tabler-icon-message-circle-filled');
    expect(html).toContain('aria-label="Kommentare ausblenden"');
  });

  it('hides comment button when showCommentsButton is false', async () => {
    const html = await mountComponent({
      likeCount: 1,
      liked: true,
      showCommentsButton: false,
    });
    expect(html).not.toContain('comment-btn');
    expect(html).toContain('like-btn');
    expect(html).toContain('liked');
  });

  it('renders nothing in readonly mode when likeCount and commentCount are 0', async () => {
    const html = await mountComponent({
      likeCount: 0,
      liked: false,
      commentCount: 0,
      readonly: true,
    });
    expect(html).not.toContain('social-row');
    expect(html).not.toContain('<button');
  });

  it('renders static indicators without buttons in readonly mode when counts > 0', async () => {
    const html = await mountComponent({
      likeCount: 2,
      liked: true,
      commentCount: 1,
      readonly: true,
    });
    expect(html).toContain('is-readonly');
    expect(html).toContain('like-indicator');
    expect(html).toContain('comment-indicator');
    expect(html).not.toContain('<button');
  });
});
