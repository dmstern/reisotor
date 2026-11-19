import { db } from '../db/index.js';

const selectPublishedDiaryIdsForTripStmt = db.prepare(
  'SELECT id FROM diary_entries WHERE trip_id = ? AND is_draft = 0 AND deleted_at IS NULL'
);

const selectPublishedExcursionDiaryLinksStmt = db.prepare(
  `SELECT de.entry_id
   FROM diary_excursions de
   JOIN diary_entries e ON e.id = de.entry_id
   WHERE de.idea_id = ? AND e.trip_id = ? AND e.is_draft = 0 AND e.deleted_at IS NULL`
);

const deletePublishedExcursionDiaryLinksStmt = db.prepare(
  `DELETE FROM diary_excursions
   WHERE idea_id = ?
     AND entry_id IN (
       SELECT id FROM diary_entries WHERE trip_id = ? AND is_draft = 0 AND deleted_at IS NULL
     )`
);

const insertDiaryExcursionStmt = db.prepare(
  'INSERT OR IGNORE INTO diary_excursions (entry_id, idea_id) VALUES (?, ?)'
);

const selectPublishedSpotDiaryLinksStmt = db.prepare(
  `SELECT ds.entry_id
   FROM diary_spots ds
   JOIN diary_entries e ON e.id = ds.entry_id
   WHERE ds.spot_id = ? AND e.trip_id = ? AND e.is_draft = 0 AND e.deleted_at IS NULL`
);

const deletePublishedSpotDiaryLinksStmt = db.prepare(
  `DELETE FROM diary_spots
   WHERE spot_id = ?
     AND entry_id IN (
       SELECT id FROM diary_entries WHERE trip_id = ? AND is_draft = 0 AND deleted_at IS NULL
     )`
);

const insertDiarySpotStmt = db.prepare(
  'INSERT OR IGNORE INTO diary_spots (entry_id, spot_id) VALUES (?, ?)'
);

function normalizeValidPublishedDiaryIds(tripId: number, diaryIds: number[]): number[] {
  const validIds = new Set(
    (selectPublishedDiaryIdsForTripStmt.all(tripId) as { id: number }[]).map((row) => row.id)
  );
  const deduplicated: number[] = [];
  const seen = new Set<number>();

  for (const rawId of diaryIds) {
    const parsedId = Number(rawId);

    if (!Number.isInteger(parsedId) || !validIds.has(parsedId) || seen.has(parsedId)) {
      continue;
    }

    seen.add(parsedId);
    deduplicated.push(parsedId);
  }

  return deduplicated;
}

function areIdSetsEqual(existingIds: number[], nextIds: number[]): boolean {
  if (existingIds.length !== nextIds.length) {
    return false;
  }

  const existingSet = new Set(existingIds);
  return nextIds.every((id) => existingSet.has(id));
}

export function syncPublishedDiaryLinksForIdea(
  ideaId: number,
  tripId: number,
  diaryIds: number[]
): boolean {
  const nextIds = normalizeValidPublishedDiaryIds(tripId, diaryIds);
  const existingIds = (
    selectPublishedExcursionDiaryLinksStmt.all(ideaId, tripId) as { entry_id: number }[]
  ).map((row) => row.entry_id);

  if (areIdSetsEqual(existingIds, nextIds)) {
    return false;
  }

  const syncTransaction = db.transaction(() => {
    deletePublishedExcursionDiaryLinksStmt.run(ideaId, tripId);

    for (const entryId of nextIds) {
      insertDiaryExcursionStmt.run(entryId, ideaId);
    }
  });

  syncTransaction();
  return true;
}

export function syncPublishedDiaryLinksForSpot(
  spotId: number,
  tripId: number,
  diaryIds: number[]
): boolean {
  const nextIds = normalizeValidPublishedDiaryIds(tripId, diaryIds);
  const existingIds = (
    selectPublishedSpotDiaryLinksStmt.all(spotId, tripId) as { entry_id: number }[]
  ).map((row) => row.entry_id);

  if (areIdSetsEqual(existingIds, nextIds)) {
    return false;
  }

  const syncTransaction = db.transaction(() => {
    deletePublishedSpotDiaryLinksStmt.run(spotId, tripId);

    for (const entryId of nextIds) {
      insertDiarySpotStmt.run(entryId, spotId);
    }
  });

  syncTransaction();
  return true;
}
