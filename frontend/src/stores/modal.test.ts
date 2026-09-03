import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModalStore } from './modal';

describe('useModalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('assigns incremental z-index to sequentially opened modals', () => {
    const store = useModalStore();
    const z1 = store.register('modal-1');
    const z2 = store.register('modal-2');

    expect(z1).toBe(110);
    expect(z2).toBe(120);
    expect(store.getZIndex('modal-1')).toBe(110);
    expect(store.getZIndex('modal-2')).toBe(120);
    expect(store.isTop('modal-1')).toBe(false);
    expect(store.isTop('modal-2')).toBe(true);
  });

  it('unregisters modals and identifies the new top modal', () => {
    const store = useModalStore();
    store.register('modal-1');
    store.register('modal-2');

    store.unregister('modal-2');
    expect(store.isTop('modal-1')).toBe(true);
    expect(store.getZIndex('modal-1')).toBe(110);

    store.unregister('modal-1');
    expect(store.activeStack).toHaveLength(0);

    // After all modals closed, next modal starts afresh
    const z3 = store.register('modal-3');
    expect(z3).toBe(110);
  });
});
