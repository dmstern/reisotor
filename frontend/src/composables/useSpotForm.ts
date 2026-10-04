import { ref, computed, watch, type Ref, type ComponentPublicInstance } from 'vue';
import { api } from '../api/client';
import type { ScheduleItem, Spot, User } from '../api/types';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useDraftAutosave } from './useDraftAutosave';
import { useToast } from './useToast';
import { parseLatLngFromMapsLink, tilePreviewUrl, buildGoogleMapsLink } from '../utils/googleMaps';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import { isEmptyRichText } from '../utils/richText';
import { isAutoCreatedUnmodifiedScheduleItem } from '../utils/scheduleSpotUnlink';
import type LocationPicker from '../components/LocationPicker.vue';
import type { PlaceSearchResult } from '../components/LocationPicker.vue';

export interface SpotFormData {
  title: string;
  image_url: string;
  maps_link: string;
  note: string;
  category: string;
  is_home: boolean;
  address: string;
  start_date: string;
  end_date: string;
  checkin: string;
  checkout: string;
  contact: string;
  amount: string;
  paid_by_user_id: string;
  tourTitles: string[];
  scheduledDate: string;
}

export const SPOT_SIDE_OPTIONS = [
  {
    value: 'vacation',
    label: 'Urlaubsort',
    icon: ACTION_ICONS.vacation,
    iconGroup: 'actions' as const,
  },
  {
    value: 'home',
    label: 'Heimat-Seite',
    icon: ACTION_ICONS.home,
    iconGroup: 'actions' as const,
  },
];

export function emptySpotForm(): SpotFormData {
  return {
    title: '',
    image_url: '',
    maps_link: '',
    note: '',
    category: '',
    is_home: false,
    address: '',
    start_date: '',
    end_date: '',
    checkin: '',
    checkout: '',
    contact: '',
    amount: '',
    paid_by_user_id: '',
    tourTitles: [] as string[],
    scheduledDate: '',
  };
}

