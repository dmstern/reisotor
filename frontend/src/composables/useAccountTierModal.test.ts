// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountTierModal } from './useAccountTierModal';

describe('useAccountTierModal', () => {
  const { isOpen, highlightedFeature, openAccountTierModal, closeAccountTierModal } =
    useAccountTierModal();

  beforeEach(() => {
    closeAccountTierModal();
  });

  it('starts closed with no highlighted feature', () => {
    expect(isOpen.value).toBe(false);
    expect(highlightedFeature.value).toBeNull();
  });

  it('opens modal with optional feature', () => {
    openAccountTierModal('uploads');
    expect(isOpen.value).toBe(true);
    expect(highlightedFeature.value).toBe('uploads');
  });

  it('opens modal without feature', () => {
    openAccountTierModal();
    expect(isOpen.value).toBe(true);
    expect(highlightedFeature.value).toBeNull();
  });

  it('closes modal and clears highlighted feature', () => {
    openAccountTierModal('trips');
    closeAccountTierModal();
    expect(isOpen.value).toBe(false);
    expect(highlightedFeature.value).toBeNull();
  });
});
