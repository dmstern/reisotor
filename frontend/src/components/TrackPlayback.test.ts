// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TrackPlayback from './TrackPlayback.vue';
import type { LocationTrack, TrackPoint } from '../api/types';

describe('TrackPlayback', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  const samplePoints: TrackPoint[] = [
    {
      id: 1,
      track_id: 10,
      lat: 47.0501,
      lng: 8.3093,
      recorded_at: '2026-09-26T10:00:00.000Z',
      accuracy: 5,
      altitude: 400,
    },
    {
      id: 2,
      track_id: 10,
      lat: 47.052,
      lng: 8.3115,
      recorded_at: '2026-09-26T10:07:30.000Z',
      accuracy: 5,
      altitude: 430,
    },
    {
      id: 3,
      track_id: 10,
      lat: 47.0545,
      lng: 8.3142,
      recorded_at: '2026-09-26T10:15:00.000Z',
      accuracy: 5,
      altitude: 460,
    },
    {
      id: 4,
      track_id: 10,
      lat: 47.0565,
      lng: 8.317,
      recorded_at: '2026-09-26T10:22:30.000Z',
      accuracy: 5,
      altitude: 430,
    },
    {
      id: 5,
      track_id: 10,
      lat: 47.0589,
      lng: 8.3198,
      recorded_at: '2026-09-26T10:30:00.000Z',
      accuracy: 5,
      altitude: 400,
    },
  ];

  interface MountOptions {
    track?: LocationTrack | null;
    title?: string | null;
    authorAvatar?: string | null;
    authorName?: string | null;
    points?: TrackPoint[];
    progress?: number;
    onUpdateProgress?: (val: number) => void;
    onClose?: () => void;
  }

  function mountPlayback(options: MountOptions = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const progressRef = ref(options.progress ?? 0);
    const onUpdate =
      options.onUpdateProgress ||
      ((val: number) => {
        progressRef.value = val;
      });

    const app = createApp({
      render: () =>
        h(TrackPlayback, {
          track: options.track,
          title: options.title,
          authorAvatar: options.authorAvatar,
          authorName: options.authorName,
          points: options.points ?? samplePoints,
          progress: progressRef.value,
          'onUpdate:progress': onUpdate,
          onClose: options.onClose,
        }),
    });

    app.mount(container);

    return {
      container,
      progressRef,
      cleanUp: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders track title, distance, duration, average speed, and elevation gain/loss', async () => {
    const { container, cleanUp } = mountPlayback({
      title: 'Panoramaweg Rigi',
      points: samplePoints,
      progress: 0,
    });
    await nextTick();

    // 1. Track Title
    const titleEl = container.querySelector('.track-playback-title');
    expect(titleEl?.textContent).toContain('Panoramaweg Rigi');

    // 2. Distance
    const statsText = container.querySelector('.track-playback-stats')?.textContent || '';
    expect(statsText).toMatch(/km|m/);

    // 3. Duration
    expect(statsText).toContain('30');
    expect(statsText).toContain('Min.');

    // 4. Average Speed
    expect(statsText).toContain('km/h');

    // 5. Elevation gain/loss
    expect(statsText).toContain('↗');
    expect(statsText).toContain('↘');
    expect(statsText).toContain('40');

    cleanUp();
  });

  it('falls back to default title when title prop is null or empty', async () => {
    const { container, cleanUp } = mountPlayback({
      title: null,
      points: samplePoints,
    });
    await nextTick();

    const titleEl = container.querySelector('.track-playback-title');
    expect(titleEl?.textContent).toContain('Aufzeichnung');

    cleanUp();
  });

  it('play/pause toggles playback state', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(101);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { container, cleanUp } = mountPlayback({ points: samplePoints, progress: 0 });
    await nextTick();

    const playBtn = container.querySelector<HTMLButtonElement>('.playback-btn')!;
    expect(playBtn).toBeTruthy();
    expect(playBtn.getAttribute('title')).toBe('Abspielen');

    // Click play
    playBtn.click();
    await nextTick();

    expect(playBtn.getAttribute('title')).toBe('Pause');
    expect(window.requestAnimationFrame).toHaveBeenCalled();

    // Click pause
    playBtn.click();
    await nextTick();

    expect(playBtn.getAttribute('title')).toBe('Abspielen');
    expect(cancelSpy).toHaveBeenCalledWith(101);

    cleanUp();
  });

  it('timeline scrubber emits progress updates and stops animation', async () => {
    const onUpdateProgress = vi.fn();
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(202);

    const { container, cleanUp } = mountPlayback({
      points: samplePoints,
      progress: 0.1,
      onUpdateProgress,
    });
    await nextTick();

    const slider = container.querySelector<HTMLInputElement>('.playback-slider')!;
    expect(slider).toBeTruthy();
    expect(Number(slider.value)).toBe(0.1);

    // Start playing first
    container.querySelector<HTMLButtonElement>('.playback-btn')!.click();
    await nextTick();

    // Scrub to 0.75
    slider.value = '0.75';
    slider.dispatchEvent(new Event('input'));
    await nextTick();

    expect(onUpdateProgress).toHaveBeenCalledWith(0.75);
    // Scrubbing must cancel ongoing animation
    expect(cancelSpy).toHaveBeenCalled();

    cleanUp();
  });

  it('speed multiplier selector toggles between 1x, 2x, 5x, 10x', async () => {
    const { container, cleanUp } = mountPlayback({ points: samplePoints });
    await nextTick();

    const speedButtons = container.querySelectorAll<HTMLButtonElement>('.speed-btn');
    expect(speedButtons.length).toBe(4);

    const buttonTexts = Array.from(speedButtons).map((btn) => btn.textContent?.trim());
    expect(buttonTexts).toEqual(['1x', '2x', '5x', '10x']);

    // Default 1x is active
    expect(speedButtons[0].classList.contains('active')).toBe(true);

    // Click 2x
    speedButtons[1].click();
    await nextTick();
    expect(speedButtons[1].classList.contains('active')).toBe(true);
    expect(speedButtons[0].classList.contains('active')).toBe(false);

    // Click 5x
    speedButtons[2].click();
    await nextTick();
    expect(speedButtons[2].classList.contains('active')).toBe(true);

    // Click 10x
    speedButtons[3].click();
    await nextTick();
    expect(speedButtons[3].classList.contains('active')).toBe(true);

    cleanUp();
  });

  it('opens and closes speed popover and updates trigger label', async () => {
    const { container, cleanUp } = mountPlayback();

    const trigger = container.querySelector<HTMLButtonElement>('.speed-trigger-btn');
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent?.trim()).toBe('1x');

    const popover = container.querySelector<HTMLElement>('.speed-popover');
    expect(popover).toBeTruthy();
    expect(popover?.style.display).toBe('none');

    // Click trigger to open
    trigger?.click();
    await nextTick();
    expect(popover?.style.display).not.toBe('none');
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    // Select 5x
    const speedButtons = container.querySelectorAll<HTMLButtonElement>('.speed-btn');
    speedButtons[2].click();
    await nextTick();

    expect(trigger?.textContent?.trim()).toBe('5x');
    expect(popover?.style.display).toBe('none');

    // Reopen and close via Escape
    trigger?.click();
    await nextTick();
    expect(popover?.style.display).not.toBe('none');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(popover?.style.display).toBe('none');

    cleanUp();
  });

  it('gracefully handles tracks with empty points or missing altitude', async () => {
    // 1. Empty points
    const { container: emptyContainer, cleanUp: cleanUpEmpty } = mountPlayback({
      points: [],
      progress: 0,
    });
    await nextTick();

    const emptyStats = emptyContainer.querySelector('.track-playback-stats');
    expect(emptyStats).toBeTruthy();
    // Distance and duration default to 0
    expect(emptyStats?.textContent).toContain('0\u00A0m');
    expect(emptyStats?.textContent).toContain('0\u00A0Min.');
    // No NaN or invalid characters
    expect(emptyContainer.innerHTML).not.toContain('NaN');
    cleanUpEmpty();

    // 2. Missing altitude
    const pointsWithoutAlt: TrackPoint[] = [
      {
        id: 1,
        track_id: 20,
        lat: 47.0501,
        lng: 8.3093,
        recorded_at: '2026-09-26T10:00:00.000Z',
        accuracy: 5,
        altitude: null,
      },
      {
        id: 2,
        track_id: 20,
        lat: 47.0545,
        lng: 8.3142,
        recorded_at: '2026-09-26T10:15:00.000Z',
        accuracy: null,
        altitude: undefined,
      },
    ];

    const { container: noAltContainer, cleanUp: cleanUpNoAlt } = mountPlayback({
      points: pointsWithoutAlt,
      progress: 0,
    });
    await nextTick();

    const noAltStats = noAltContainer.querySelector('.track-playback-stats')?.textContent || '';
    expect(noAltStats).toContain('15\u00A0Min.');
    expect(noAltStats).not.toContain('↗');
    expect(noAltStats).not.toContain('↘');
    expect(noAltContainer.innerHTML).not.toContain('NaN');
    cleanUpNoAlt();
  });

  it('emits close event when close button is clicked', async () => {
    const onClose = vi.fn();
    const { container, cleanUp } = mountPlayback({
      points: samplePoints,
      onClose,
    });
    await nextTick();

    const closeBtn = container.querySelector<HTMLButtonElement>('.playback-close-btn');
    expect(closeBtn).toBeTruthy();

    closeBtn?.click();
    expect(onClose).toHaveBeenCalledTimes(1);

    cleanUp();
  });

  it('renders author avatar and username when provided on track or props', async () => {
    const { container, cleanUp } = mountPlayback({
      points: samplePoints,
      track: {
        id: 10,
        trip_id: 1,
        user_id: 2,
        author_username: 'Anna',
        author_avatar: '🦊',
        excursion_id: null,
        title: 'Schöne Wanderung',
        visibility: 'shared',
        started_at: '2026-09-26T10:00:00.000Z',
        ended_at: '2026-09-26T10:30:00.000Z',
      },
    });
    await nextTick();

    const authorEl = container.querySelector('.track-playback-author');
    expect(authorEl).toBeTruthy();
    expect(authorEl?.querySelector('.track-playback-author-avatar')?.textContent).toBe('🦊');
    expect(authorEl?.querySelector('.track-playback-author-name')?.textContent).toBe('Anna');
    expect(authorEl?.getAttribute('title')).toBe('Aufgezeichnet von Anna');

    cleanUp();
  });
});
