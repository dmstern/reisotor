import { db } from './db/index.js';

export interface UploadRecord {
  id: number;
  filename: string;
  trip_id: number | null;
  uploaded_by: number | null;
  created_at: string;
}

const stmtInsertUpload = db.prepare(
  `INSERT OR IGNORE INTO uploads (filename, trip_id, uploaded_by, created_at)
   VALUES (?, ?, ?, ?)`
);

const stmtGetUploadsByFilename = db.prepare(
  'SELECT id, filename, trip_id, uploaded_by, created_at FROM uploads WHERE filename = ?'
);

const stmtDeleteUploadByFilename = db.prepare('DELETE FROM uploads WHERE filename = ?');

const stmtAssociateUploadWithTrip = db.prepare(
  `INSERT INTO uploads (filename, trip_id, uploaded_by, created_at)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(filename, trip_id) DO UPDATE SET
     uploaded_by = COALESCE(excluded.uploaded_by, uploads.uploaded_by)`
);

const stmtCleanNullTripUpload = db.prepare(
  'DELETE FROM uploads WHERE filename = ? AND trip_id IS NULL'
);

export function registerUpload(
  filename: string,
  tripId: number | null,
  uploadedBy: number | null
): void {
  stmtInsertUpload.run(filename, tripId, uploadedBy, new Date().toISOString());
}

export function getUploads(filename: string): UploadRecord[] {
  return stmtGetUploadsByFilename.all(filename) as UploadRecord[];
}

export function deleteUpload(filename: string): void {
  stmtDeleteUploadByFilename.run(filename);
}

export function associateUploadWithTrip(
  filename: string,
  tripId: number,
  uploadedBy: number | null = null
): void {
  stmtAssociateUploadWithTrip.run(filename, tripId, uploadedBy, new Date().toISOString());
  stmtCleanNullTripUpload.run(filename);
}
