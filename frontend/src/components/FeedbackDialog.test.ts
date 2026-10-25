// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import FeedbackDialog from './FeedbackDialog.vue';
import { api, ApiError } from '../api/client';
import { useBuildInfoStore } from '../stores/buildInfo';

describe('FeedbackDialog', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountDialog(props: {
    modelValue: boolean;
    initialTitle?: string;
    initialDescription?: string;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(FeedbackDialog, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders form and submits feedback', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      issue_number: 123,
      issue_url: 'https://github.com/dmstern/reisotor/issues/123',
    });

    const { cleanUp } = mountDialog({
      modelValue: true,
      initialTitle: 'Test Fehler',
      initialDescription: 'Beschreibung hier',
    });
    await nextTick();

    const form = document.body.querySelector('form');
    expect(form).toBeTruthy();

    form!.dispatchEvent(new Event('submit'));
    await nextTick();
    await nextTick();

    expect(postSpy).toHaveBeenCalledWith(
      '/feedback',
      expect.objectContaining({
        title: 'Test Fehler',
        description: 'Beschreibung hier',
        type: 'bug',
      })
    );
    expect(document.body.innerHTML).toContain('Issue #123');

    cleanUp();
  });

  it('displays rich text error and GitHub fallback button with prefilled URL on failure', async () => {
    const buildInfoStore = useBuildInfoStore();
    buildInfoStore.buildInfo = {
      version: '1.3.0',
      ref: null,
      builtAt: null,
      changelog: null,
      repoUrl: 'https://github.com/dmstern/reisotor',
      hostingLocation: 'Berlin',
      environment: 'production',
    };

    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(
        503,
        'Auf diesem Server ist kein GitHub-Zugang (GITHUB_TOKEN) eingerichtet. Bei selbstgehosteten Instanzen können Fehler direkt auf GitHub gemeldet werden: https://github.com/dmstern/reisotor/issues'
      )
    );

    const { cleanUp } = mountDialog({
      modelValue: true,
      initialTitle: 'Bug im Kalender',
      initialDescription: 'Details zum Bug',
    });
    await nextTick();

    const form = document.body.querySelector('form');
    form!.dispatchEvent(new Event('submit'));
    await nextTick();
    await nextTick();

    expect(document.body.innerHTML).toContain('GITHUB_TOKEN');
    expect(document.body.innerHTML).toContain('Als Issue auf GitHub öffnen');

    const fallbackBtn = document.body.querySelector(
      '.github-fallback-btn'
    ) as HTMLAnchorElement | null;
    expect(fallbackBtn).toBeTruthy();
    expect(fallbackBtn?.href).toContain('https://github.com/dmstern/reisotor/issues/new');
    expect(fallbackBtn?.href).toContain('Bug+im+Kalender');
    expect(fallbackBtn?.href).toContain('Details+zum+Bug');

    cleanUp();
  });

  it('renders "Auf GitHub öffnen" button with prefilled title, description and optional email', async () => {
    const buildInfoStore = useBuildInfoStore();
    buildInfoStore.buildInfo = {
      version: '1.3.0',
      ref: null,
      builtAt: null,
      changelog: null,
      repoUrl: 'https://github.com/dmstern/reisotor',
      hostingLocation: 'Berlin',
      environment: 'production',
    };

    const { cleanUp } = mountDialog({
      modelValue: true,
      initialTitle: 'Mein Feedback',
      initialDescription: 'Das ist mein Text',
    });
    await nextTick();

    const directBtn = document.body.querySelector('.btn-github-direct') as HTMLAnchorElement | null;
    expect(directBtn).toBeTruthy();
    expect(directBtn?.href).toContain('https://github.com/dmstern/reisotor/issues/new');
    expect(directBtn?.href).toContain('Mein+Feedback');
    expect(directBtn?.href).toContain('Das+ist+mein+Text');

    cleanUp();
  });
});
