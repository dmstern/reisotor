import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useConnectivityStore } from './connectivity';

const mockFlushOutbox = vi.fn();
const mockGetOutboxLength = vi.fn();
const mockSetConfirmedOffline = vi.fn();
const mockIsConfirmedOffline = vi.fn();
const mockFetchWithTimeout = vi.fn();
const mockRefreshAll = vi.fn();

vi.mock('../api/offline', () => ({
  flushOutbox: (...args: unknown[]) => mockFlushOutbox(...args),
  getOutboxLength: () => mockGetOutboxLength(),
  setConfirmedOffline: (...args: unknown[]) => mockSetConfirmedOffline(...args),
  isConfirmedOffline: () => mockIsConfirmedOffline(),
}));

vi.mock('../api/client', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
  rawRequest: vi.fn(),
}));

vi.mock('./liveSync', () => ({
  useLiveSyncStore: () => ({
    refreshAll: mockRefreshAll,
  }),
}));

describe('useConnectivityStore', () => {
  let eventTarget: EventTarget;
  let store: ReturnType<typeof useConnectivityStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGetOutboxLength.mockReturnValue(0);
    mockIsConfirmedOffline.mockReturnValue(false);
    mockFlushOutbox.mockResolvedValue(true);
    mockFetchWithTimeout.mockResolvedValue(new Response('ok'));

    eventTarget = new EventTarget();
    vi.stubGlobal('window', {
      addEventListener: (t: string, l: EventListener) => eventTarget.addEventListener(t, l),
      removeEventListener: (t: string, l: EventListener) => eventTarget.removeEventListener(t, l),
      dispatchEvent: (e: Event) => eventTarget.dispatchEvent(e),
    });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    store?.destroyListeners();
  });

  it('initializes with pendingCount and isOnline', () => {
    mockGetOutboxLength.mockReturnValue(3);
    store = useConnectivityStore();
    expect(store.pendingCount).toBe(3);
    expect(store.isOnline).toBe(true);
  });

  it('updates pendingCount and triggers trySync when reisotor:outbox-changed fires while online', async () => {
    mockGetOutboxLength.mockReturnValue(0);
    store = useConnectivityStore();
    expect(store.pendingCount).toBe(0);

    // Simulate mutation added to outbox
    mockGetOutboxLength.mockReturnValue(2);
    window.dispatchEvent(new Event('reisotor:outbox-changed'));

    // Wait microtasks
    await Promise.resolve();

    expect(store.pendingCount).toBe(2);
    expect(mockFlushOutbox).toHaveBeenCalled();
  });

  it('trySync calls flushOutbox and triggers liveSync.refreshAll if drained', async () => {
    mockGetOutboxLength.mockReturnValue(1);
    store = useConnectivityStore();

    mockFlushOutbox.mockImplementation(async () => {
      mockGetOutboxLength.mockReturnValue(0);
      return true;
    });

    await store.trySync();

    expect(mockFlushOutbox).toHaveBeenCalled();
    expect(mockRefreshAll).toHaveBeenCalled();
    expect(store.pendingCount).toBe(0);
  });

  it('syncNow executes trySync when already online', async () => {
    mockGetOutboxLength.mockReturnValue(1);
    store = useConnectivityStore();
    mockFetchWithTimeout.mockClear();
    mockFlushOutbox.mockClear();

    await store.syncNow();

    expect(mockFlushOutbox).toHaveBeenCalled();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('syncNow checks connectivity first when offline and then syncs upon success', async () => {
    mockGetOutboxLength.mockReturnValue(1);
    vi.stubGlobal('navigator', { onLine: false });
    mockIsConfirmedOffline.mockReturnValue(true);

    store = useConnectivityStore();
    expect(store.isOnline).toBe(false);

    await store.syncNow();

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' });
    expect(store.isOnline).toBe(true);
    expect(mockFlushOutbox).toHaveBeenCalled();
  });
});
