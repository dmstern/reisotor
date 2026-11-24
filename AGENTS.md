# AGENTS.md

Guidance für AI Coding Agents in diesem Repository. Reisotor ist eine Vue 3 + Fastify-Web-App zur gemeinsamen Reiseplanung. Registrierung ist offen (`routes/auth.ts`), Trip-Zugriff erfolgt per Mitgliedschaft (`trip_members`). Siehe `README.md` (Features/Setup), `DEPLOYMENT.md` (Server/Env-Vars) und **`ARCHITECTURE.md`** (vollständige Architektur + **Code-Map**: vor blindem Explorieren gezielt lesen).

## Setup & Befehle

Alle Skripte liegen zentral in [`package.json`](package.json) (`npm run dev`, `test`, `build`, `typecheck`, `lint`, `format`, `seed` etc.). Voraussetzungen: Node.js 24+ und `make`/`gcc`/`python3` (`better-sqlite3`, `bcrypt`).

- **Einzelne Tests (strikte Pflicht):** Backend: `npx -y vitest run backend/test/<pfad> --bail 1` bzw. `npx -y vitest run -t "<name>" --bail 1`; Frontend: `npm --prefix frontend test -- <pfad> --bail 1`; E2E: `npx -y playwright test <spec>`. **Niemals** ganze Test-Suiten im Chat ausführen.

## Parallele Sessions & Worktree-Disziplin

- **Pre-Flight-Check (Pflicht vor Edits):** `git status --porcelain` prüfen. Bei uncommitteten Fremdänderungen **niemals** blind überschreiben, zurücksetzen (`git restore`/`checkout`) oder in eigenem Commit mischen — und **kein** LLM-Polling (Timer/Sleeps). Sofort stoppen, modifizierte Dateien nennen und Nutzer fragen.
- **Git Worktrees (Best Practice für Parallelität):** Separaten Worktree nutzen (`git worktree add ../reisotor-<task> -b <branch>` bzw. UI **„New Worktree“** / `Ctrl+.`), danach `npm run dev:fresh` (oder `npm run setup:worktree`).
- **Branch- & Clean-Exit-Pflicht:** **Niemals direkt auf `main` committen** (vorab `git checkout -b <type>/<slug>`). Am Ende immer formatieren, prüfen, semantisch committen, pushen und bei fehlendem PR (`gh pr view 2>/dev/null`) automatisch `gh pr create` ausführen. Worktree sauber hinterlassen.

## UI-Audits & Layout-Testing

Details und vollständige Prompts: [`docs/UI_AUDIT_GUIDE.md`](docs/UI_AUDIT_GUIDE.md) und [`docs/AUDIT_PROMPTS.md`](docs/AUDIT_PROMPTS.md).

