// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia } from 'pinia';
import CoverImagePicker from './CoverImagePicker.vue';

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
});
