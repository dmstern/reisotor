---
name: pr-review
description: >-
  Systematic GitHub Pull Request review, status overview, and label management
  using the repository's review:* label system (needed, needs-polish, reviewed,
  needs-manual-test, manually-tested, discussed, ready-to-merge). Use when the
  user asks to review a PR, update PR review/test/discussion labels, or get an
  overview of open pull requests.
---

# Systematic PR Review & Label Workflow

Führt strukturierte Code-Reviews für Pull Requests durch, hält den Status über das `review:*`-Labelsystem konsistent und hinterlässt ein übersichtliches Review-Ergebnis als PR-Kommentar.

Helper-Skript für alle Label-Operationen und das PR-Board: [pr-labels.mjs](./scripts/pr-labels.mjs)

## Das Label-System (`review:*`)

Das System bildet die vier Fragen bei parallelen PRs orthogonal ab:

### 1. Code-Review-Stand (exklusiv: maximal 1 Label)

| Label                    | Bedeutung                    | Wann setzen?                                                                              |
| :----------------------- | :--------------------------- | :---------------------------------------------------------------------------------------- |
| `👀️ review:needed`       | Wartet auf Code-Review       | Bei neuer PR-Erstellung oder nach gepushten Fixes auf `needs-polish`.                     |
| `🛠️ review:needs-polish` | Fixes / Feinschliff nötig    | Review fand Blocker, fehlende Tests/Checks oder konkreten Polish-Bedarf.                  |
| `👍️ review:reviewed`     | Code-Review erfolgt & sauber | Das Code-Review ist bestanden (auch wenn manueller Test oder Abstimmung noch offen sind). |

### 2. Manueller Test (exklusiv untereinander, entfällt wenn Test n/a)

| Label                         | Bedeutung            | Wann setzen?                                                                                 |
| :---------------------------- | :------------------- | :------------------------------------------------------------------------------------------- |
| `🧪️ review:needs-manual-test` | Manueller Test offen | Bei sichtbaren UI-/UX-/API-/Verhaltensänderungen, solange noch nicht manuell getestet wurde. |
| `✅️ review:manually-tested`   | Manuell getestet     | Sobald ein manueller/visueller Test erfolgreich bestätigt wurde.                             |

### 3. Abstimmung & Merge-Freigabe (Merk-Flags)

| Label                      | Bedeutung            | Wann setzen?                                                                                             |
| :------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------- |
| `💬️ review:discussed`      | Gemeinsam besprochen | Nur wenn Mensch & Agent/Team den PR-Stand bereits besprochen haben (nicht bei rein asynchronem Review).  |
| `🚀️ review:ready-to-merge` | Bereit zum Mergen    | Wenn Code-Review grün (`👍️`), kein Polish offen und manueller Test erledigt (`✅️`) oder nicht nötig ist. |

Falls die Labels in einem neuen Klon/Fork fehlen, einmalig synchronisieren:

```bash
node .agent/skills/pr-review/scripts/pr-labels.mjs sync
```

## Modi

### Modus 1: Übersicht über parallele PRs („PR-Board“)

Wenn der Nutzer nach dem Überblick über offene PRs fragt:

```bash
node .agent/skills/pr-review/scripts/pr-labels.mjs board
```

Gib die erzeugte Tabelle direkt im Chat aus und fasse kurz zusammen, welche PRs auf Code-Review, Gespräch, manuellen Test oder Merge warten.

### Modus 2: Schnelles Label-Update auf Zuruf