- **Adversarial Audit:** `npm run test:audit` bzw. `AUDIT_ROUTE=<route> npm run test:audit` (nur bei dedizierten Audits oder expliziter Aufforderung, nicht bei Standard-Bugfixes).
- **`Release Audit Auto` / _„Mach ein Pre-Release Audit“_:** Haupt-Agent bleibt schlanker **Orchestrator** (liest keinen Komponenten-Code), ermittelt offene Teams 1–6 via `git log`/`gh pr view` und spawnt **strikt sequenziell (niemals parallel wegen Playwright-Ports & Git-Locks!)** je einen `self`-Subagenten (`TypeName: "self"`, `Workspace: "inherit"`). Danach einmalig `npm run check` + `npm run test:a11y`, `gh pr edit`, `git push` und konsolidierter Gesamtbericht.
- **Refactoring-Workflow (#446):** 1 gemeinsamer Branch/PR, frischer Chat pro Phase (`Refactor Assess: <datei>` [Phase 0 legt Draft-PR + Checkliste an] → `Refactor Phase 1–4: <datei>`). Folge-Chats MÜSSEN zuerst `gh pr view` lesen, Phase 2 bricht bei Skip-Marker sofort ab, nach jeder Phase: Commit + `gh pr edit` + nächsten aktiven Trigger ausgeben.

## Typecheck, Linting & Formatting

- Vor Commit gezielt prüfen: `npm run typecheck` (nie rohes `npx vue-tsc`; bei `vue-tsc` not found zuerst `cd frontend && npm install`) und `npx -y eslint <geänderte-datei>`.
- **Pflicht-Formatierung vor Commit:** `npx -y prettier --write <dateien>` (`npm run format` nur bei repo-weiten Änderungen).
- **Niemals `npx` ohne `-y` / `--yes`** (sonst Hänger ohne TTY).

## Clean Code, Software-Design & Konsistenz

- **Prinzipien:** SoC (Views → Darstellung, Pinia → globaler State, Composables/Utils → Logik, Primitives → generische UI, Backend → HTTP/DB), SRP, KISS, YAGNI, DRY.
- **Fokus:** Nur für die Aufgabe nötige Dateien anfassen, kein ungefragter Scope-Creep.
- **UI & Styling:** Keine CSS-Kopien zwischen Views (Primitives nutzen); `style.css` nur global; `DESIGN.md` beachten; Storybook (`*.stories.ts`) nur auf expliziten Wunsch; Standard-CSS statt Webkit-Präfixe (LightningCSS); für Badges/Pillen/Kreise immer `--radius-pill` (`9999px`) statt `border-radius: 50%`.
- **Tabler-Icons statt Emojis (strikt):** Für UI-Icons immer `<AppIcon :icon="..." />` (`utils/actionIcons.ts`, `utils/formFieldIcons.ts`) statt Unicode-Emojis. Ausnahmen nur: benutzerkonfigurierbare Wetter-/Kategorie-Icons (`stores/iconStyle.ts`) und `user.avatar`.
- **Breakpoints:** Keine willkürlichen Pixelwerte — immer Mixins aus `src/styles/_breakpoints.scss` (`media-up`/`down`, `container-down`, `container-app-main-down`) bzw. `BREAKPOINTS` aus `src/tokens/breakpoints.ts` (`mobile-compact` 360, `mobile-sm` 420, `mobile` 480, `tablet-sm` 600, `tablet` 700, `desktop-sm` 800, `desktop-md` 900, `desktop` 1024, `page-max` 1400, `wqhd` 2200, `4k` 3200).
- **ESLint-Code-Style (#712/#714):** Benannte `const`-Konstanten statt Magic Numbers; sprechende Variablennamen (keine 1-Buchstaben-Kürzel außer `_`, `i`/`j`, `e`, `x`/`y`); immer geschweifte Klammern (`curly: all`), Leerzeilen vor/nach Blöcken, `max-depth: 4`, `max-params: 4`, Early Exit / Guard Clauses statt tiefem `else`, kein `else { if }`, keine verschachtelten/redundanten Ternaries.

## Datenmodell-Änderungen (DB-Migrationen)

Jede Änderung an `backend/src/db/index.ts` braucht diesen Check:

1. **Prod-Status prüfen:** `git merge-base` gegen letzten Release-Tag.
2. **Rein additiv:** `ensureColumn` (nullable/DEFAULT), `CREATE TABLE IF NOT EXISTS`.
3. **Vor `dropColumnIfExists`:** Backfill falls Spalte echte Werte haben könnte.
4. **Reihenfolge:** Gegen tatsächlichen DB-Zustand testen.
5. **Migrationstest ergänzen** analog `backend/test/unit/dbMigration.test.ts`.

## Unit-Tests & E2E-Tests

- **Unit (Vitest):** Backend (`:memory:` SQLite), Frontend (isoliert). Bestehende Tests bei Änderungen immer mit anpassen; neue persistente Tests nur vorschlagen, nicht unaufgefordert schreiben.
- **E2E (Playwright):** Ports 3100/5273, Axe via `npm run test:a11y`. Keine Pixel-Diff-Tests (`toHaveScreenshot()`) in der Haupt-Suite. Scratch-Specs vor `page.goto(...)` mit `forceFontDisplayBlock(page)` und Daten aus `e2e/fixtures/seeded-data.json`.

## Token-Effizienz & Kontext-Disziplin

1. **Thread-Hygiene & situationsbezogener Kontext-Check:** Pro Chat 1 zusammenhängende Aufgabe (~30–50 Schritte). Nach Meilensteinen kurze, ehrliche Empfehlung geben:
   - **Schlank (`< ~20` Schritte):** Bei direkter Fortsetzung **im Chat bleiben**; bei neuem Thema optional neuer Chat.
   - **Fortgeschritten (`~20–35` Schritte):** Für letzten Feinschliff bleiben, vor großem nächstem Block neuer Chat.
   - **Schwer (`> ~35–50` Schritte / große Logs):** Dringend **neuer Chat** (oder `/compact`).
   - **Kopplung mit Model-Routing:** Bei Triage-Stopp **kein** Kontext-Check; bei `T4`-Phasenwechsel Kontext-Check + Ziel-Modell in **einem** Block; bei laufendem `T3`-Orchestrator **kein** manueller Modellwechsel.
2. **Keine Voll-Testsuiten:** Immer gezielte Einzeldateien mit `--bail 1`.
3. **Kompakte Outputs:** Erst `git diff --stat`; lange Listen mit `| head -n 30` begrenzen.
4. **Gezielte Recherche:** Erst `ARCHITECTURE.md` konsultieren; nach 2–3 Fehlversuchen innehalten/fragen statt Endlos-Loop.
5. **Subagenten:** Normale Einzel-Features direkt ohne Subagent; Ausnahme Multi-Team-Workflows wie `Release Audit Auto`.
6. **Keine unaufgeforderten Screenshots & kein `view_file` auf Bilder** (~4.000 Tokens/Bild).

## Issue-Komplexität & Modell-/Thinking-Mapping

Vollständiges Ablaufdiagramm (`🔍️ needs-triage` → `⚠️ needs-refinement` / `✅️ dev-ready` → `🚦️ complexity:*`): [`docs/ISSUE_WORKFLOW_GUIDE.md`](docs/ISSUE_WORKFLOW_GUIDE.md).

Alle Aufgaben (mit/ohne Issue) werden in `T1`–`T4` (`🚦️ complexity:trivial/low/mid/high`) klassifiziert:

- 🩵 **`T1` · `trivial`**: 1–2 Dateien, Typo, Copy, kleiner CSS-Fix, einfacher Test, Config-Bump.
- 🟢 **`T2` · `low`**: 2–5 Dateien, bekanntes Muster, lokales Feature/Refactoring, klare Ursache.
- 🟡 **`T3` · `mid` _(Default)_**: Mehrere Schichten (API + Store + UI + Tests), überschaubare Edge-Cases.
- 🔴 **`T4` · `high`**: Neues Subsystem, komplexe State-/Concurrency-/Offline-Sync-Logik, DB-Migration mit Backfill, Security/Auth, vage Anforderungen/Root-Cause.

| Stufe & Label                              | Setup (Modell & Thinking)                                                                | Wechsel- & Phasen-Modus                                                              | 2.-Agent-Review (Quota-bewusst)                                                             |
| :----------------------------------------- | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| 🩵 **`T1`** · `complexity:trivial`         | **Gemini 4 Hydrogen (`Low`)**                                                            | Kein Wechsel. Direkt in einem Rutsch.                                                | **Kein 2. Chat** (CI + kurzer Nutzer-Diff-Blick).                                           |
| 🟢 **`T2`** · `complexity:low`             | **Gemini 4 Hydrogen (`Medium`–`High`)**                                                  | Kein Wechsel; Eskalation erst nach 2 Fehlversuchen.                                  | **Kein 2. Chat** (Ausnahme: Eskalation oder Scope-Sprung > 5 Dateien).                      |
| 🟡 **`T3`** · `complexity:mid` _(Default)_ | **Orchestrator (`Gemini 4 Neon Medium`)**                                                | Automatischer Plan-Execute-Split im Chat (**kein automatisches Abschluss-Review!**). | **Selektiv in frischem Diff-Chat (`4 Neon Medium`)** nur bei Risiko-Signalen (siehe unten). |
| 🔴 **`T4`** · `complexity:high`            | **Plan:** `4 Carbon (Medium/High)` · **Code:** `4 Neon (Medium)` / `4 Hydrogen (High)`\* | Bewusster 2-Phasen-Wechsel nach freigegebenem Plan.                                  | **Immer** frischer Review-Chat auf Planungsniveau (`4 Carbon` / `4 Neon High`).             |

_\*`T4`-Umsetzung:_ Bei vollständig ausformuliertem Plan reicht `4 Hydrogen (High)`, sonst `4 Neon (Medium)`. Quota-Fallback: `Claude Sonnet 5.5 (Medium)` ≈ `T3`, `Claude Opus 5.5 (Medium)` ≈ `T4`.

- **Risiko-Signale für selektives `T3`-Diff-Review** (kurzer, frischer Chat auf `gh pr diff <nr>` statt Review im aufgeblähten Bau-Chat):
  - Großer Scope (`> ~8–10` geänderte Dateien oder `> ~300` Zeilen Diff), **oder**
  - Mindestens ein kritischer Bereich: **Security / Auth / HTML-Sanitizing**, **Optimistic UI / Concurrency / Offline-Sync**, **DB-Migration / Backfill**.

### Verbindliches Zero-Code-Triage-Gate (Pflicht vor dem Start)

1. **Zero-Code-Read:** Vor der Einstufung **keine** Code-Dateien lesen und **kein** `grep`/Code-Search starten. Einzige erlaubte Lese-Aktion bei genanntem Issue: `gh issue view <nr> --json number,title,body,labels`.
2. **Label prüfen/setzen:** Fehlt `🚦️ complexity:*` beim Issue, direkt ad-hoc per `gh issue edit <nr> --add-label "🚦️ complexity:<trivial|low|mid|high>"` setzen.
3. **Stopp vs. Go:** Passt das Modell (oder `Orchestrator` für `T3`), Kompass ausgeben und loslegen. Passt es nicht (zu schwach, deutlicher Overkill wie `Carbon`/`Neon` für `T1`/`T2`, oder Nutzer fragt nach Modell), **hart stoppen** (keine Edits, kein `exit_plan_mode`, kein Kontext-Check), Kompass ausgeben und auf Modellwechsel + „weiter“ warten:
   > **🧭 Triage & Modell-Kompass** _(`#<nr>` oder Aufgabe)_
   >
   > - **Stufe:** _[Stufe & Label]_ | **Setup:** _[Modell + Thinking]_ | **Bereich:** _[1 Zeile]_
   > - **👉 Nächster Schritt:** _[„Setup passt – ich lege los“ ODER „Bitte auf **<Ziel-Modell>** wechseln und kurz ‚weiter‘ schreiben“]_
4. **Leitprinzipien:** Start-Low-and-Escalate (`4 Hydrogen Low`); kein Wechsel bei `T1`/`T2`; dynamische Eskalation nach 2 Fehlversuchen ohne Label-Drift; neue selbst erstellte Issues immer mit `--label "🚦️ complexity:<...>"`.

## PR-Workflow

### Pre-PR-Self-Checkliste (Pflicht vor Commit & PR)

Vor jedem Commit/PR (insbesondere bei `T3`-Execution ohne separates Review) zwingend gegen `git diff --stat` prüfen:

1. **Release-Notes:** Sichtbare Endnutzer-Änderung gegenüber dem letzten Release-Tag (`$LAST_TAG`)? → Fragment unter `release-notes/pending/<slug>.md` anlegen und `npm run check:release-notes` ausführen.
2. **Lockfile-Sync:** Wurde eine `package.json` (Root, `frontend/`, `backend/`, `e2e/`) geändert? → Zugehörige `package-lock.json` mit aktualisieren (`npm install --package-lock-only` im jeweiligen Paket), niemals desynchronisiert committen.
3. **Optimistic UI & Concurrency:** Werden wiederholte schnelle Nutzer-Aktionen (z. B. Checklisten-Toggles, Likes, Sortierung) optimistisch gespeichert? → Parallele Requests pro Entität serialisieren / coalescen, damit ältere Antworten keinen neueren State überschreiben und Fehler-Rollbacks keinen Folge-Klick vernichten.
4. **Vollständige Verdrahtung & Cleanup:** Alle Caller/Varianten der geänderten Komponente bzw. Props geprüft, keine verwaisten Referenzen, gezielte Formatierung (`npx -y prettier --write <dateien>`), `npm run typecheck`, `npx -y eslint <dateien>` und fokussierte Tests grün.

### PR-Erstellung, Screenshots & Release-Notes

- **Automatische PR-Erstellung:** Neuer Branch/Worktree ohne PR (`gh pr view 2>/dev/null`) → pushen und automatisch `gh pr create` (bei Nicht-Draft-PRs direkt mit `--label "👀️ review:needed"`) mit Link-Ausgabe (Issue-Referenz mit `Fixes #...`). Bei bestehendem PR nur pushen und ggf. `gh pr edit` (nach gepushten Review-Fixes wieder `👀️ review:needed` setzen). PRs **niemals automatisch mergen**.
- **PR-Review & Label-System ([`docs/PR_REVIEW_GUIDE.md`](docs/PR_REVIEW_GUIDE.md) & [`.agent/skills/pr-review/SKILL.md`](.agent/skills/pr-review/SKILL.md)):** Offene Nicht-Draft-PRs nutzen orthogonale `review:*`-Labels (`👀️ review:needed` | `🛠️ review:needs-polish` | `👍️ review:reviewed`, `🧪️ review:needs-manual-test` | `✅️ review:manually-tested`, `💬️ review:discussed`, `🚀️ review:ready-to-merge`). Für Reviews, Status-Updates und das PR-Board den Skill `pr-review` nutzen (`node .agent/skills/pr-review/scripts/pr-labels.mjs`).
- **Screenshots:** Strikte On-Demand-Pflicht (nie automatisch, kein `view_file` auf Bilder). Details zu Baseline (`docs/screenshots/`), HTML-Diff-Report und Scratch-Screenshots: [`docs/PR_AND_RELEASE_NOTES.md`](docs/PR_AND_RELEASE_NOTES.md).
- **Release-Notes:** 1 Fragment pro PR unter `release-notes/pending/<slug>.md` (keine für reine Internas). Erlaubte `### `-Kategorien: `Reisen und Urlaube`, `Karte und Navigation`, `Spots, Touren und Unterkünfte`, `Budget und Kasse`, `Kalender und Planung`, `Listen, Notizen und Tagebuch`, `Wetter`, `Verwaltung und Benutzerkonten`, `Design und Bedienung`, `Datenschutz und Sicherheit`, `Einstellungen, Benachrichtigungen und Synchronisation`, `Demo und Feedback`, `Weitere Verbesserungen und Fehlerbehebungen`. Endnutzer-Deutsch **ohne** Backticks, CSS-Variablen, Dateinamen oder Issue-/PR-Nummern; prüfen mit `npm run check:release-notes`. Upgrade-Entscheidungsbaum: [`docs/PR_AND_RELEASE_NOTES.md`](docs/PR_AND_RELEASE_NOTES.md).
- **Semantische Commits:** Nie fachfremde Themen in einen Riesen-Commit bündeln (`feat:`, `fix:`, `feat!:`, `chore:`, `refactor:`, `docs:`). Jeder Commit muss formatiert, typgeprüft und lauffähig sein.
