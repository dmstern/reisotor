## 2026-03-31 - Pre-compiling SQLite Prepared Statements in Hot Paths
**Learning:** Calling `db.prepare(...)` repeatedly inside frequently executed helper functions (such as `isTripMember` called on every API request) incurs significant SQL parsing and statement preparation overhead. Re-using a top-level pre-compiled `Statement` instance yields ~10x faster execution (~0.001 ms vs ~0.011 ms per check).
**Action:** Always pre-compile SQLite statements outside function definitions for hot paths, middleware, and frequently invoked database checks.