export function areCoordsEqual(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

export interface UseSpotFormOptions {
  tripId: number;
  users: Ref<User[]>;
  spotScheduledDates: Ref<Map<number, string>>;
}

export function useSpotForm(options: UseSpotFormOptions) {
  const { tripId, users, spotScheduledDates } = options;

  const spotsStore = useSpotsStore();
  const scheduleStore = useScheduleStore();
  const tripStore = useTripStore();
  const auth = useAuthStore();
  const drawers = useDrawersStore();
  const excursionsStore = useExcursionsStore();
  const { showToast } = useToast();

  const showSpotForm = ref(false);
  const spotForm = ref<SpotFormData>(emptySpotForm());
  const spotManualPin = ref<{ lat: number; lng: number } | null>(null);
  const spotLocationError = ref(false);
  const spotPendingFixId = ref<number | null>(null);

  const editingSpot = ref<Spot | null>(null);
  const isSpotUploadingAttachments = ref(false);
  const isSpotUploadingCoverImage = ref(false);
  const editSpotForm = ref<SpotFormData>(emptySpotForm());

  const activeSpotForm = computed(() =>
    editingSpot.value !== null ? editSpotForm.value : spotForm.value
  );

  const newSpotDraft = useDraftAutosave('spots:new', spotForm, showSpotForm);
  const editSpotDraft = useDraftAutosave(
    () => `spots:edit:${editingSpot.value?.id}`,
    editSpotForm,
    computed(() => editingSpot.value !== null)
  );

  const editSpotManualPin = ref<{ lat: number; lng: number } | null>(null);
  const editSpotLocationError = ref(false);

  const isEditSpotLocationModified = computed(() => {
    if (!editingSpot.value) return false;
    const initialPin =
      editingSpot.value.lat != null && editingSpot.value.lng != null
        ? { lat: editingSpot.value.lat, lng: editingSpot.value.lng }
        : null;
    const currentPin = editSpotManualPin.value;
    const pinChanged = !areCoordsEqual(currentPin, initialPin);
    const addressChanged =
      (editSpotForm.value.address || '').trim() !== (editingSpot.value.address || '').trim();
    const titleChanged =
      (editSpotForm.value.title || '').trim() !== (editingSpot.value.title || '').trim();
    const mapsLinkChanged =
      (editSpotForm.value.maps_link || '').trim() !== (editingSpot.value.maps_link || '').trim();
    const categoryChanged =
      (editSpotForm.value.category || '').trim() !== (editingSpot.value.category || '').trim();
    return pinChanged || addressChanged || titleChanged || mapsLinkChanged || categoryChanged;
  });

  const isEditSpotSideModified = computed(() => {
    if (!editingSpot.value) return false;
    const isZuhause = editingSpot.value.category?.trim().toLowerCase() === 'zuhause';
    const initialSide = isZuhause ? true : !!editingSpot.value.is_home;
    return Boolean(editSpotForm.value.is_home) !== initialSide;
  });

  const isEditSpotImageModified = computed(() => {
    if (!editingSpot.value) return false;
    return (
      (editSpotForm.value.image_url || '').trim() !== (editingSpot.value.image_url || '').trim()
    );
  });

  const isEditSpotNoteModified = computed(() => {
    if (!editingSpot.value) return false;
    return (editSpotForm.value.note || '').trim() !== (editingSpot.value.note || '').trim();
  });

  const isEditSpotStartDateModified = computed(() => {
    if (!editingSpot.value) return false;
    return (editSpotForm.value.start_date || '') !== (editingSpot.value.start_date || '');
  });

  const isEditSpotEndDateModified = computed(() => {
    if (!editingSpot.value) return false;
    return (editSpotForm.value.end_date || '') !== (editingSpot.value.end_date || '');
  });

  const isEditSpotCheckinModified = computed(() => {
    if (!editingSpot.value) return false;
    return (editSpotForm.value.checkin || '').trim() !== (editingSpot.value.checkin || '').trim();
  });

  const isEditSpotCheckoutModified = computed(() => {
    if (!editingSpot.value) return false;
    return (editSpotForm.value.checkout || '').trim() !== (editingSpot.value.checkout || '').trim();
  });

  const isEditSpotContactModified = computed(() => {
    if (!editingSpot.value) return false;
    return (editSpotForm.value.contact || '').trim() !== (editingSpot.value.contact || '').trim();
  });

  const isEditSpotAmountModified = computed(() => {
    if (!editingSpot.value) return false;
    const initialAmount = editingSpot.value.amount != null ? String(editingSpot.value.amount) : '';
    return (editSpotForm.value.amount || '').trim() !== initialAmount.trim();
  });

  const isEditSpotPaidByModified = computed(() => {
    if (!editingSpot.value) return false;
    const initialPaid =
      editingSpot.value.paid_by_user_id != null ? String(editingSpot.value.paid_by_user_id) : '';
    return (editSpotForm.value.paid_by_user_id || '').trim() !== initialPaid.trim();
  });

  const isEditSpotDirty = computed(
    () => editSpotDraft.isDirty.value || isEditSpotLocationModified.value
  );

  const isSpotModalDirty = computed(() =>
    editingSpot.value !== null ? isEditSpotDirty.value : newSpotDraft.isDirty.value
  );

  const spotTitleTouched = ref(false);
  const showSpotTitleError = computed(
    () => spotTitleTouched.value && !activeSpotForm.value.title.trim()
  );

  const canSaveSpot = computed(
    () =>
      !!activeSpotForm.value.title.trim() &&
      !isSpotUploadingAttachments.value &&
      !isSpotUploadingCoverImage.value
  );

  const spotSaveTooltip = computed(() => {
    if (isSpotUploadingAttachments.value) return 'Dateianhänge werden noch hochgeladen…';
    if (isSpotUploadingCoverImage.value) return 'Spot-Bild wird noch hochgeladen…';
    if (!activeSpotForm.value.title.trim()) return 'Bitte gib zuerst einen Titel für den Spot ein';
    return undefined;
  });

  function openSpotForm() {
    spotTitleTouched.value = false;
    showSpotForm.value = true;
  }

  const editSpotScheduledItems = computed(() => {
    if (!editingSpot.value) return [];
    return scheduleStore.items.filter((i) => i.spot_id === editingSpot.value!.id);
  });

  async function toggleScheduledItemDone(item: ScheduleItem) {
    await scheduleStore.setDone(item.id, !item.done);
  }

  async function removeScheduledItemFromSpot(item: ScheduleItem) {
    if (!editingSpot.value) return;

    const isAutoUnmodified = isAutoCreatedUnmodifiedScheduleItem(item, editingSpot.value.title);

    if (isAutoUnmodified) {
      await scheduleStore.remove(item.id);
      showToast({
        message: 'Termin wurde gelöscht, da er vorher automatisch vom Reisotor angelegt wurde.',
        type: 'info',
      });
    } else {
      await scheduleStore.update(item.id, {
        trip_id: item.trip_id,
        date: item.date,
        end_date: item.end_date,
        time: item.time ?? undefined,
        end_time: item.end_time ?? undefined,
        title: item.title,
        note: item.note ?? undefined,
        location: item.location ?? undefined,
        maps_link: item.maps_link ?? undefined,
        lat: item.lat ?? undefined,
        lng: item.lng ?? undefined,
        spot_id: null,
        idea_id: item.idea_id,
      });
      showToast({
        message:
          'Termin-Verknüpfung entfernt. Der Termin selbst lässt sich noch im Kalender bearbeiten.',
        type: 'info',
      });
    }
  }

  function openScheduledItemDetail(item: ScheduleItem) {
    drawers.openCalendar();
    scheduleStore.openDetail(item);
  }

  const spotPickerCenter = computed(() => {
    const t = tripStore.currentTrip;
    return t?.lat != null && t?.lng != null ? { lat: t.lat, lng: t.lng } : undefined;
  });

  const spotPreviewImage = computed(() => {
    if (spotForm.value.image_url) return spotForm.value.image_url;
    const parsed = parseLatLngFromMapsLink(spotForm.value.maps_link);
    const coords = spotManualPin.value ?? parsed;
    return coords ? tilePreviewUrl(coords.lat, coords.lng) : null;
  });

  const editSpotPreviewImage = computed(() => {
    if (editSpotForm.value.image_url) return editSpotForm.value.image_url;
    const parsed = parseLatLngFromMapsLink(editSpotForm.value.maps_link);
    const coords = editSpotManualPin.value ?? parsed;
    return coords ? tilePreviewUrl(coords.lat, coords.lng) : null;
  });

  const spotImageSearchContext = computed(() => {
    const pin = editingSpot.value !== null ? editSpotManualPin.value : spotManualPin.value;
    return {
      name: activeSpotForm.value.title.trim() || undefined,
      city: selectedSpotCity.value || undefined,
      lat: pin?.lat,
      lng: pin?.lng,
      maps_link: activeSpotForm.value.maps_link || undefined,
    };
  });

  function resetEditSpotImage() {
    if (editingSpot.value) {
      editSpotForm.value.image_url = editingSpot.value.image_url ?? '';
    } else {
      spotForm.value.image_url = '';
    }
  }

  const showSpotLocationSection = ref(false);
  const showEditSpotLocationSection = ref(false);
  const showSpotScheduleSection = ref(false);

  watch(editingSpot, (val) => {
    if (val) {
      showEditSpotLocationSection.value =
        !!val.maps_link ||
        !!val.is_home ||
        val.category?.trim().toLowerCase() === 'zuhause' ||
        !!val.address ||
        (val.lat != null && val.lng != null);
      showSpotScheduleSection.value =
        editSpotForm.value.tourTitles.length > 0 || editSpotScheduledItems.value.length > 0;
    } else {
      showEditSpotLocationSection.value = false;
      showSpotScheduleSection.value = false;
    }
  });

  watch(
    () => spotForm.value.category,
    (newCat, oldCat) => {
      if (newCat === 'Unterkunft' && oldCat !== 'Unterkunft') {
        showSpotLocationSection.value = true;
      }
      const isNewZuhause = newCat?.trim().toLowerCase() === 'zuhause';
      const wasZuhause = oldCat?.trim().toLowerCase() === 'zuhause';
      if (isNewZuhause && !wasZuhause) {
        spotForm.value.is_home = true;
        showSpotLocationSection.value = true;
      } else if (!isNewZuhause && wasZuhause) {
        spotForm.value.is_home = false;
      }
    }
  );

  watch(
    () => editSpotForm.value.category,
    (newCat, oldCat) => {
      if (!editingSpot.value) return;
      if (newCat === 'Unterkunft' && oldCat !== 'Unterkunft') {
        showEditSpotLocationSection.value = true;
      }
      const isNewZuhause = newCat?.trim().toLowerCase() === 'zuhause';
      const wasZuhause = oldCat?.trim().toLowerCase() === 'zuhause';
      if (isNewZuhause && !wasZuhause) {
        editSpotForm.value.is_home = true;
        showEditSpotLocationSection.value = true;
      } else if (!isNewZuhause && wasZuhause) {
        editSpotForm.value.is_home = false;
      }
    }
  );

  function getTourDate(title: string): string | null {
    const tour = excursionsStore.excursions.find(
      (e) => e.title.toLowerCase() === title.trim().toLowerCase()
    );
    return tour?.date ?? null;
  }

  function isTourTravel(title: string): boolean {
    const tour = excursionsStore.excursions.find(
      (e) => e.title.toLowerCase() === title.trim().toLowerCase()
    );
    return !!tour?.role;
  }

  function removeTourTitle(title: string) {
    if (editingSpot.value !== null) {
      editSpotForm.value.tourTitles = editSpotForm.value.tourTitles.filter((t) => t !== title);
    } else {
      spotForm.value.tourTitles = spotForm.value.tourTitles.filter((t) => t !== title);
    }
  }

  function computeMenuStyle(
    btnEl: HTMLElement | ComponentPublicInstance | null,
    event?: MouseEvent,
    minWidth = 200
  ): { top: string; left: string } {
    const el =
      (event?.currentTarget as HTMLElement) ||
      (btnEl as ComponentPublicInstance)?.$el ||
      (btnEl as HTMLElement);
    if (!el || typeof el.getBoundingClientRect !== 'function') return { top: '0px', left: '0px' };
    const rect = el.getBoundingClientRect();
    return {
      top: `${rect.bottom + 6}px`,
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8))}px`,
    };
  }

  const addSchedulePopoverOpen = ref(false);
  const addScheduleDateVal = ref('');
  const addScheduleBtnRef = ref<HTMLElement | null>(null);
  const addScheduleMenuStyle = ref({ top: '0px', left: '0px' });

  function toggleAddSchedulePopover(event?: MouseEvent) {
    if (!addSchedulePopoverOpen.value) {
      addScheduleDateVal.value = '';
      addScheduleMenuStyle.value = computeMenuStyle(addScheduleBtnRef.value, event, 220);
      addSchedulePopoverOpen.value = true;
    } else {
      addSchedulePopoverOpen.value = false;
    }
  }

  async function submitAddSpotToDate() {
    const date = addScheduleDateVal.value;
    if (!date || !editingSpot.value || !tripStore.currentTripId) return;
    await scheduleStore.create({
      trip_id: tripStore.currentTripId,
      date,
      title: editingSpot.value.title,
      spot_id: editingSpot.value.id,
      auto_created: 1,
      user_modified: 0,
    });
    addScheduleDateVal.value = '';
    addSchedulePopoverOpen.value = false;
  }

  const spotReferencePoints = computed(() =>
    spotsStore.spots
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        lat: s.lat as number,
        lng: s.lng as number,
        icon: spotCategoryMeta(s.category).tabler,
      }))
  );

  const editSpotReferencePoints = computed(() =>
    spotsStore.spots
      .filter((s) => s.id !== editingSpot.value?.id && s.lat != null && s.lng != null)
      .map((s) => ({
        lat: s.lat as number,
        lng: s.lng as number,
        icon: spotCategoryMeta(s.category).tabler,
      }))
  );

  let lastPreviewFetchKey = '';
  const spotPreviewImages = ref<string[]>([]);
  const selectedSpotCity = ref<string | null>(null);

  async function fetchSpotPreview(
    mapsLink: string,
    form: Ref<SpotFormData>,
    extra?: { name?: string; lat?: number; lng?: number; city?: string }
  ) {
    if (!mapsLink && !extra?.name) return;
    const key = `${mapsLink}|${extra?.name || ''}|${extra?.lat || ''}|${extra?.lng || ''}|${extra?.city || ''}`;
    if (lastPreviewFetchKey === key) return;
    lastPreviewFetchKey = key;

    try {
      const params = new URLSearchParams();
      if (mapsLink) params.set('maps_link', mapsLink);
      if (extra?.name) params.set('name', extra.name);
      if (extra?.lat != null) params.set('lat', String(extra.lat));
      if (extra?.lng != null) params.set('lng', String(extra.lng));
      if (extra?.city) params.set('city', extra.city);

      const preview = await api.get<{
        name: string | null;
        imageUrl: string | null;
        images?: string[];
      }>(`/spots/preview?${params.toString()}`);
      if (preview.images && preview.images.length > 0) {
        spotPreviewImages.value = preview.images;
      } else if (preview.imageUrl) {
        spotPreviewImages.value = [preview.imageUrl];
      }
      if (preview.name && !form.value.title.trim()) form.value.title = preview.name;
      if (preview.imageUrl && !form.value.image_url.trim()) form.value.image_url = preview.imageUrl;
    } catch {
      // Vorschau fehlgeschlagen
    }
  }

  function onSpotMapsLinkUpdate(val: string) {
    activeSpotForm.value.maps_link = val;
    if (val) {
      const pin = editingSpot.value !== null ? editSpotManualPin.value : spotManualPin.value;
      fetchSpotPreview(val, editingSpot.value !== null ? editSpotForm : spotForm, {
        name: activeSpotForm.value.title.trim() || undefined,
        lat: pin?.lat,
        lng: pin?.lng,
      });
    }
  }

  function spotToBody(
    f: SpotFormData,
    manual?: { lat: number; lng: number } | null,
    fallback?: { lat?: number | null; lng?: number | null }
  ) {
    const parsed = parseLatLngFromMapsLink(f.maps_link);
    let lat: number | null | undefined;
    let lng: number | null | undefined;
    if (manual !== undefined) {
      if (manual !== null) {
        lat = manual.lat;
        lng = manual.lng;
      } else if (!f.maps_link) {
        lat = null;
        lng = null;
      } else {
        lat = parsed?.lat ?? undefined;
        lng = parsed?.lng ?? undefined;
      }
    } else {
      lat = parsed?.lat ?? fallback?.lat ?? undefined;
      lng = parsed?.lng ?? fallback?.lng ?? undefined;
    }
    return {
      trip_id: tripId,
      title: f.title.trim(),
      image_url: f.image_url || undefined,
      category: f.category || undefined,
      note: f.note && !isEmptyRichText(f.note) ? f.note : undefined,
      note_format: 'html' as const,
      maps_link: f.maps_link || undefined,
      lat,
      lng,
      is_home: f.is_home,
      address: f.address || undefined,
      start_date: f.start_date || undefined,
      end_date: f.end_date || undefined,
      checkin: f.checkin || undefined,
      checkout: f.checkout || undefined,
      contact: f.contact || undefined,
      amount: f.amount ? Number(f.amount) : undefined,
      paid_by_user_id: f.paid_by_user_id
        ? Number(f.paid_by_user_id)
        : f.amount
          ? users.value.length === 1
            ? users.value[0].id
            : (auth.user?.id ?? undefined)
          : undefined,
    };
  }

  function closeSpotForm() {
    spotTitleTouched.value = false;
    showSpotForm.value = false;
    spotForm.value = emptySpotForm();
    spotManualPin.value = null;
    editSpotManualPin.value = null;
    spotLocationError.value = false;
    spotPendingFixId.value = null;
    showSpotLocationSection.value = false;
    showSpotScheduleSection.value = false;
    isSpotUploadingCoverImage.value = false;
    spotPreviewImages.value = [];
    selectedSpotCity.value = null;
    newSpotDraft.clear();
  }

  function discardNewSpotDraft() {
    spotTitleTouched.value = false;
    spotForm.value = emptySpotForm();
    spotManualPin.value = null;
    editSpotManualPin.value = null;
    spotLocationError.value = false;
    spotPendingFixId.value = null;
    showSpotLocationSection.value = false;
    showSpotScheduleSection.value = false;
    isSpotUploadingCoverImage.value = false;
    spotPreviewImages.value = [];
    selectedSpotCity.value = null;
    newSpotDraft.clear();
    showToast({ message: 'Entwurf verworfen.', type: 'info' });
  }

  const allTourTitles = computed(() => excursionsStore.excursions.map((e) => e.title));

  function tourTitlesFor(spotId: number): string[] {
    return excursionsStore.excursions
      .filter((e) => e.spot_ids.includes(spotId))
      .map((e) => e.title);
  }

  async function syncSpotTours(spotId: number, desiredTitles: string[]) {
    const desiredLower = desiredTitles.map((t) => t.toLowerCase());
    for (const tour of excursionsStore.excursions.filter((e) => e.spot_ids.includes(spotId))) {
      if (!desiredLower.includes(tour.title.toLowerCase())) {
        await excursionsStore.update(tour.id, {
          title: tour.title,
          image_url: tour.image_url ?? undefined,
          note: tour.note ?? undefined,
          date: tour.date ?? undefined,
          spot_ids: tour.spot_ids.filter((id) => id !== spotId),
        });
      }
    }
    for (const title of desiredTitles) {
      const existing = excursionsStore.excursions.find(
        (e) => e.title.toLowerCase() === title.toLowerCase()
      );
      if (!existing) {
        await excursionsStore.create({ title, spot_ids: [spotId] });
      } else if (!existing.spot_ids.includes(spotId)) {
        await excursionsStore.update(existing.id, {
          title: existing.title,
          image_url: existing.image_url ?? undefined,
          note: existing.note ?? undefined,
          date: existing.date ?? undefined,
          spot_ids: [...existing.spot_ids, spotId],
        });
      }
    }
  }

  async function addSpot() {
    if (!spotForm.value.title.trim()) {
      spotTitleTouched.value = true;
      return;
    }
    if (isSpotUploadingAttachments.value || isSpotUploadingCoverImage.value) return;
    const body = spotToBody(spotForm.value, spotManualPin.value);
    const result =
      spotPendingFixId.value != null
        ? await spotsStore.update(spotPendingFixId.value, body)
        : await spotsStore.create(body);
    drawers.touchLocations();

    if (body.maps_link && result.lat == null && !spotManualPin.value) {
      spotPendingFixId.value = result.id;
      spotLocationError.value = true;
      showSpotLocationSection.value = true;
      return;
    }
    await syncSpotTours(result.id, spotForm.value.tourTitles);
    if (spotForm.value.scheduledDate) {
      await scheduleStore.create({
        trip_id: tripId,
        date: spotForm.value.scheduledDate,
        title: result.title,
        spot_id: result.id,
      });
    }
    closeSpotForm();
  }

  function onSpotLocationSelect(place: PlaceSearchResult) {
    selectedSpotCity.value = place.city || null;
    activeSpotForm.value.title = place.name;
    spotTitleTouched.value = false;
    activeSpotForm.value.address = place.formatted_address || place.name;
    const coords = { lat: place.lat, lng: place.lng };
    spotManualPin.value = coords;
    editSpotManualPin.value = coords;
    activeSpotForm.value.maps_link = buildGoogleMapsLink(place.lat, place.lng);
    if (place.category) {
      activeSpotForm.value.category = place.category;
    }
    lastPreviewFetchKey = '';
    fetchSpotPreview(
      activeSpotForm.value.maps_link,
      editingSpot.value !== null ? editSpotForm : spotForm,
      {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        city: place.city,
      }
    );
  }

  const spotLocationPickerRef = ref<InstanceType<typeof LocationPicker> | null>(null);

  function triggerSpotLocationClear() {
    if (spotLocationPickerRef.value) {
      spotLocationPickerRef.value.clear();
    } else {
      onSpotLocationClear();
    }
  }

  function onSpotLocationClear() {
    spotManualPin.value = null;
    editSpotManualPin.value = null;
    activeSpotForm.value.maps_link = '';
  }

  function resetEditSpotLocation() {
    if (!editingSpot.value) {
      triggerSpotLocationClear();
      return;
    }
    const original = editingSpot.value;
    const pin =
      original.lat != null && original.lng != null
        ? { lat: original.lat, lng: original.lng }
        : null;
    editSpotManualPin.value = pin;
    spotManualPin.value = pin;
    activeSpotForm.value.title = original.title;
    activeSpotForm.value.address = original.address ?? '';
    activeSpotForm.value.maps_link = original.maps_link ?? '';
    activeSpotForm.value.category = original.category ?? '';
    editSpotLocationError.value = false;
    spotLocationPickerRef.value?.reset();
  }

  function startEditSpot(spot: Spot) {
    spotTitleTouched.value = false;
    selectedSpotCity.value = null;
    spotPreviewImages.value = spot.image_url ? [spot.image_url] : [];
    const isZuhause = spot.category?.trim().toLowerCase() === 'zuhause';
    editSpotForm.value = {
      title: spot.title,
      image_url: spot.image_url ?? '',
      maps_link: spot.maps_link ?? '',
      note: spot.note ?? '',
      category: spot.category ?? '',
      is_home: isZuhause ? true : !!spot.is_home,
      address: spot.address ?? '',
      start_date: spot.start_date ?? '',
      end_date: spot.end_date ?? '',
      checkin: spot.checkin ?? '',
      checkout: spot.checkout ?? '',
      contact: spot.contact ?? '',
      amount: spot.amount != null ? String(spot.amount) : '',
      paid_by_user_id: spot.paid_by_user_id != null ? String(spot.paid_by_user_id) : '',
      tourTitles: tourTitlesFor(spot.id),
      scheduledDate: spotScheduledDates.value.get(spot.id) ?? '',
    };
    const pin = spot.lat != null && spot.lng != null ? { lat: spot.lat, lng: spot.lng } : null;
    editSpotManualPin.value = pin;
    spotManualPin.value = pin;
    editSpotLocationError.value = false;
    editingSpot.value = spot;
  }

  async function submitEditSpot() {
    if (!editSpotForm.value.title.trim()) {
      spotTitleTouched.value = true;
      return;
    }
    if (!editingSpot.value || isSpotUploadingAttachments.value || isSpotUploadingCoverImage.value)
      return;
    const body = spotToBody(editSpotForm.value, editSpotManualPin.value, editingSpot.value);
    const updated = await spotsStore.update(editingSpot.value.id, body);
    drawers.touchLocations();
    if (body.maps_link && updated.lat == null && !editSpotManualPin.value) {
      editSpotLocationError.value = true;
      showEditSpotLocationSection.value = true;
      return;
    }
    await syncSpotTours(editingSpot.value.id, editSpotForm.value.tourTitles);
    editSpotLocationError.value = false;
    editSpotDraft.clear();
    editingSpot.value = null;
  }

  function closeEditSpotForm() {
    spotTitleTouched.value = false;
    spotManualPin.value = null;
    editSpotManualPin.value = null;
    isSpotUploadingCoverImage.value = false;
    spotPreviewImages.value = [];
    selectedSpotCity.value = null;
    editSpotDraft.clear();
    editingSpot.value = null;
  }

  function discardEditSpotDraft() {
    if (!editingSpot.value) return;
    startEditSpot(editingSpot.value);
    editSpotDraft.clear();
    showToast({ message: 'Änderungen verworfen.', type: 'info' });
  }

  async function deleteEditingSpot() {
    if (!editingSpot.value || isSpotUploadingAttachments.value || isSpotUploadingCoverImage.value)
      return;
    const id = editingSpot.value.id;
    await spotsStore.remove(id);
    drawers.touchLocations();
    closeEditSpotForm();
  }

  watch(spotManualPin, (pin) => {
    if (editingSpot.value !== null) {
      editSpotManualPin.value = pin;
    }
    if (
      pin &&
      (editingSpot.value !== null ? editSpotLocationError.value : spotLocationError.value)
    ) {
      if (editingSpot.value !== null) {
        submitEditSpot();
      } else {
        addSpot();
      }
    }
  });

  watch(editSpotManualPin, (pin) => {
    if (pin && editSpotLocationError.value) submitEditSpot();
  });

  return {
    showSpotForm,
    spotForm,
    newSpotDraft,
    openSpotForm,
    closeSpotForm,
    discardNewSpotDraft,
    addSpot,
    editingSpot,
    editSpotForm,
    editSpotDraft,
    startEditSpot,
    closeEditSpotForm,
    discardEditSpotDraft,
    submitEditSpot,
    deleteEditingSpot,
    activeSpotForm,
    spotTitleTouched,
    showSpotTitleError,
    canSaveSpot,
    spotSaveTooltip,
    isSpotModalDirty,
    spotManualPin,
    editSpotManualPin,
    spotLocationError,
    editSpotLocationError,
    spotPendingFixId,
    isSpotUploadingAttachments,
    isSpotUploadingCoverImage,
    spotPreviewImages,
    selectedSpotCity,
    spotPreviewImage,
    editSpotPreviewImage,
    spotImageSearchContext,
    resetEditSpotImage,
    spotReferencePoints,
    editSpotReferencePoints,
    spotPickerCenter,
    SPOT_SIDE_OPTIONS,
    showSpotLocationSection,
    showEditSpotLocationSection,
    showSpotScheduleSection,
    editSpotScheduledItems,
    toggleScheduledItemDone,
    removeScheduledItemFromSpot,
    openScheduledItemDetail,
    addSchedulePopoverOpen,
    addScheduleDateVal,
    addScheduleBtnRef,
    addScheduleMenuStyle,
    toggleAddSchedulePopover,
    submitAddSpotToDate,
    allTourTitles,
    tourTitlesFor,
    removeTourTitle,
    getTourDate,
    isTourTravel,
    onSpotMapsLinkUpdate,
    onSpotLocationSelect,
    spotLocationPickerRef,
    triggerSpotLocationClear,
    onSpotLocationClear,
    resetEditSpotLocation,
    isEditSpotDirty,
    isEditSpotLocationModified,
    isEditSpotSideModified,
    isEditSpotImageModified,
    isEditSpotNoteModified,
    isEditSpotStartDateModified,
    isEditSpotEndDateModified,
    isEditSpotCheckinModified,
    isEditSpotCheckoutModified,
    isEditSpotContactModified,
    isEditSpotAmountModified,
    isEditSpotPaidByModified,
  };
}
