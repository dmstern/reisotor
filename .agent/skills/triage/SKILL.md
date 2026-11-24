---
name: triage
description: >-
  Zero-Code-Triage-Gate & Model-Routing-Check (T1-T4). Triggered via /triage or
  when the user asks to assess task complexity, choose the right Gemini 4 model
  and thinking level, or check for model overkill before reading code.
---

# Zero-Code Triage & Model Routing

Führe eine reine Komplexitäts- und Modell-Einschätzung durch, **ohne die Aufgabe zu lösen und ohne Code einzulesen**.

## Strikte Leitplanken

1. **Zero-Code-Read:** Lies **keine** Quelldateien, starte **kein** `grep`/Code-Search, führe **keine** Edits aus und rufe **kein** `exit_plan_mode` auf.
2. **Einzige erlaubte Lese-Aktion:** Wenn eine GitHub-Issue-Nummer genannt wird, prüfe sie per `gh issue view <nr> --json number,title,body,labels`.
3. **Issue-Label (optional, bei GitHub-Issues):** Fehlt ein `complexity:*`-Label im Repo, prüfe kurz per `gh label list --search "complexity"` die exakte Schreibweise (z. B. `🚦️ complexity:...`) und ergänze das passende Label per `gh issue edit <nr> --add-label "<label>"`.
4. **Harter Stopp:** Nach Ausgabe des Kompasses **immer anhalten** (kein Kontext-Check, keine weiteren Tool-Calls) und auf Modellwechsel bzw. ein kurzes „weiter“ warten.

## 4-Stufen-Matrix (T1–T4)

| Stufe                                      | Kriterien                                                    | Empfohlenes Setup                                                                                   | Modus / Wechsel                                                   | 2.-Agent-Review                                    |
| :----------------------------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :------------------------------------------------- |
| 🩵 **T1 · Trivial** (`complexity:trivial`) | 1–2 Dateien, Typo, Copy, CSS-Fix, kleiner Test               | **Gemini 4 Hydrogen (`Low`)**                                                                       | Kein Wechsel (direkt in einem Rutsch).                            | Kein 2. Chat (CI + Nutzer-Diff).                   |
| 🟢 **T2 · Lokal** (`complexity:low`)       | 2–5 Dateien, bekanntes Muster, klare Ursache                 | **Gemini 4 Hydrogen (`Medium`–`High`)**                                                             | Kein Wechsel (Eskalation erst nach 2 Fehlversuchen).              | Kein 2. Chat (außer Eskalation / >5 Dateien).      |
| 🟡 **T3 · Standard** (`complexity:mid`)    | Mehrere Schichten (API + Store + UI + Tests), Edge-Cases     | **Orchestrator (`Gemini 4 Neon Medium`)**                                                           | Automatischer Plan-Execute-Split im Chat (**kein** Auto-Review!). | Selektiv (frischer Diff-Chat bei Risiko-Signalen). |
| 🔴 **T4 · Kritisch** (`complexity:high`)   | Neues Subsystem, DB-Migration, Auth/Security, Root-Cause-Bug | **Plan/Review:** `4 Carbon (Medium/High)`<br>**Code:** `4 Neon (Medium)` _oder_ `4 Hydrogen (High)` | Bewusster Wechsel nach freigegebenem Plan.                        | Immer frischer Review-Chat auf Planungsniveau.     |

- **Quota-Fallback:** `Claude Sonnet 5.5 (Medium)` ≈ T3, `Claude Opus 5.5 (Medium)` ≈ T4.
- **Review-Schwelle:** `T1`/`T2` kein zweiter Chat; `T3`-Orchestrator macht **kein** Auto-Review → frischer Diff-Chat (`gh pr diff <nr>`) nur bei Risiko-Signalen (`>8–10` Dateien / `>300` LoC / Security / Sanitizing / Optimistic State & Concurrency / DB-Migration / Auth); `T4` immer frischer Review-Chat.

## Pflicht-Output (genau dieses kompakte Format)

> **🧭 Triage & Modell-Kompass** _(`#<nr>` oder Aufgabe)_
>
> - **Stufe:** _[🩵 T1 / 🟢 T2 / 🟡 T3 / 🔴 T4]_ · _[`complexity:<...>` oder ohne Issue]_
> - **Empfohlenes Setup:** _[Modell + Thinking-Level]_
> - **Vermuteter Bereich:** _[1 kurze Zeile, welche Schicht/Dateigruppe vermutlich betroffen ist]_
> - **👉 Nächster Schritt:** _[„Setup passt – sag einfach ‚weiter‘“ ODER „Bitte auf **<Ziel-Modell>** wechseln und kurz ‚weiter‘ schreiben“]_
