# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2026-03-31 - Pre-compiling SQLite Prepared Statements in Hot Paths

**Learning:** Calling `db.prepare(...)` repeatedly inside frequently executed helper functions (such as `isTripMember` called on every API request) incurs significant SQL parsing and statement preparation overhead. Re-using a top-level pre-compiled `Statement` instance yields ~10x faster execution (~0.001 ms vs ~0.011 ms per check).
**Action:** Always pre-compile SQLite statements outside function definitions for hot paths, middleware, and frequently invoked database checks.

## 2026-04-01 - Database Indexes for Hot Query Paths

**Learning:** SQLite queries filtering on `spots (trip_id, deleted_at)` and `trip_members (user_id)` were performing full table scans. While `trip_members` had a `UNIQUE(trip_id, user_id)` constraint, SQLite multi-column B-tree indexes only serve queries filtering by prefix (e.g. `trip_id`). Queries searching by `user_id` could not use that index efficiently.
**Action:** Always add explicit compound indexes tailored to query filter order (`spots(trip_id, deleted_at)` and `trip_members(user_id, trip_id)`).
