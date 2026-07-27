<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation, ExcursionComment, ExcursionLike, Spot, SpotComment, SpotLike, TravelItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import ExcursionCard from '../components/ExcursionCard.vue';
import SpotCard from '../components/SpotCard.vue';
import DerivedLocationCard from '../components/DerivedLocationCard.vue';
import SpotOrderPicker from '../components/SpotOrderPicker.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import { parseLatLngFromMapsLink, tilePreviewUrl } from '../utils/googleMaps';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import type { DerivedLocation } from '../utils/derivedLocation';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();

const users = ref<User[]>([]);
const likes = ref<ExcursionLike[]>([]);
const comments = ref<ExcursionComment[]>([]);
const spots = ref<Spot[]>([]);
const spotLikes = ref<SpotLike[]>([]);
const spotComments = ref<SpotComment[]>([]);
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [usersRes, likesRes, commentsRes, spotsRes, spotLikesRes, spotCommentsRes, accommodationRes, travelRes] =
    await Promise.all([
      api.get<User[]>('/users'),
      api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
      api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
      api.get<Spot[]>(`/spots?trip_id=${tripId}`),
      api.get<SpotLike[]>(`/spots/likes?trip_id=${tripId}`),
      api.get<SpotComment[]>(`/spots/comments?trip_id=${tripId}`),
      api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
      api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
      excursionsStore.load(),
    ]);
  users.value = usersRes;
  likes.value = likesRes;
  comments.value = commentsRes;
  spots.value = spotsRes;
  spotLikes.value = spotLikesRes;
  spotComments.value = spotCommentsRes;
  accommodations.value = accommodationRes;
  travelItems.value = travelRes;
  loading.value = false;
});

function creatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function author(id: number) {
  return users.value.find((u) => u.id === id);
}

function stationsFor(spotIds: number[]) {
  return spots.value.filter((s) => spotIds.includes(s.id));
}

