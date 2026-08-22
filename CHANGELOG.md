# Changelog

Alle nennenswerten Änderungen an Reisotor, für Endnutzer:innen verständlich zusammengefasst.
Format lose an [Keep a Changelog](https://keepachangelog.com/) angelehnt, Versionsnummern folgen
[Semantic Versioning](https://semver.org/). Neue Einträge werden beim Erstellen eines Releases
(`.github/workflows/release.yml`) oben ergänzt.

## [1.2.1] - 2026-08-22

- Fix: "Demo zurücksetzen" in der öffentlichen Demo-Version führt nicht mehr zu einer 404-Fehlerseite.

## [1.2.0] - 2026-08-22

- Schatten bei den Menüpunkten in den Auswahl-Menüs der Karte entfernt (fiel v. a. auf dem iPhone auf).
- Das Info-Symbol neben der "Spots"-Überschrift ist jetzt gut erkennbar statt fast unsichtbar.
- Neu: eine Marketing-Landingpage stellt Reisotor jetzt öffentlich vor und erklärt, wofür die App gedacht ist.
- Über die Landingpage lässt sich eine Demo-Version ohne eigene Anmeldung und ohne echtes Backend ausprobieren – mit Beispieldaten, nichts wird dauerhaft gespeichert.
- Die Anmeldeseite zeigt jetzt ebenfalls einen Copyright-Hinweis und einen Link zum Quellcode, auch ohne Login sichtbar.
- Das Notizfeld bei Spots und Touren ist jetzt wieder normal groß statt unnötig riesig – groß bleibt es weiterhin dort, wo Text die Hauptsache ist (Tagebuch, Notizen).
- Die Zahl im roten Benachrichtigungs-Symbol ist jetzt sauber zentriert.
- Neuer Hinweis oben im Kopfbereich zeigt, dass sich Reisotor als App installieren lässt - lässt sich wegklicken und erscheint danach nicht mehr.
- Ein Klick öffnet eine kurze, auf das eigene Gerät/Browser zugeschnittene Installationsanleitung samt Erklärung der Vorteile; auch jederzeit im Profil unter "Über" aufrufbar.
- Den Button "Neue Fahrt/Flug" in der Touren-Ansicht entfernt – Transportmittel legt man jetzt über den Haken „Transportmittel“ im normalen „Neue Tour“-Dialog an.
- Der Status-Badge einer Tour überlagert nicht mehr den Bearbeiten-Button.
- Fix: Spots im Tagebuch-Formular zuordnen legt nicht mehr heimlich eine neue Tour an – die Touren-Liste bleibt dadurch übersichtlich.
- Zugeordnete Touren/Spots werden beim Speichern eines Tagebucheintrags jetzt automatisch als "gemacht" markiert, mit dem Datum des Eintrags.
- Neuer Button "Tag auf Karte anzeigen" bei jedem Tagebucheintrag.
- Schatten bei den Spot-Einträgen im Tagebuch-Zuordnen-Dialog entfernt.
- Störende, zu eng aneinanderklebende Schatten in der Spots-Liste beim Anlegen/Bearbeiten einer Tour entfernt.
- Den überflüssigen "Hinzufügen"-Button beim Zuordnen einer Tour im Spot-Formular entfernt – Enter oder Klick auf einen Vorschlag reicht jetzt aus.
- Die unschönen Schlagschatten an den Einträgen im Urlaub-Auswahlmenü wurden entfernt.
- Neuen Urlaub anlegen läuft jetzt als kurzer Assistent mit einzelnen Schritten statt einem langen Formular auf einmal.
- Der Standort-Schritt erklärt jetzt, wofür er verwendet wird, und lässt sich wie alle optionalen Schritte überspringen und später nachholen.
- Im Standort-Menü der Karte lässt sich jetzt auch zum Standort anderer Mitreisender springen, sofern diese ihn gerade teilen.

## [1.1.0] - 2026-08-21

- Neu: Versionierung nach Semver, Releases lassen sich jetzt gezielt auf die Produktion bringen (vorher landete jede Änderung an main automatisch auch auf der Produktion).
- Neu: Der "Über"-Bereich im Profil zeigt jetzt, was sich in der aktuellen Version geändert hat, einen Link zum GitHub-Repository sowie einen Hinweis, wo und wie die App gehostet wird.
