# PR-Review- & Label-System

Dieses Dokument beschreibt das systematische Code-Review- und Status-System für Pull Requests in `dmstern/reisotor`. Es sorgt bei mehreren parallelen PRs für einen klaren Überblick über drei Fragen:

1. **Wo steht der PR im Review-Prozess?** _(Exklusiver Status)_
2. **Haben wir darüber schon gesprochen?** _(`💬️ review:discussed`)_
3. **Wurde er schon manuell getestet?** _(`✅️ review:manually-tested`)_

## 1. Die GitHub-Labels (`review:*`)

### Exklusiver Pipeline-Status (genau 1 Label pro offenem Nicht-Draft-PR)

| Label                         | Bedeutung                           | Wann wird es gesetzt?                                                                          |
| :---------------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------- |
| `👀️ review:needed`            | Wartet auf Code-Review              | Bei PR-Erstellung (Nicht-Draft) oder nach gepushten Fixes auf `needs-polish`.                  |
| `🛠️ review:needs-polish`      | Fixes / Feinschliff nötig           | Code-Review hat Blocker, fehlende Tests/Checks oder Polish-Bedarf gefunden.                    |
| `🧪️ review:needs-manual-test` | Review sauber, manueller Test offen | Code-Review bestanden; sichtbare UI-/UX-/API-Änderung wartet auf manuellen Check.              |
| `🚀️ review:ready-to-merge`    | Bereit zum Mergen                   | Code-Review grün, abgestimmt und manuell getestet (oder Test n/a, z. B. Doku/CI/Agent-Config). |

### Orthogonale Merk-Flags (bleiben über Statuswechsel hinweg sichtbar)

| Label                       | Bedeutung            | Wann wird es gesetzt?                                                          |
| :-------------------------- | :------------------- | :----------------------------------------------------------------------------- |
| `💬️ review:discussed`       | Gemeinsam besprochen | Sobald Mensch und Agent/Team den PR-Stand besprochen und abgestimmt haben.     |
| `✅️ review:manually-tested` | Manuell getestet     | Sobald ein manueller/visueller Test im Browser erfolgreich durchgeführt wurde. |

## 2. Typischer Lebenszyklus

```text
PR erstellt ──▶ 👀️ review:needed
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 🛠️ review:needs-polish   🧪️ review:needs-manual-test  (oder 🚀️ review:ready-to-merge bei Test n/a)
        │                       │
  Fixes gepusht           Manuell getestet
        │                       │
        ▼                       ▼
 👀️ review:needed        ✅️ review:manually-tested + 🚀️ review:ready-to-merge
```

- **`💬️ review:discussed`** kann zu jedem Zeitpunkt ergänzt werden, sobald ein Gespräch über den PR stattgefunden hat — auch wenn danach noch `🛠️ review:needs-polish` oder `🧪️ review:needs-manual-test` aktiv ist.
- **`✅️ review:manually-tested`** bleibt bei kleineren Polish-Fixes erhalten; nur nach größeren funktionalen Umbauten wird es bewusst wieder entfernt, damit erneut getestet wird.

## 3. Antigravity-Skill & CLI-Helfer

Der projektspezifische Antigravity-Skill liegt unter [`.agent/skills/pr-review/SKILL.md`](../.agent/skills/pr-review/SKILL.md) und wird automatisch erkannt.

Typische Aufrufe im Chat:

- **Systematisches Review durchführen:** _„Mach ein Code-Review für PR #901“_ (prüft Diff, Kriterien, setzt Status-Label und postet eine strukturierte Checkliste als PR-Kommentar).
- **Überblick über alle parallelen PRs:** _„Zeig mir das PR-Board“_ / _„Welche PRs muss ich noch testen?“_.
- **Schnelles Status-Update:** _„Setze PR #900 auf besprochen und manuell getestet“_.

Direkte CLI-Nutzung über das Hilfsskript [`.agent/skills/pr-review/scripts/pr-labels.mjs`](../.agent/skills/pr-review/scripts/pr-labels.mjs):

```bash
# Alle 6 review:*-Labels im Repository anlegen / abgleichen
node .agent/skills/pr-review/scripts/pr-labels.mjs sync

# Übersichtstabelle aller offenen PRs anzeigen
node .agent/skills/pr-review/scripts/pr-labels.mjs board

# Status und Flags sauber aktualisieren (tauscht exklusives Status-Label automatisch)
node .agent/skills/pr-review/scripts/pr-labels.mjs set 901 --status ready-to-merge --discussed true --manually-tested true
```
