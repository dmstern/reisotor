// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia } from 'pinia';
import CoverImagePicker from './CoverImagePicker.vue';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function mountComponent(props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(CoverImagePicker, props),
  });
  app.use(pinia);
  app.mount(container);
  return {
    app,
    container,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('CoverImagePicker component', () => {
  it('renders placeholder when no image is set and button says "Bild hinzufügen"', () => {
    const { container, cleanUp } = mountComponent({
      modelValue: '',
      previewImage: null,
    });

    const btn = container.querySelector('.banner-edit-btn');
    expect(btn?.textContent).toContain('Bild hinzufügen');
    expect(container.querySelector('.placeholder')).not.toBeNull();

    cleanUp();
  });

  it('renders background style and button says "Bild bearbeiten" when modelValue is present', () => {
    const { container, cleanUp } = mountComponent({
      modelValue: 'https://example.com/banner.jpg',
    });

    const btn = container.querySelector('.banner-edit-btn');
    expect(btn?.textContent).toContain('Bild bearbeiten');
    const banner = container.querySelector('.form-image-banner') as HTMLElement;
    expect(banner.style.backgroundImage).toContain('https://example.com/banner.jpg');

    cleanUp();
  });

  it('opens modal on edit button click and shows delete and done buttons', async () => {
    const { container, cleanUp } = mountComponent({
      modelValue: 'https://example.com/banner.jpg',
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const deleteBtn = document.querySelector(
      '.image-submodal button.btn--danger'
    ) as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn.textContent).toContain('Bild entfernen');
    expect(deleteBtn.disabled).toBe(false);

    const doneButtons = Array.from(
      document.querySelectorAll('.image-submodal button')
    ) as HTMLButtonElement[];
    const doneBtn = doneButtons.find((b) => b.textContent?.includes('Fertig'));
    expect(doneBtn).toBeDefined();
    expect(doneBtn?.disabled).toBe(false);

    cleanUp();
  });

  it('disables delete and done buttons when an upload is in progress', async () => {
    const onUpdateUploading = vi.fn();
    const { container, cleanUp } = mountComponent({
      modelValue: 'https://example.com/banner.jpg',
      'onUpdate:uploading': onUpdateUploading,
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const fileInput = document.querySelector(
      '.image-submodal input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const testFile = new File(['content'], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change'));
    await nextTick();

    expect(onUpdateUploading).toHaveBeenCalledWith(true);

    const deleteBtn = document.querySelector(
      '.image-submodal button.btn--danger'
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);

    const doneButtons = Array.from(
      document.querySelectorAll('.image-submodal button')
    ) as HTMLButtonElement[];
    const doneBtn = doneButtons.find((b) => b.textContent?.includes('Fertig'));
    expect(doneBtn?.disabled).toBe(true);

    cleanUp();
  });

  it('browses through initialSuggestions with next and prev buttons', async () => {
    const onUpdateModelValue = vi.fn();
    const suggestions = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg',
    ];
    const { container, cleanUp } = mountComponent({
      modelValue: suggestions[0],
      initialSuggestions: suggestions,
      'onUpdate:modelValue': onUpdateModelValue,
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const browseBar = document.querySelector('.suggestion-browse-bar');
    expect(browseBar).not.toBeNull();
    expect(document.querySelector('.browse-counter')?.textContent).toContain('Vorschlag 1 von 3');

    // Prev button should be disabled at first item
    const prevBtn = document.querySelector(
      '.browse-buttons button[title*="vorherigen"]'
    ) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    const nextBtn = document.querySelector(
      '.browse-buttons button[title*="Nächstes Bild"]'
    ) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);

    // Click next -> advances to suggestion 2
    nextBtn.click();
    await nextTick();
    expect(onUpdateModelValue).toHaveBeenCalledWith(suggestions[1]);

    cleanUp();
  });

  it('displays modified state and allows resetting image via reset button', async () => {
    const onUpdateModelValue = vi.fn();
    const { container, cleanUp } = mountComponent({
      modelValue: 'https://example.com/new.jpg',
      initialValue: 'https://example.com/original.jpg',
      'onUpdate:modelValue': onUpdateModelValue,
    });

    // Banner should be marked modified
    const banner = container.querySelector('.form-image-banner');
    expect(banner?.classList.contains('is-modified')).toBe(true);
    expect(banner?.querySelector('.banner-badge-modified')?.textContent).toContain('Bild geändert');

    // Banner reset button
    const bannerResetBtn = banner?.querySelector('.banner-reset-btn') as HTMLButtonElement;
    expect(bannerResetBtn).not.toBeNull();
    bannerResetBtn.click();
    expect(onUpdateModelValue).toHaveBeenCalledWith('https://example.com/original.jpg');

    // Open modal
    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    // Dialog should have preview badge and modal reset button
    expect(document.querySelector('.dialog-preview-badge')?.textContent).toContain('Bild geändert');
    const modalResetBtn = Array.from(document.querySelectorAll('.image-submodal button')).find(
      (b) => b.textContent?.includes('Änderungen zurücksetzen')
    ) as HTMLButtonElement;
    expect(modalResetBtn).toBeDefined();

    modalResetBtn.click();
    expect(onUpdateModelValue).toHaveBeenCalledWith('https://example.com/original.jpg');

    cleanUp();
  });

  it('fetches suggestions from API when searchContext is provided', async () => {
    const onUpdateModelValue = vi.fn();
    vi.mocked(api.get).mockResolvedValueOnce({
      name: 'Eiffel Tower',
      imageUrl: 'https://example.com/eiffel1.jpg',
      images: ['https://example.com/eiffel1.jpg', 'https://example.com/eiffel2.jpg'],
    });

    const { container, cleanUp } = mountComponent({
      modelValue: '',
      searchContext: { name: 'Eiffel Tower' },
      'onUpdate:modelValue': onUpdateModelValue,
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const nextBtn = document.querySelector(
      '.browse-buttons button[title*="Nächstes Bild"]'
    ) as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();

    await nextBtn.click();
    await nextTick();

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/spots/preview?name=Eiffel+Tower')
    );
    expect(onUpdateModelValue).toHaveBeenCalledWith('https://example.com/eiffel1.jpg');

    cleanUp();
  });

  it('pre-fills search input with searchContext name and allows executing custom search', async () => {
    const onUpdateModelValue = vi.fn();
    vi.mocked(api.get).mockResolvedValueOnce({
      name: 'Louvre',
      imageUrl: 'https://example.com/louvre1.jpg',
      images: ['https://example.com/louvre1.jpg', 'https://example.com/louvre2.jpg'],
    });

    const { container, cleanUp } = mountComponent({
      modelValue: '',
      searchContext: { name: 'Eiffel Tower', city: 'Paris' },
      'onUpdate:modelValue': onUpdateModelValue,
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const searchInput = document.querySelector('.browse-search-input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    expect(searchInput.value).toBe('Eiffel Tower');

    searchInput.value = 'Louvre';
    searchInput.dispatchEvent(new Event('input'));
    await nextTick();

    const searchBtn = Array.from(document.querySelectorAll('.browse-search-row button')).find((b) =>
      b.textContent?.includes('Suchen')
    ) as HTMLButtonElement;
    expect(searchBtn).toBeDefined();

    searchBtn.click();
    await nextTick();
    await nextTick();

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/spots/preview?name=Louvre&city=Paris')
    );
    expect(onUpdateModelValue).toHaveBeenCalledWith('https://example.com/louvre1.jpg');
    expect(document.querySelector('.browse-counter')?.textContent).toContain('Vorschlag 1 von 2');

    cleanUp();
  });

  it('triggers custom search when search query changed and user clicks next suggestion', async () => {
    const onUpdateModelValue = vi.fn();
    vi.mocked(api.get).mockResolvedValueOnce({
      name: 'Arc de Triomphe',
      imageUrl: 'https://example.com/arc1.jpg',
      images: ['https://example.com/arc1.jpg'],
    });

    const { container, cleanUp } = mountComponent({
      modelValue: '',
      searchContext: { name: 'Eiffel Tower' },
      'onUpdate:modelValue': onUpdateModelValue,
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const searchInput = document.querySelector('.browse-search-input') as HTMLInputElement;
    searchInput.value = 'Arc de Triomphe';
    searchInput.dispatchEvent(new Event('input'));
    await nextTick();

    const nextBtn = document.querySelector(
      '.browse-buttons button[title*="Nächstes Bild"]'
    ) as HTMLButtonElement;
    await nextBtn.click();
    await nextTick();
    await nextTick();

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/spots/preview?name=Arc+de+Triomphe')
    );
    expect(onUpdateModelValue).toHaveBeenCalledWith('https://example.com/arc1.jpg');

    cleanUp();
  });

  it('displays message when search finds no images', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      name: 'UnbekannterOrtXYZ',
      imageUrl: null,
      images: [],
    });

    const { container, cleanUp } = mountComponent({
      modelValue: 'https://example.com/existing.jpg',
      searchContext: { name: 'Eiffel' },
    });

    const editBtn = container.querySelector('.banner-edit-btn') as HTMLButtonElement;
    editBtn.click();
    await nextTick();

    const searchInput = document.querySelector('.browse-search-input') as HTMLInputElement;
    searchInput.value = 'UnbekannterOrtXYZ';
    searchInput.dispatchEvent(new Event('input'));
    await nextTick();

    const searchBtn = Array.from(document.querySelectorAll('.browse-search-row button')).find((b) =>
      b.textContent?.includes('Suchen')
    ) as HTMLButtonElement;
    await searchBtn.click();
    await nextTick();
    await nextTick();

    const msg = document.querySelector('.browse-msg');
    expect(msg?.textContent).toContain('Keine Bilder für „UnbekannterOrtXYZ“ gefunden.');

    cleanUp();
  });
});
