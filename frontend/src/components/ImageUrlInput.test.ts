// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import ImageUrlInput from './ImageUrlInput.vue';
import { api } from '../api/client';
import * as imageCompression from '../utils/imageCompression';

vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock('../utils/imageCompression', () => ({
  compressImage: vi.fn(),
}));

function mountComponent(props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  let capturedComponent: InstanceType<typeof ImageUrlInput> | null = null;
  const app = createApp({
    render: () =>
      h(ImageUrlInput as unknown as Component, {
        ...props,
        ref: (el: unknown) => {
          capturedComponent = el as InstanceType<typeof ImageUrlInput>;
        },
      }),
  });
  app.use(pinia);
  app.mount(container);
  return {
    app,
    container,
    get instance() {
      return capturedComponent;
    },
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('ImageUrlInput component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input field and upload trigger', () => {
    const { container, cleanUp } = mountComponent({
      modelValue: 'https://example.com/photo.jpg',
      placeholder: 'Test-Placeholder',
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('https://example.com/photo.jpg');
    expect(input.placeholder).toBe('Test-Placeholder');

    const fileLabel = container.querySelector('.upload-label');
    expect(fileLabel).not.toBeNull();
    expect(fileLabel?.textContent).toContain('Oder Bild hochladen');

    cleanUp();
  });

  it('emits update:modelValue when typing into the text input', async () => {
    const onUpdate = vi.fn();
    const { container, cleanUp } = mountComponent({
      modelValue: '',
      'onUpdate:modelValue': onUpdate,
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'https://example.com/new.png';
    input.dispatchEvent(new Event('input'));
    await nextTick();

    expect(onUpdate).toHaveBeenCalledWith('https://example.com/new.png');
    cleanUp();
  });

  it('shows UploadProgressBar during upload and completes successfully', async () => {
    let resolveCompress: (val: string) => void;
    const compressPromise = new Promise<string>((resolve) => {
      resolveCompress = resolve;
    });
    vi.mocked(imageCompression.compressImage).mockReturnValue(compressPromise);

    let resolveApi: (val: { url: string }) => void;
    const apiPromise = new Promise<{ url: string }>((resolve) => {
      resolveApi = resolve;
    });
    vi.mocked(api.post).mockReturnValue(apiPromise as unknown as ReturnType<typeof api.post>);

    const onUpdateModelValue = vi.fn();
    const onUpdateUploading = vi.fn();

    const { container, cleanUp } = mountComponent({
      modelValue: '',
      'onUpdate:modelValue': onUpdateModelValue,
      'onUpdate:uploading': onUpdateUploading,
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['dummy content'], 'vacation.jpg', { type: 'image/jpeg' });

    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change'));
    await nextTick();

    expect(onUpdateUploading).toHaveBeenCalledWith(true);

    const progressBar = container.querySelector('.upload-progress-container');
    expect(progressBar).not.toBeNull();
    expect(container.textContent).toContain('vacation.jpg');

    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(textInput.disabled).toBe(true);

    resolveCompress!('data:image/jpeg;base64,abc');
    await nextTick();

    resolveApi!({ url: '/api/uploads/uuid.jpg' });
    await Promise.resolve();
    await nextTick();

    expect(onUpdateModelValue).toHaveBeenCalledWith('/api/uploads/uuid.jpg');
    expect(onUpdateUploading).toHaveBeenCalledWith(false);
    expect(container.querySelector('.upload-progress-container')).toBeNull();

    cleanUp();
  });

  it('allows aborting an ongoing upload via cancel', async () => {
    const compressPromise = new Promise<string>(() => {});
    vi.mocked(imageCompression.compressImage).mockReturnValue(compressPromise);

    const onUpdateUploading = vi.fn();
    const { container, cleanUp } = mountComponent({
      modelValue: '',
      'onUpdate:uploading': onUpdateUploading,
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['dummy content'], 'summer.jpg', { type: 'image/jpeg' });

    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change'));
    await nextTick();

    expect(container.querySelector('.upload-progress-container')).not.toBeNull();

    const cancelButton = container.querySelector('.upload-header button') as HTMLButtonElement;
    expect(cancelButton).not.toBeNull();
    expect(cancelButton.textContent).toContain('Abbrechen');

    cancelButton.click();
    await nextTick();

    expect(onUpdateUploading).toHaveBeenCalledWith(false);
    expect(container.querySelector('.upload-progress-container')).toBeNull();
    expect(container.querySelector('.hint.error')).toBeNull();

    cleanUp();
  });

  it('displays error message when upload fails', async () => {
    vi.mocked(imageCompression.compressImage).mockRejectedValue(new Error('Compression error'));

    const onUpdateUploading = vi.fn();
    const { container, cleanUp } = mountComponent({
      modelValue: '',
      'onUpdate:uploading': onUpdateUploading,
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['dummy content'], 'broken.jpg', { type: 'image/jpeg' });

    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change'));
    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(onUpdateUploading).toHaveBeenCalledWith(false);
    const errorEl = container.querySelector('.hint.error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Bild-Upload fehlgeschlagen');

    cleanUp();
  });
});
