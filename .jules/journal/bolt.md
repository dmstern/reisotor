# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2026-03-31 - Pre-compiling SQLite Prepared Statements in Hot Paths

**Learning:** Calling `db.prepare(...)` repeatedly inside frequently executed helper functions (such as `isTripMember` called on every API request) incurs significant SQL parsing and statement preparation overhead. Re-using a top-level pre-compiled `Statement` instance yields ~10x faster execution (~0.001 ms vs ~0.011 ms per check).
**Action:** Always pre-compile SQLite statements outside function definitions for hot paths, middleware, and frequently invoked database checks.

## 2026-04-01 - Database Indexes for Hot Query Paths

**Learning:** SQLite queries filtering on `spots (trip_id, deleted_at)` and `trip_members (user_id)` were performing full table scans. While `trip_members` had a `UNIQUE(trip_id, user_id)` constraint, SQLite multi-column B-tree indexes only serve queries filtering by prefix (e.g. `trip_id`). Queries searching by `user_id` could not use that index efficiently.
**Action:** Always add explicit compound indexes tailored to query filter order (`spots(trip_id, deleted_at)` and `trip_members(user_id, trip_id)`).

## 2026-04-02 - Single-pass & Map-based Batch Resolution for Calendar Entries

**Learning:** `buildAllEntries` previously performed repeated $O(M)$ linear searches (`.find()`) across `spots`, `excursions`, and `travelItems` for every schedule item, resolving excursion stations twice per item (once for `icon` and once for `iconDef`). Passing pre-built `Map` lookups and consolidating `icon` and `iconDef` resolution into a single pass converts $O(N \cdot (M + K))$ processing into $O(N + M + K)$.
**Action:** When mapping over items that reference relational datasets in pure utility functions, pre-construct `Map` lookup tables for batch operations and resolve co-dependent properties in a single pass.

## 2026-09-04 - Store Reactivity with shallowRef for Dataset Lists

**Learning:** Pinia stores managing dataset collections using deep `ref<T[]>` force Vue to recursively observe all properties of every item. Converting these to `shallowRef<T[]>` avoids deep proxy wrapping overhead while maintaining reactive updates when assigning new array references on mutations.
**Action:** Use `shallowRef` for array data properties in Pinia stores and update store mutation helpers to assign new array instances (`list.value = [...list.value, item]` or `const next = [...list.value]; next[idx] = updated; list.value = next;`).