Wenn der Nutzer nur Status/Test/Gespräch markiert (z. B. _„PR #901 manuell getestet“_, _„Über #900 haben wir geredet, braucht noch Polish“_):

```bash
node .agent/skills/pr-review/scripts/pr-labels.mjs set <pr-nr> \
  [--review needed|needs-polish|reviewed] \
  [--manual-test needed|done|none] \
  [--discussed true|false] \
  [--ready true|false]
```

**Übergangs-Regel:** Meldet der Nutzer _„manuell getestet, passt“_ auf einem PR mit `👍️ review:reviewed` + `🧪️ review:needs-manual-test`, setze `--manual-test done --ready true` (entfernt `needs-manual-test` automatisch und behält `👍️ review:reviewed`).

### Modus 3: Systematisches Code Review (Vollablauf)

1. **PR-Kontext laden:**

   ```bash
   gh pr view <nr> --json number,title,body,state,isDraft,baseRefName,headRefName,headRefOid,labels,files,additions,deletions,statusCheckRollup
   ```

   Falls im Body `Fixes #...` / `Closes #...` steht, auch das zugehörige Issue kurz via `gh issue view <issue-nr> --json number,title,body,labels` lesen.

2. **Diff & betroffene Dateien prüfen:**
   - Diff laden (`gh pr diff <nr>`). Bei großen PRs zuerst `files` sichten und gezielt relevante Dateien im lokalen Repo oder per `gh pr diff <nr> -- <pfad>` lesen.
   - Prüfkriterien durchgehen:
     1. **Anforderung & Scope:** Erfüllt der PR das Issue/Ziel ohne ungewollten Scope-Creep?
     2. **Korrektheit & Edge-Cases:** Logik, Fehlerbehandlung, Race Conditions, Offline-Sync/Optimistic-State, Boundary-Werte.
     3. **Sicherheit & Datenmodell:** Input-Validierung, Auth/`trip_members`-Zugriffsprüfung, XSS/Sanitizing, rein additive DB-Migrationen + Migrationstest (`backend/test/unit/dbMigration.test.ts`).
     4. **Clean Code & Design-System (`AGENTS.md` / `DESIGN.md`):** SoC/DRY/KISS, `<AppIcon>` statt roher Unicode-Emojis im UI, `--radius-pill`, zentrale SCSS-Breakpoints, keine Magic Numbers, geschweifte Klammern bei `if`/`for`, frühe Returns.
     5. **Tests, CI & Release-Notes:** Passende Unit-/E2E-Tests vorhanden? `statusCheckRollup` grün? Bei Endnutzer-Änderungen genau 1 valides Fragment in `release-notes/pending/<slug>.md` (keines bei rein internen Änderungen).

3. **Review-Ergebnis & Ziel-Labels bestimmen:**
   - **Blocker oder Nachbesserungen (`🔴` / `🟡`):** `--review needs-polish --ready false` (falls ein manueller UI-Test ohnehin nötig ist, kann `--manual-test needed` bereits gesetzt oder beibehalten werden).
   - **Review sauber (`✅`):** `--review reviewed`, und zusätzlich:
     - **Manueller Test erforderlich** (sichtbare UI-/UX-/API-Änderung) und noch kein `✅️ review:manually-tested`: `--manual-test needed --ready false`.
     - **Manueller Test bereits erledigt (`✅️`) oder n/a** (reine Doku, CI/Workflow, Agent-Config, Tests-only, grüner Dependabot-PR): `--ready true` (oder wenn erst noch besprochen werden soll, nur `--review reviewed` ohne `--ready true`).
   - Setze das Ergebnis direkt per [pr-labels.mjs](./scripts/pr-labels.mjs).

4. **Übersichtlichen Review-Kommentar im PR posten:**
   Nutze `gh pr comment <nr> --body-file - <<'EOF'` (ohne temporäre Dateien im Worktree abzulegen) nach folgendem Schema:

   ```markdown
   ## 🔍 Code Review — <Status-Urteil, z. B. "Review erfolgt · manueller Test offen" / "Polish nötig" / "Ready to Merge">

   **Geprüfter Stand:** `<kurzer-commit-sha>` · **Gesetzte Labels:** `<aktuelle review-labels>`

   <2–3 Sätze Kurzfazit zu Qualität, Risiko und Gesamteindruck.>

   ### Checkliste

   | Bereich                   |    Status    | Kurznotiz |
   | :------------------------ | :----------: | :-------- |
   | Anforderung & Scope       | ✅ / ⚠️ / ❌ | ...       |
   | Korrektheit & Edge-Cases  | ✅ / ⚠️ / ❌ | ...       |
   | Sicherheit & Datenmodell  | ✅ / ➖ / ❌ | ...       |
   | Clean Code & UI-Standards | ✅ / ⚠️ / ❌ | ...       |
   | Tests, CI & Release-Notes | ✅ / ⚠️ / ❌ | ...       |

   ### Befunde

   - 🔴 **Blocker:** _(falls vorhanden, sonst weglassen)_ `pfad/zur/datei.ts:42` — Konkretes Problem & Lösung.
   - 🟡 **Polish:** _(falls vorhanden)_ `pfad/zur/datei.vue:88` — Konkretes Problem & Verbesserung.
   - 💡 **Optional / Nit:** _(falls vorhanden)_ ...
     _(Falls alles sauber: „Keine Blocker oder offenen Polish-Punkte gefunden.“)_

   ### Manueller Test-Check _(nur bei `🧪️ review:needs-manual-test`)_

   - [ ] <Konkreter Prüfschritt 1 im Browser / Flow>
   - [ ] <Konkreter Prüfschritt 2 (z. B. Mobile & Desktop Viewport)>

   ---

   👉 **Nächster Schritt:** <z. B. „Manuell testen und danach mit `✅️ review:manually-tested` + `🚀️ review:ready-to-merge` freigeben.“ oder „Polish-Punkte beheben und danach wieder auf `👀️ review:needed` setzen.“>
   ```

5. **Abschluss im Chat:**
   Gib dem Nutzer eine kurze Zusammenfassung des Urteils, der gesetzten Labels und den direkten Link zum PR-Kommentar aus.
