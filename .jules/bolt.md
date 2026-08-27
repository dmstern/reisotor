# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2025-05-18 - Database Indexes for Hot Query Paths
**Learning:** SQLite queries filtering on `spots (trip_id, deleted_at)` and `trip_members (user_id)` were performing full table scans. While `trip_members` had a `UNIQUE(trip_id, user_id)` constraint, SQLite multi-column B-tree indexes only serve queries filtering by prefix (e.g. `trip_id`). Queries searching by `user_id` could not use that index efficiently.
**Action:** Always add explicit compound indexes tailored to query filter order (`spots(trip_id, deleted_at)` and `trip_members(user_id, trip_id)`).
