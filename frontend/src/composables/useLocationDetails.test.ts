// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useLocationDetails } from './useLocationDetails';

describe('useLocationDetails', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('determines visibility based on props and state', () => {
    // Mode 1: TripForm mode (title is undefined) -> initially hidden
    const modelValue = ref<{ lat: number; lng: number } | null>(null);
    const title = ref<string | undefined>(undefined);
    const address = ref<string | undefined>('');

    const details = useLocationDetails({ modelValue, title, address });
    expect(details.isDetailsVisible.value).toBe(false);

    // Open manual details
    details.openManualDetails();
    expect(details.isDetailsVisible.value).toBe(true);

    // Close manual details
    details.closeManualDetails();
    expect(details.isDetailsVisible.value).toBe(false);

    // If modelValue becomes set, card is visible unless explicitly closed
    details.cardClosed.value = false;
    modelValue.value = { lat: 48.2, lng: 16.37 };
    expect(details.hasLocation.value).toBe(true);
    expect(details.isDetailsVisible.value).toBe(true);

    // Mode 2: SpotFormModal mode (title is defined, e.g. empty string) -> immediately visible
    const spotTitle = ref<string | undefined>('');
    const spotDetails = useLocationDetails({ modelValue: ref(null), title: spotTitle });
    expect(spotDetails.isDetailsVisible.value).toBe(true);

    // Mode 3: Trip context (context is 'trip') -> immediately visible even without title/location
    const tripDetails = useLocationDetails({
      modelValue: ref(null),
      context: ref('trip'),
    });
    expect(tripDetails.isDetailsVisible.value).toBe(true);
  });

  it('handles inline title edit lifecycle', () => {
    const modelValue = ref(null);
    const title = ref('Initialer Spot');
    const onUpdateTitle = vi.fn();

    const details = useLocationDetails({ modelValue, title, onUpdateTitle });

    expect(details.isEditingTitle.value).toBe(true);
    expect(details.editTitleInput.value).toBe('Initialer Spot');

    details.startEditTitle();
    expect(details.isEditingTitle.value).toBe(true);

    details.editTitleInput.value = 'Neuer Spot';
    details.onTitleInput();
    expect(onUpdateTitle).toHaveBeenCalledWith('Neuer Spot');

    details.saveTitle();
    expect(onUpdateTitle).toHaveBeenCalledWith('Neuer Spot');
    expect(details.isEditingTitle.value).toBe(true);
  });

  it('handles inline address edit lifecycle and cancel', () => {
    const modelValue = ref(null);
    const address = ref('Hauptstraße 1');
    const onUpdateAddress = vi.fn();

    const details = useLocationDetails({ modelValue, address, onUpdateAddress });

    expect(details.isEditingAddress.value).toBe(true);
    details.editAddressInput.value = 'Nebenstraße 2';
    details.cancelAddress();
    expect(details.editAddressInput.value).toBe('Hauptstraße 1');
  });

  it('handles reverse geocoding', async () => {
    const modelValue = ref(null);
    const onUpdateAddress = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ formatted_address: 'Kärntner Straße 5, Wien' }),
    } as unknown as Response);

    const details = useLocationDetails({ modelValue, onUpdateAddress });
    await details.reverseGeocodeCoords(48.208, 16.372);

    expect(details.editAddressInput.value).toBe('Kärntner Straße 5, Wien');
    expect(onUpdateAddress).toHaveBeenCalledWith('Kärntner Straße 5, Wien');
  });

  it('resets details state cleanly', () => {
    const modelValue = ref(null);
    const details = useLocationDetails({ modelValue });

    details.isEditingTitle.value = true;
    details.manualDetailsOpen.value = true;
    details.cardClosed.value = true;

    details.resetDetailsState();

    expect(details.isEditingTitle.value).toBe(true);
    expect(details.manualDetailsOpen.value).toBe(false);
    expect(details.cardClosed.value).toBe(false);
  });
});
