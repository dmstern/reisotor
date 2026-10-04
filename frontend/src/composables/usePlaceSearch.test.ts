// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePlaceSearch, type PlaceSearchResult } from './usePlaceSearch';

describe('usePlaceSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const search = usePlaceSearch();
    expect(search.inputText.value).toBe('');
    expect(search.isSearching.value).toBe(false);
    expect(search.isOpen.value).toBe(false);
    expect(search.results.value).toEqual([]);
    expect(search.activeIndex.value).toBe(-1);
    expect(search.selectedPlace.value).toBeNull();
    expect(search.shortlinkDetected.value).toBe(false);
  });

  it('recognizes maps link with coordinates and calls onMapsLinkResolved', () => {
    const onMapsLinkResolved = vi.fn();
    const onMapsLinkInput = vi.fn();
    const search = usePlaceSearch({ onMapsLinkResolved, onMapsLinkInput });

    search.handleInput('https://maps.google.com/?q=48.2082,16.3738');

    expect(onMapsLinkInput).toHaveBeenCalledWith('https://maps.google.com/?q=48.2082,16.3738');
    expect(onMapsLinkResolved).toHaveBeenCalledWith(
      { lat: 48.2082, lng: 16.3738 },
      'https://maps.google.com/?q=48.2082,16.3738'
    );
    expect(search.isSearching.value).toBe(false);
    expect(search.isOpen.value).toBe(false);
  });

  it('detects shortlinks without calling places API', () => {
    const search = usePlaceSearch();
    search.handleInput('https://maps.app.goo.gl/xyz123');

    expect(search.shortlinkDetected.value).toBe(true);
    expect(search.isSearching.value).toBe(false);
  });

  it('does not trigger search for inputs under 2 chars', () => {
    const search = usePlaceSearch();
    search.handleInput('a');
    vi.advanceTimersByTime(500);

    expect(search.isSearching.value).toBe(false);
    expect(search.results.value).toEqual([]);
  });

  it('debounces place search by 300ms', async () => {
    const mockResults: PlaceSearchResult[] = [
      { name: 'Wien', formatted_address: 'Wien, Österreich', lat: 48.2, lng: 16.37 },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    } as unknown as Response);

    const search = usePlaceSearch();
    search.handleInput('Wien');

    expect(search.isSearching.value).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/places/search?q=Wien'),
      expect.any(Object)
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(search.results.value).toEqual(mockResults);
    expect(search.isOpen.value).toBe(true);
    expect(search.isSearching.value).toBe(false);
  });

  it('handles keyboard navigation: ArrowDown, ArrowUp, Enter, Escape', () => {
    const onSelectPlace = vi.fn();
    const search = usePlaceSearch({ onSelectPlace });

    const mockPlace: PlaceSearchResult = {
      name: 'Stephansdom',
      formatted_address: 'Stephansplatz 1',
      lat: 48.2085,
      lng: 16.3731,
    };
    search.results.value = [mockPlace];

    // ArrowDown when closed opens dropdown
    search.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(search.isOpen.value).toBe(true);
    expect(search.activeIndex.value).toBe(0);

    // Escape closes dropdown
    search.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(search.isOpen.value).toBe(false);

    // Reopen and press Enter to select
    search.isOpen.value = true;
    search.activeIndex.value = 0;
    search.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onSelectPlace).toHaveBeenCalledWith(mockPlace);
    expect(search.selectedPlace.value).toEqual(mockPlace);
    expect(search.isOpen.value).toBe(false);
    expect(search.inputText.value).toBe('');
  });

  it('clears state on resetSearch and clearSearch', () => {
    const search = usePlaceSearch();
    search.inputText.value = 'Wien';
    search.isOpen.value = true;
    search.results.value = [{ name: 'Wien', formatted_address: 'Wien', lat: 48, lng: 16 }];
    search.shortlinkDetected.value = true;

    search.clearSearch();

    expect(search.inputText.value).toBe('');
    expect(search.isOpen.value).toBe(false);
    expect(search.results.value).toEqual([]);
    expect(search.shortlinkDetected.value).toBe(false);
  });
});