// --- Likes/Kommentare Ausflüge (weiterhin an ideas/idea_likes/idea_comments gebunden) ---
function likesFor(ideaId: number) {
  return likes.value.filter((l) => l.idea_id === ideaId);
}
function likedByMe(ideaId: number) {
  return likesFor(ideaId).some((l) => l.user_id === auth.user?.id);
}
function commentsFor(ideaId: number) {
  return comments.value.filter((c) => c.idea_id === ideaId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function commentItemsFor(ideaId: number) {
  return commentsFor(ideaId).map((c) => ({
    id: c.id,
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}
async function toggleLike(ideaId: number) {
  const result = await api.post<{ liked: boolean }>(`/ideas/${ideaId}/like`);
  if (result.liked) {
    likes.value.push({ id: Date.now(), idea_id: ideaId, user_id: auth.user!.id });
  } else {
    likes.value = likes.value.filter((l) => !(l.idea_id === ideaId && l.user_id === auth.user!.id));
  }
}
async function submitComment(ideaId: number, content: string) {
  const created = await api.post<ExcursionComment>(`/ideas/${ideaId}/comments`, { content });
  comments.value.push(created);
}
async function removeComment(id: number) {
  await api.delete(`/ideas/comments/${id}`);
  comments.value = comments.value.filter((c) => c.id !== id);
}

// --- Likes/Kommentare Spots (analog, an spots/spot_likes/spot_comments gebunden) ---
function spotLikesFor(spotId: number) {
  return spotLikes.value.filter((l) => l.spot_id === spotId);
}
function spotLikedByMe(spotId: number) {
  return spotLikesFor(spotId).some((l) => l.user_id === auth.user?.id);
}
function spotCommentsFor(spotId: number) {
  return spotComments.value.filter((c) => c.spot_id === spotId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function spotCommentItemsFor(spotId: number) {
  return spotCommentsFor(spotId).map((c) => ({
    id: c.id,
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}
async function toggleSpotLike(spotId: number) {
  const result = await api.post<{ liked: boolean }>(`/spots/${spotId}/like`);
  if (result.liked) {
    spotLikes.value.push({ id: Date.now(), spot_id: spotId, user_id: auth.user!.id });
  } else {
    spotLikes.value = spotLikes.value.filter((l) => !(l.spot_id === spotId && l.user_id === auth.user!.id));
  }
}
async function submitSpotComment(spotId: number, content: string) {
  const created = await api.post<SpotComment>(`/spots/${spotId}/comments`, { content });
  spotComments.value.push(created);
}
async function removeSpotComment(id: number) {
  await api.delete(`/spots/comments/${id}`);
  spotComments.value = spotComments.value.filter((c) => c.id !== id);
}

// --- Ausflüge ---
const showExcursionForm = ref(false);
const emptyExcursionForm = () => ({ title: '', image_url: '', note: '', date: '', spot_ids: [] as number[] });
const excursionForm = ref(emptyExcursionForm());

const editingExcursion = ref<number | null>(null);
const editExcursionForm = ref(emptyExcursionForm());

const unplannedExcursions = computed(() => excursionsStore.excursions.filter((e) => !e.date));
const plannedExcursions = computed(() =>
  [...excursionsStore.excursions].filter((e) => e.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
);

function closeExcursionForm() {
  showExcursionForm.value = false;
  excursionForm.value = emptyExcursionForm();
}

async function addExcursion() {
  if (!excursionForm.value.title.trim()) return;
  await excursionsStore.create({
    title: excursionForm.value.title.trim(),
    image_url: excursionForm.value.image_url || undefined,
    note: excursionForm.value.note || undefined,
    date: excursionForm.value.date || undefined,
    spot_ids: excursionForm.value.spot_ids,
  });
  closeExcursionForm();
}

function startEditExcursion(excursion: { id: number; title: string; image_url: string | null; note: string | null; date: string | null; spot_ids: number[] }) {
  editingExcursion.value = excursion.id;
  editExcursionForm.value = {
    title: excursion.title,
    image_url: excursion.image_url ?? '',
    note: excursion.note ?? '',
    date: excursion.date ?? '',
    spot_ids: [...excursion.spot_ids],
  };
}

async function submitEditExcursion() {
  if (editingExcursion.value == null || !editExcursionForm.value.title.trim()) return;
  await excursionsStore.update(editingExcursion.value, {
    title: editExcursionForm.value.title.trim(),
    image_url: editExcursionForm.value.image_url || undefined,
    note: editExcursionForm.value.note || undefined,
    date: editExcursionForm.value.date || undefined,
    spot_ids: editExcursionForm.value.spot_ids,
  });
  editingExcursion.value = null;
}

async function removeExcursion(id: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === id);
  if (excursion?.date) {
    const confirmed = window.confirm(
      'Dieser Ausflug ist bereits im Kalender eingeplant. Wirklich löschen? Die zugeordneten Spots bleiben erhalten und werden nicht mitgelöscht.',
    );
    if (!confirmed) return;
  }
  await excursionsStore.remove(id);
}

// Spot per Drag&Drop aus der Spots-Sicht auf eine Ausflug-Karte fallen lassen: als Station
// hinzufügen (ExcursionCard.vue ist die Drop-Zone, emittiert die abgelegte Spot-Id).
async function addSpotToExcursion(excursionId: number, spotId: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  if (!excursion || excursion.spot_ids.includes(spotId)) return;
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    spot_ids: [...excursion.spot_ids, spotId],
  });
}

// --- Abgeleitete Orte (Unterkunft, Reise-Start-/Zielorte) ---
// Automatisch als feste Karten in die Spots-Übersicht eingebettet (DerivedLocationCard.vue) –
// zeigt Orte, die bereits anderswo (Unterkunft, Reise) mit Koordinaten hinterlegt sind, damit man
// z. B. die Unterkunft oder einen Reise-Zielort direkt per Drag&Drop einem Ausflug als Station
// hinzufügen kann, ohne sie vorher manuell als Spot anzulegen.
const derivedLocations = computed<DerivedLocation[]>(() => {
  const result: DerivedLocation[] = [];
  for (const a of accommodations.value) {
    if (a.lat != null && a.lng != null) {
      result.push({ key: `accommodation-${a.id}`, title: a.name, icon: '🛏️', category: 'Unterkunft', maps_link: a.maps_link, lat: a.lat, lng: a.lng });
    }
  }
  for (const t of travelItems.value) {
    if (t.from_lat != null && t.from_lng != null) {
      result.push({
        key: `travel-from-${t.id}`,
        title: `${t.title} (Abflug/Abfahrt)`,
        icon: '🛫',
        category: 'Reise',
        maps_link: t.from_maps_link,
        lat: t.from_lat,
        lng: t.from_lng,
      });
    }
    if (t.to_lat != null && t.to_lng != null) {
      result.push({
        key: `travel-to-${t.id}`,
        title: `${t.title} (Ankunft)`,
        icon: '🛬',
        category: 'Reise',
        maps_link: t.to_maps_link,
        lat: t.to_lat,
        lng: t.to_lng,
      });
    }
  }
  return result;
});

// Wiederverwenden, falls für diesen Ort (per Maps-Link) schon einmal ein Spot angelegt wurde,
// sonst neu anlegen – so entstehen keine Duplikate, wenn derselbe Ort in mehrere Ausflüge
// einsortiert wird. Von zwei Stellen genutzt: direktes Ablegen auf einer Ausflug-Karte
// (addDerivedLocationToExcursion, sofort persistiert) UND Auswahl im Anlege-/Bearbeiten-Dialog
// (pickDerivedLocationForForm, landet erstmal nur im lokalen Formular).
async function resolveDerivedLocationSpot(loc: DerivedLocation): Promise<Spot> {
  let spot = loc.maps_link ? spots.value.find((s) => s.maps_link === loc.maps_link) : undefined;
  if (!spot) {
    spot = await api.post<Spot>('/spots', {
      trip_id: tripId,
      title: loc.title,
      category: loc.category,
      maps_link: loc.maps_link || undefined,
      lat: loc.lat,
      lng: loc.lng,
    });
    spots.value.unshift(spot);
  }
  return spot;
}

// Beim Ablegen auf einer Ausflug-Karte (Drag&Drop außerhalb des Dialogs): sofort speichern.
async function addDerivedLocationToExcursion(excursionId: number, loc: DerivedLocation) {
  const spot = await resolveDerivedLocationSpot(loc);
  await addSpotToExcursion(excursionId, spot.id);
}

// Auswahl im Anlege-/Bearbeiten-Dialog (SpotOrderPicker): der Spot wird zwar sofort angelegt/
// wiederverwendet (dedupliziert über den Maps-Link), die Ausflug-Zuordnung selbst bleibt aber wie
// bei jedem anderen Spot-Häkchen lokal im Formular, bis "Speichern" gedrückt wird. Zwei separate
// Funktionen statt einer mit Ref-Parameter, da eine im Template übergebene Ref dort automatisch
// entpackt wird (Vue unwrappt Top-Level-Refs in Template-Ausdrücken) und dann nicht mehr als Ref
// beim Funktionsaufruf ankäme.
async function pickDerivedLocationForNewForm(loc: DerivedLocation) {
  const spot = await resolveDerivedLocationSpot(loc);
  if (!excursionForm.value.spot_ids.includes(spot.id)) excursionForm.value.spot_ids.push(spot.id);
}
async function pickDerivedLocationForEditForm(loc: DerivedLocation) {
  const spot = await resolveDerivedLocationSpot(loc);
  if (!editExcursionForm.value.spot_ids.includes(spot.id)) editExcursionForm.value.spot_ids.push(spot.id);
}

// Drop-Zone, um die Kalender-Einplanung rückgängig zu machen: ein geplanter Ausflug kann aus dem
// "Geplant"-Bereich (oder direkt aus der Kalender-Schublade) hierher zurückgezogen werden.
// Zähler statt Boolean, da dragenter/dragleave beim Überqueren von Kind-Elementen mehrfach feuern.
const unplannedDragOverCount = ref(0);
const unplannedDragOver = computed(() => unplannedDragOverCount.value > 0);

// dataTransfer.types ist (anders als getData) schon bei dragenter/dragleave verfügbar – damit
// reagiert die Sektion nur auf Ausflug-Drags. Ohne diesen Check würde beim Ziehen eines Spots
// über eine einzelne Ausflug-Karte hinweg (dropSpot-Feature) die ganze Sektion grün aufleuchten,
// weil dragenter/dragleave von Kind-Elementen an den umschließenden Container durchbubbeln.
function isExcursionDrag(event: DragEvent) {
  return !!event.dataTransfer?.types.includes('text/excursion-id');
}

function onUnplannedDragEnter(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  unplannedDragOverCount.value++;
}
function onUnplannedDragLeave(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  unplannedDragOverCount.value = Math.max(0, unplannedDragOverCount.value - 1);
}
function onUnplannedDrop(event: DragEvent) {
  unplannedDragOverCount.value = 0;
  const raw = event.dataTransfer?.getData('text/excursion-id');
  if (!raw) return;
  excursionsStore.setDate(Number(raw), null);
}

// "Geplant" bekommt dieselbe Dropzone-Optik wie "In Planung" – ein Ausflug wird beim Ziehen
// weiterhin nur auf DIESE beiden Status-Bereiche fallen gelassen, nie auf einzelne Ausflug-Karten
// (siehe isSpotDrag-Check in ExcursionCard.vue). Ein konkretes Datum lässt sich aus einem Drop
// hier aber nicht herleiten (das passiert weiterhin per Drag in die Kalender-Schublade) – der
// Drop selbst bleibt daher bewusst folgenlos, nur der Zähler wird zurückgesetzt.
const plannedDragOverCount = ref(0);
const plannedDragOver = computed(() => plannedDragOverCount.value > 0);

function onPlannedDragEnter(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  plannedDragOverCount.value++;
}
function onPlannedDragLeave(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  plannedDragOverCount.value = Math.max(0, plannedDragOverCount.value - 1);
}
function onPlannedDrop() {
  plannedDragOverCount.value = 0;
}

// --- Spots ---
const showSpotForm = ref(false);
const emptySpotForm = () => ({ title: '', image_url: '', maps_link: '', note: '', category: '' });
const spotForm = ref(emptySpotForm());
const spotMapsLinkResolved = ref<boolean | null>(null);

const editingSpot = ref<Spot | null>(null);
const editSpotForm = ref(emptySpotForm());
const editSpotMapsLinkResolved = ref<boolean | null>(null);

// Live-Vorschau im Anlege-/Bearbeiten-Dialog (Bild-Banner, wie bei der Card): eigenes Bild, sonst
// Kachel-Vorschau der Koordinate, sofern der Maps-Link clientseitig parsbar ist (bei Kurzlinks
// erst nach dem Speichern möglich, siehe resolveLatLng serverseitig).
const spotPreviewImage = computed(() => {
  if (spotForm.value.image_url) return spotForm.value.image_url;
  const parsed = parseLatLngFromMapsLink(spotForm.value.maps_link);
  return parsed ? tilePreviewUrl(parsed.lat, parsed.lng) : null;
});
const editSpotPreviewImage = computed(() => {
  if (editSpotForm.value.image_url) return editSpotForm.value.image_url;
  const parsed = parseLatLngFromMapsLink(editSpotForm.value.maps_link);
  return parsed ? tilePreviewUrl(parsed.lat, parsed.lng) : null;
});

function spotLikeCount(spotId: number) {
  return spotLikesFor(spotId).length;
}

const spotCategoryOptions = computed(() => {
  const used = spots.value.map((s) => s.category).filter((c): c is string => !!c);
  return [...new Set([...SPOT_CATEGORY_SUGGESTIONS, ...used])];
});

// --- Sortierung, Kategorie-Filter & -Gruppierung der Spots-Übersicht ---
// Ein "Spots-Item" ist entweder ein echter Spot oder ein abgeleiteter Ort (Unterkunft/Reise) – beide
// werden gemeinsam sortiert, gefiltert und nach Kategorie gruppiert dargestellt.
type SpotsGroupItem = { kind: 'spot'; spot: Spot } | { kind: 'derived'; loc: DerivedLocation };

function itemCategory(item: SpotsGroupItem): string {
  return item.kind === 'spot' ? item.spot.category ?? 'Sonstiges' : item.loc.category;
}
function itemTitle(item: SpotsGroupItem): string {
  return item.kind === 'spot' ? item.spot.title : item.loc.title;
}
function itemLikeCount(item: SpotsGroupItem): number {
  return item.kind === 'spot' ? spotLikeCount(item.spot.id) : 0;
}
// Unterkunft/Reise sind keine "echten" Spot-Kategorien (spotCategoryMeta kennt sie nicht) – eigenes
// Icon je Sammel-Kategorie, sonst wie gewohnt über spotCategoryMeta (inkl. 📍-Fallback).
function groupIcon(category: string): string {
  if (category === 'Unterkunft') return '🛏️';
  if (category === 'Reise') return '🧳';
  return spotCategoryMeta(category).icon;
}

const sortMenuOpen = ref(false);
const sortMode = ref<'alpha' | 'likes'>('alpha');

const categoryMenuOpen = ref(false);
const categoryFilter = ref<string[]>([]);
function removeCategoryFilter(cat: string) {
  categoryFilter.value = categoryFilter.value.filter((c) => c !== cat);
}

const allSpotItems = computed<SpotsGroupItem[]>(() => [
  ...spots.value.map((spot): SpotsGroupItem => ({ kind: 'spot', spot })),
  ...derivedLocations.value.map((loc): SpotsGroupItem => ({ kind: 'derived', loc })),
]);

const filteredSpotItems = computed(() =>
  categoryFilter.value.length === 0
    ? allSpotItems.value
    : allSpotItems.value.filter((item) => categoryFilter.value.includes(itemCategory(item))),
);

// Reihenfolge der Gruppen: die automatisch eingebetteten Unterkunft-/Reise-Orte zuerst (sind
// bereits anderswo gepflegt, sollen als "kostenloser" Ausgangspunkt sofort ins Auge fallen), dann
// bekannte Spot-Kategorien (spotCategory.ts-Reihenfolge), dann eigene Freitext-Kategorien
// alphabetisch, "Sonstiges" (keine Kategorie) zuletzt – bleibt unabhängig von der gewählten
// Sortierung innerhalb der Gruppen stabil.
const CATEGORY_GROUP_ORDER = ['Unterkunft', 'Reise', ...SPOT_CATEGORY_SUGGESTIONS];

function sortedCategoryKeys(categories: Iterable<string>): string[] {
  const set = new Set(categories);
  const known = CATEGORY_GROUP_ORDER.filter((c) => set.has(c));
  const custom = [...set].filter((c) => !CATEGORY_GROUP_ORDER.includes(c) && c !== 'Sonstiges').sort();
  return [...known, ...custom, ...(set.has('Sonstiges') ? ['Sonstiges'] : [])];
}

const spotGroups = computed(() => {
  const groups = new Map<string, SpotsGroupItem[]>();
  for (const item of filteredSpotItems.value) {
    const cat = itemCategory(item);
    const list = groups.get(cat) ?? [];
    list.push(item);
    groups.set(cat, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) =>
      sortMode.value === 'likes'
        ? itemLikeCount(b) - itemLikeCount(a) || itemTitle(a).localeCompare(itemTitle(b))
        : itemTitle(a).localeCompare(itemTitle(b)),
    );
  }
  return sortedCategoryKeys(groups.keys()).map((category) => ({
    category,
    icon: groupIcon(category),
    items: groups.get(category)!,
  }));
});

const filterCategoryOptions = computed(() => sortedCategoryKeys(allSpotItems.value.map(itemCategory)));

function checkSpotMapsLink() {
  spotMapsLinkResolved.value = spotForm.value.maps_link ? parseLatLngFromMapsLink(spotForm.value.maps_link) != null : null;
}
function checkEditSpotMapsLink() {
  editSpotMapsLinkResolved.value = editSpotForm.value.maps_link
    ? parseLatLngFromMapsLink(editSpotForm.value.maps_link) != null
    : null;
}

function spotToBody(f: ReturnType<typeof emptySpotForm>) {
  const parsed = parseLatLngFromMapsLink(f.maps_link);
  return {
    trip_id: tripId,
    title: f.title.trim(),
    image_url: f.image_url || undefined,
    category: f.category || undefined,
    note: f.note || undefined,
    maps_link: f.maps_link || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
  };
}

function closeSpotForm() {
  showSpotForm.value = false;
  spotForm.value = emptySpotForm();
  spotMapsLinkResolved.value = null;
}

async function addSpot() {
  if (!spotForm.value.title.trim()) return;
  const created = await api.post<Spot>('/spots', spotToBody(spotForm.value));
  spots.value.unshift(created);
  drawers.touchLocations();
  closeSpotForm();
}

function startEditSpot(spot: Spot) {
  editingSpot.value = spot;
  editSpotForm.value = {
    title: spot.title,
    image_url: spot.image_url ?? '',
    maps_link: spot.maps_link ?? '',
    note: spot.note ?? '',
    category: spot.category ?? '',
  };
  editSpotMapsLinkResolved.value = null;
}

async function submitEditSpot() {
  if (!editingSpot.value || !editSpotForm.value.title.trim()) return;
  const updated = await api.put<Spot>(`/spots/${editingSpot.value.id}`, spotToBody(editSpotForm.value));
  const idx = spots.value.findIndex((s) => s.id === updated.id);
  if (idx !== -1) spots.value[idx] = updated;
  drawers.touchLocations();
  editingSpot.value = null;
}

async function removeSpot(id: number) {
  await api.delete(`/spots/${id}`);
  spots.value = spots.value.filter((s) => s.id !== id);
  drawers.touchLocations();
}

function showSpotOnMap(spot: Spot) {
  drawers.openMapAt(`spot-${spot.id}`);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="layout">
    <div class="excursions-col">
    <div class="header">
      <h1>Ausflüge</h1>
      <button @click="showExcursionForm = true">+ Neuer Ausflug</button>
    </div>

    <Modal :model-value="showExcursionForm" title="Neuer Ausflug" @update:model-value="(v) => !v && closeExcursionForm()">
      <form class="edit-form" @submit.prevent="addExcursion">
        <input v-model="excursionForm.title" type="text" placeholder="Titel" required />
        <input v-model="excursionForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <textarea v-model="excursionForm.note" placeholder="Notiz (optional)" rows="4"></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
          automatisch erkannt
        </p>
        <label class="date-label">
          Datum (optional – ansonsten "In Planung")
          <input v-model="excursionForm.date" type="date" />
        </label>
        <SpotOrderPicker
          v-if="spots.length || derivedLocations.length"
          v-model="excursionForm.spot_ids"
          :spots="spots"
          :like-count="spotLikeCount"
          :derived-locations="derivedLocations"
          @pick-derived-location="pickDerivedLocationForNewForm"
        />
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <section
      class="group dropzone"
      :class="{ 'drag-over': unplannedDragOver }"
      @dragover.prevent
      @dragenter.prevent="onUnplannedDragEnter"
      @dragleave="onUnplannedDragLeave"
      @drop.prevent="onUnplannedDrop"
    >
      <h2>📝 In Planung</h2>
      <TransitionGroup v-if="unplannedExcursions.length" tag="div" name="list" class="entries">
        <ExcursionCard
          v-for="excursion in unplannedExcursions"
          :key="excursion.id"
          :excursion="excursion"
          :creator-label="creatorLabel(excursion.created_by)"
          :like-count="likesFor(excursion.id).length"
          :liked="likedByMe(excursion.id)"
          :comments="commentItemsFor(excursion.id)"
          :stations="stationsFor(excursion.spot_ids)"
          @edit="startEditExcursion"
          @remove="removeExcursion"
          @toggle-like="toggleLike(excursion.id)"
          @submit-comment="(content) => submitComment(excursion.id, content)"
          @remove-comment="removeComment"
          @drop-spot="(spotId) => addSpotToExcursion(excursion.id, spotId)"
          @drop-derived-location="(loc) => addDerivedLocationToExcursion(excursion.id, loc as DerivedLocation)"
          @show-on-map="drawers.openMapForExcursion(excursion.id)"
        />
      </TransitionGroup>
      <p v-else class="empty dropzone-hint">
        Noch keine Ausflüge in Planung – geplante Ausflüge kannst du hierher ziehen, um die
        Einplanung rückgängig zu machen.
      </p>
    </section>

    <section
      class="group dropzone"
      :class="{ 'drag-over': plannedDragOver }"
      v-if="plannedExcursions.length"
      @dragover.prevent
      @dragenter.prevent="onPlannedDragEnter"
      @dragleave="onPlannedDragLeave"
      @drop.prevent="onPlannedDrop"
    >
      <h2>📅 Geplant</h2>
      <TransitionGroup tag="div" name="list" class="entries">
        <ExcursionCard
          v-for="excursion in plannedExcursions"
          :key="excursion.id"
          :excursion="excursion"
          :creator-label="creatorLabel(excursion.created_by)"
          :like-count="likesFor(excursion.id).length"
          :liked="likedByMe(excursion.id)"
          :comments="commentItemsFor(excursion.id)"
          :stations="stationsFor(excursion.spot_ids)"
          @edit="startEditExcursion"
          @remove="removeExcursion"
          @toggle-like="toggleLike(excursion.id)"
          @submit-comment="(content) => submitComment(excursion.id, content)"
          @remove-comment="removeComment"
          @drop-spot="(spotId) => addSpotToExcursion(excursion.id, spotId)"
          @drop-derived-location="(loc) => addDerivedLocationToExcursion(excursion.id, loc as DerivedLocation)"
          @show-on-map="drawers.openMapForExcursion(excursion.id)"
        />
      </TransitionGroup>
    </section>
    <p v-if="!excursionsStore.excursions.length" class="empty">Noch keine Ausflüge angelegt.</p>

    <Modal
      :model-value="editingExcursion !== null"
      title="Ausflug bearbeiten"
      @update:model-value="(v) => !v && (editingExcursion = null)"
    >
      <form class="edit-form" @submit.prevent="submitEditExcursion">
        <input v-model="editExcursionForm.title" type="text" placeholder="Titel" required />
        <input v-model="editExcursionForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <textarea v-model="editExcursionForm.note" placeholder="Notiz (optional)" rows="4"></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
          automatisch erkannt
        </p>
        <label class="date-label">
          Datum (optional – ansonsten "In Planung")
          <input v-model="editExcursionForm.date" type="date" />
        </label>
        <SpotOrderPicker
          v-if="spots.length || derivedLocations.length"
          v-model="editExcursionForm.spot_ids"
          :spots="spots"
          :like-count="spotLikeCount"
          :derived-locations="derivedLocations"
          @pick-derived-location="pickDerivedLocationForEditForm"
        />
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    </div>

    <div class="spots-col">
    <div class="header">
      <h2>Spots</h2>
      <div class="header-actions">
        <div class="dropdown">
          <button
            type="button"
            class="secondary sort-btn"
            title="Sortierung ändern"
            aria-label="Sortierung ändern"
            @click="sortMenuOpen = !sortMenuOpen"
          >
            🔀 {{ sortMode === 'likes' ? 'Nach Likes' : 'Alphabetisch' }}
          </button>
          <template v-if="sortMenuOpen">
            <div class="picker-backdrop" @click="sortMenuOpen = false"></div>
            <div class="picker-menu">
              <button type="button" :class="{ active: sortMode === 'alpha' }" @click="sortMode = 'alpha'; sortMenuOpen = false">
                🔤 Alphabetisch
              </button>
              <button type="button" :class="{ active: sortMode === 'likes' }" @click="sortMode = 'likes'; sortMenuOpen = false">
                ❤️ Nach Likes
              </button>
            </div>
          </template>
        </div>
        <button @click="showSpotForm = true">+ Neuer Spot</button>
      </div>
    </div>
    <p class="hint">
      Orte (Restaurant, Sehenswürdigkeit, Strand, …), die du als Stationen bei Ausflügen zuordnen kannst –
      auch unabhängig von einem Ausflug. Tipp: Ziehe eine Spot-Karte direkt auf einen Ausflug weiter oben,
      um sie dort als Station hinzuzufügen.
    </p>

    <div class="filter-bar" v-if="filterCategoryOptions.length">
      <div class="filter-chips">
        <span v-for="cat in categoryFilter" :key="cat" class="filter-chip">
          {{ groupIcon(cat) }} {{ cat }}
          <button type="button" @click="removeCategoryFilter(cat)" aria-label="Filter entfernen">✕</button>
        </span>
      </div>
      <div class="dropdown">
        <button
          type="button"
          class="secondary category-btn"
          title="Nach Kategorie filtern"
          aria-label="Nach Kategorie filtern"
          @click="categoryMenuOpen = !categoryMenuOpen"
        >
          🏷️ Kategorie
        </button>
        <template v-if="categoryMenuOpen">
          <div class="picker-backdrop" @click="categoryMenuOpen = false"></div>
          <div class="picker-menu category-menu">
            <label v-for="cat in filterCategoryOptions" :key="cat" class="category-option">
              <input type="checkbox" :value="cat" v-model="categoryFilter" />
              {{ groupIcon(cat) }} {{ cat }}
            </label>
          </div>
        </template>
      </div>
    </div>

    <Modal :model-value="showSpotForm" title="Neuer Spot" @update:model-value="(v) => !v && closeSpotForm()">
      <form class="edit-form" @submit.prevent="addSpot">
        <div class="form-image-banner" :style="spotPreviewImage ? { backgroundImage: `url(${spotPreviewImage})` } : {}">
          <span v-if="!spotPreviewImage" class="placeholder">{{ spotCategoryMeta(spotForm.category).icon }}</span>
        </div>
        <input v-model="spotForm.title" type="text" placeholder="Titel" required />
        <input v-model="spotForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <Combobox v-model="spotForm.category" :options="spotCategoryOptions" placeholder="Kategorie (optional)" />
        <input
          v-model="spotForm.maps_link"
          type="url"
          placeholder="Maps-Link (Google/Apple) (optional)"
          @blur="checkSpotMapsLink"
        />
        <p v-if="spotMapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
        <p v-if="spotMapsLinkResolved === false" class="hint">
          Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks funktionieren).
        </p>
        <textarea v-model="spotForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <section class="group category-group" v-for="grp in spotGroups" :key="grp.category">
      <h3 class="category-heading">{{ grp.icon }} {{ grp.category }}</h3>
      <TransitionGroup tag="div" name="list" class="grid cards">
        <template v-for="item in grp.items" :key="item.kind === 'spot' ? `spot-${item.spot.id}` : item.loc.key">
          <SpotCard
            v-if="item.kind === 'spot'"
            :key="`spot-${item.spot.id}`"
            :spot="item.spot"
            :creator-label="creatorLabel(item.spot.created_by)"
            :like-count="spotLikeCount(item.spot.id)"
            :liked="spotLikedByMe(item.spot.id)"
            :comments="spotCommentItemsFor(item.spot.id)"
            @edit="startEditSpot"
            @remove="removeSpot"
            @show-on-map="showSpotOnMap"
            @toggle-like="toggleSpotLike(item.spot.id)"
            @submit-comment="(content) => submitSpotComment(item.spot.id, content)"
            @remove-comment="removeSpotComment"
          />
          <DerivedLocationCard v-else :key="item.loc.key" :location="item.loc" />
        </template>
      </TransitionGroup>
    </section>
    <p v-if="!spotGroups.length" class="empty">Noch keine Spots angelegt.</p>

    <Modal
      :model-value="editingSpot !== null"
      title="Spot bearbeiten"
      @update:model-value="(v) => !v && (editingSpot = null)"
    >
      <form class="edit-form" @submit.prevent="submitEditSpot">
        <div class="form-image-banner" :style="editSpotPreviewImage ? { backgroundImage: `url(${editSpotPreviewImage})` } : {}">
          <span v-if="!editSpotPreviewImage" class="placeholder">{{ spotCategoryMeta(editSpotForm.category).icon }}</span>
        </div>
        <input v-model="editSpotForm.title" type="text" placeholder="Titel" required />
        <input v-model="editSpotForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <Combobox v-model="editSpotForm.category" :options="spotCategoryOptions" placeholder="Kategorie (optional)" />
        <input
          v-model="editSpotForm.maps_link"
          type="url"
          placeholder="Maps-Link (Google/Apple) (optional)"
          @blur="checkEditSpotMapsLink"
        />
        <p v-if="editSpotMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
        <p v-if="editSpotMapsLinkResolved === false" class="hint">
          Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks funktionieren).
        </p>
        <textarea v-model="editSpotForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
        <button type="submit">Speichern</button>
      </form>
    </Modal>
    </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-image-banner {
  height: 140px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-image-banner .placeholder {
  font-size: 2.2rem;
}

.syntax-hint {
  margin: -4px 0 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.syntax-hint code {
  background: var(--color-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.78rem;
}

.date-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.group {
  margin-bottom: var(--space-4);
}

.dropzone {
  border: 2px dashed transparent;
  border-radius: var(--radius-md);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dropzone.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.dropzone-hint {
  font-size: 0.85rem;
}

.group h2,
.group h3 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-3);
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.spots-col {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  margin-top: var(--space-4);
}

/* Nebeneinander statt untereinander, sobald genug Breite verfügbar ist (z. B. beide Schubladen
   eingeklappt) – erleichtert das Drag&Drop von Spots auf Ausflüge, da beide Bereiche dann ohne
   Scrollen gleichzeitig sichtbar sind. Container-Query statt @media, da sich die verfügbare
   Breite durchs Auf-/Zuklappen der Schubladen ändert, ohne dass sich das Browserfenster ändert
   (der Container ist .app-main in App.vue, nicht diese Seite selbst). Zusätzlich wird hier auch
   .page breiter gemacht – dessen normaler max-width:960px-Deckel (style.css, für die einspaltige
   Lesbarkeit auf allen anderen Seiten gedacht) würde die zwei Spalten sonst weiterhin auf denselben
   schmalen Streifen zusammenquetschen, obwohl links/rechts noch reichlich Platz frei wäre. */
@container (min-width: 900px) {
  .page {
    max-width: 1400px;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: 0 var(--space-5);
  }

  /* Beide Spalten scrollen ab hier unabhängig voneinander statt gemeinsam mit der Seite – dieselbe
     Sticky-Offset-Formel wie Drawer.vue's Desktop-Panel (56px NavBar + evtl. zusätzlicher
     --navbar-offset, falls die NavBar selbst "oben" positioniert ist). */
  .excursions-col,
  .spots-col {
    position: sticky;
    top: calc(56px + var(--navbar-offset, 0px));
    max-height: calc(100vh - 56px - var(--navbar-offset, 0px));
    overflow-y: auto;
  }

  .spots-col {
    border-top: none;
    border-left: 1px solid var(--color-border);
    padding-top: 0;
    padding-left: var(--space-5);
    margin-top: 0;
  }
}

.dropdown {
  position: relative;
}

.sort-btn.active,
.category-btn.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 180px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu button {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 0.85rem;
  white-space: nowrap;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
}

.picker-menu button:hover {
  background: var(--color-hover);
}

.picker-menu button.active {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.category-menu {
  min-width: 220px;
}

.category-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 8px;
  font-size: 0.9rem;
  font-weight: 400;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.category-option:hover {
  background: var(--color-hover);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-tint);
  border: 1px solid var(--color-primary);
  color: var(--color-primary-dark);
  border-radius: 999px;
  padding: 3px 6px 3px 12px;
  font-size: 0.82rem;
  font-weight: 600;
}

.filter-chip button {
  background: none;
  border: none;
  padding: 2px;
  color: inherit;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  display: flex;
}

.category-btn {
  font-size: 0.85rem;
}

.category-heading {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty {
  color: var(--color-text-muted);
}
</style>
