---
name: pr-review
description: >-
  Systematic GitHub Pull Request review, status overview, and label management
  using the repository's review:* label system (needed, needs-polish,
  needs-manual-test, ready-to-merge, discussed, manually-tested). Use when the
  user asks to review a PR, update PR review/test/discussion labels, or get an
  overview of open pull requests.
---

# Systematic PR Review & Label Workflow

Führt strukturierte Code-Reviews für Pull Requests durch, hält den Status über das `review:*`-Labelsystem konsistent und hinterlässt ein übersichtliches Review-Ergebnis als PR-Kommentar.

Helper-Skript für alle Label-Operationen und das PR-Board: [pr-labels.mjs](./scripts/pr-labels.mjs)

## Das Label-System (`review:*`)

### A) Exklusiver Pipeline-Status (genau 1 Label pro offenem Nicht-Draft-PR)

| Label                         | Bedeutung                                 | Wann setzen?                                                                                    |
| :---------------------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------- |
| `👀️ review:needed`            | Wartet auf Code-Review                    | Bei neuer PR-Erstellung oder nach gepushten Fixes auf `needs-polish`.                           |
| `🛠️ review:needs-polish`      | Fixes / Feinschliff nötig                 | Review hat Blocker, fehlende Tests/Checks oder konkreten Polish-Bedarf gefunden.                |
| `🧪️ review:needs-manual-test` | Code-Review sauber – manueller Test offen | Review ist komplett grün, aber UI/UX/API-Verhalten muss noch manuell geprüft werden.            |
| `🚀️ review:ready-to-merge`    | Bereit zum Mergen                         | Review grün, abgestimmt und manuell getestet (oder Test n/a, z. B. reine Doku/CI/Agent-Config). |

### B) Orthogonale Merk-Flags (bleiben über Statuswechsel hinweg erhalten)

| Label                       | Bedeutung            | Wann setzen?                                                                                                                                    |
| :-------------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `💬️ review:discussed`       | Gemeinsam besprochen | Nur wenn Mensch & Agent/Team den PR-Stand bereits besprochen haben (nicht bei rein asynchronem Review).                                         |
| `✅️ review:manually-tested` | Manuell getestet     | Nur wenn ein manueller/visueller Test bestätigt wurde. Bei größeren funktionalen Umbauten bewusst wieder entfernen (`--manually-tested false`). |

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

Gib die erzeugte Tabelle direkt im Chat aus und fasse kurz zusammen, welche PRs auf Review, Gespräch, manuellen Test oder Merge warten.

### Modus 2: Schnelles Label-Update auf Zuruf

Wenn der Nutzer nur Status/Test/Gespräch markiert (z. B. _„PR #901 manuell getestet“_, _„Über #900 haben wir geredet, braucht noch Polish“_):

```bash
node .agent/skills/pr-review/scripts/pr-labels.mjs set <pr-nr> \
  [--status needed|needs-polish|needs-manual-test|ready-to-merge] \
  [--discussed true|false] \
  [--manually-tested true|false]
```

**Übergangs-Regel:** Meldet der Nutzer _„manuell getestet, passt“_ auf einem PR mit `🧪️ review:needs-manual-test`, setze gleichzeitig `--manually-tested true --status ready-to-merge`.

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

3. **Review-Ergebnis & Ziel-Status bestimmen:**
   - **Blocker oder Nachbesserungen (`🔴` / `🟡`):** Status → `needs-polish`.
   - **Review sauber (`✅`):**
     - Manueller Test bereits bestätigt (`✅️ review:manually-tested` vorhanden) **oder** nicht anwendbar (reine Doku, CI/Workflow, Agent-Config, Tests-only, grüner Dependabot-PR) → Status → `ready-to-merge`.
     - Sonst (sichtbare UI-, UX-, API- oder Verhaltensänderung) → Status → `needs-manual-test`.
   - Setze das Ergebnis direkt per [pr-labels.mjs](./scripts/pr-labels.mjs) (exklusives Status-Label wird sauber getauscht, bestehende Flags bleiben unangetastet).

4. **Übersichtlichen Review-Kommentar im PR posten:**
   Nutze `gh pr comment <nr> --body-file - <<'EOF'` (ohne temporäre Dateien im Worktree abzulegen) nach folgendem Schema:

   ```markdown
   ## 🔍 Code Review — <Status-Urteil, z. B. "Bereit für manuellen Test" / "Polish nötig" / "Ready to Merge">

   **Geprüfter Stand:** `<kurzer-commit-sha>` · **Gesetzte Labels:** `<status-label>` _(+ ggf. bestehende Flags)_

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
   - 🟡 **Polish:** _(falls vorhanden)_ `pfad/zur/datei.vue:88` — Konkrete Verbesserung.
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
