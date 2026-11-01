# Changelog

Alle nennenswerten Änderungen an Reisotor, für Endnutzer:innen verständlich zusammengefasst.
Format lose an [Keep a Changelog](https://keepachangelog.com/) angelehnt, Versionsnummern folgen
[Semantic Versioning](https://semver.org/). Neue Einträge werden beim Erstellen eines Releases
(`.github/workflows/release.yml`) oben ergänzt.

## [2.0.1] - 2026-11-01

### Versionshinweise

- 📋 **Versionshinweise und Changelog**: In den Release-Notes führt ein direkter Link zum vollständigen Changelog auf GitHub, und bei Patch-Versionen bleiben die Highlights der aktuellen Hauptversion erhalten.

### Demo-Modus

- 🐛 **Stabilität in der Demo**: Beim Erstellen von Tagebucheinträgen und Notizen sowie beim Verwalten von Urlaubs-Kategorien und Push-Einstellungen im Demo-Modus treten keine Laufzeitfehler mehr auf und Metadaten werden vollständig initialisiert.

### Tagebuch

- ⚠️ **Warnung bei Datumsabweichungen**: Beim Zuordnen von Touren und Spots zu Tagebucheinträgen sowie auf den Tagebuch-Karten wird nun übersichtlich gewarnt, wenn das geplante Datum eines Ausflugs oder Spots vom Tagebuch-Datum abweicht.

### Ausflüge & Touren

- 🐛 **Migrierte Touren bearbeiten**: Touren mit Teilstrecken und Budget-Ausgaben aus früheren Versionen lassen sich nun wieder ohne Fehler bearbeiten und umbenennen.

### Rechtliches & Datenschutz

- 📄 **Hosting-Dienstleister im Impressum**: In den Admin-Einstellungen können Name und Anschrift des externen Webhosters hinterlegt werden, die automatisch rechtssicher im Impressum und in der Datenschutzerklärung ausgewiesen werden.

### Benachrichtigungen

- 🚀 **Versions-Updates**: Bei neuen Releases von Reisotor kann nun automatisch eine Push-Benachrichtigung empfangen werden, um direkt über Neuerungen informiert zu werden.
- 🔔 **Aktivitäts-Umfang**: In den Benachrichtigungs-Einstellungen lässt sich festlegen, ob Push-Mitteilungen bei allen Änderungen oder ausschließlich bei neu angelegten Elementen gesendet werden sollen.
- ⚙️ **Aufklappbare Detail-Einstellungen**: Die erweiterten Einstellungen für einzelne Push-Kategorien sind jetzt übersichtlich in einem aufklappbaren Bereich zusammengefasst.

### App-Updates & PWA

- 🔄 **Zuverlässiges Aktualisieren**: Der „Neu laden“-Button bei verfügbaren App-Updates lädt die Anwendung jetzt sofort und verlässlich auf die neueste Version.
- 🏷️ **Versionsanzeige im Update-Hinweis**: Im Hinweis auf eine neue Version wird die Zielversionsnummer nun auch vor dem Login und bei schnellen Zwischen-Updates zuverlässig angezeigt.

### Reise-Dashboard & Länderinfos

- 🛡️ **Reise- und Sicherheitshinweise**: Die Sicherheits-Einschätzungen im Reise-Dashboard wurden nach dem Ausfall des früheren Drittanbieters neu implementiert und beziehen nun amtliche Reise- und Teilreisewarnungen direkt und verlässlich über die Open-Data-Schnittstelle des Auswärtigen Amts.

## [2.0.0] - 2026-11-01

### Highlights

- 🎨 **Neues Design**: Moderner Markenauftritt mit neuem Logo, schwebender Navigation, randlosen Vollbild-Karten auf Mobilgeräten und animiertem Reisotor-Roboter.
- ✉️ **Registrierung per E-Mail**: Double-Opt-In mit Bestätigungslink, sichere Passwort-Zurücksetzung und zentrale Verwaltung für Benutzerkonten.
- 🔍 **Intelligente Ortssuche**: Ein zentrales Suchfeld findet Cafés, Sehenswürdigkeiten, Adressen oder kopierte Karten-Links und erkennt Kategorien automatisch.
- 🛣️ **Routen- und Reisezeitberechnung**: Echte Straßen- und Wegeverläufe für Auto, Fahrrad oder Fußwege mit automatischer Berechnung von Reisedauer und Distanz.
- 📸 **Automatische Fotovorschau**: Intelligente eingebaute Foto-Suche für gefundene Orte und Urlaubsziele.
- 📎 **Polaroid-Anhänge**: Fotos, Tickets und Buchungsbestätigungen werden als ansprechender Polaroid-Stapel mit Büroklammer und interaktiver Vollbild-Vorschau präsentiert.
- 💰 **Erweiterte Reisekasse**: Mehrere Budget-Töpfe, Erfassung von Einnahmen, Ausgaben direkt aus der gemeinsamen Urlaubskasse und transparente Abrechnung.
- ⏱️ **Streckenaufzeichnung**: Eigene Routen live aufzeichnen und später auf der Karte wiedergeben.

### Reisen und Urlaube

- 📅 **Reisen ohne festes Datum**: Start- und Enddatum beim Anlegen oder Bearbeiten eines Urlaubs sind jetzt optional – ideal für frühe Planungen vorab.
- 👤 **Solo-Reisen**: Wenn du alleine verreist, passen sich Packlisten und Kasse automatisch an und verbergen Gruppen-Optionen.
- 📑 **Strukturierte Einstellungen**: Das Formular zum Bearbeiten von Reisen ist in übersichtliche Reiter aufgeteilt; Zusatzfelder lassen sich bequem ein- und ausklappen.
- 🗑️ **Papierkorb pro Reise**: Gelöschte Elemente werden direkt über das Reise-Dashboard verwaltet und können von allen Mitreisenden eingesehen und wiederhergestellt werden.
- 🏷️ **Eigene Urlaubskategorien**: Kategorien für Ausgaben und Spots lassen sich pro Urlaub individuell anlegen, mit passenden Symbolen versehen oder anpassen.
- 👥 **Mitreisende direkt im Dialog**: Die Verwaltung von Mitreisenden und Zugriffsberechtigungen befindet sich nun als eigener Reiter direkt in den Reiseeinstellungen.

### Karte und Navigation

- 🗺️ **Kombiniertes Schnellmenü**: Ein aufgeräumtes Menü auf der Karte bündelt die Navigation zum Reiseziel, zu Heimatorten sowie zu Mitreisenden.
- 📱 **OpenStreetMap und Karten-Apps**: Orte können direkt in OpenStreetMap oder der bevorzugten Navigations-App des Smartphones geöffnet werden.
- 🗓️ **Kopplung mit dem Reisetag**: Beim Auswählen eines Tages auf der Karte rücken zugehörige Stationen in Liste und Karte automatisch in den Mittelpunkt.
- ⏱️ **Höhenprofil und Statistiken**: Aufgezeichnete Strecken bieten ein interaktives Höhenprofil mit Distanz, Höhenmetern, Dauer und Geschwindigkeit.
- ⏯️ **Interaktive Strecken-Wiedergabe**: Zurückgelegte Wege lassen sich direkt auf der Karte mit regelbarer Geschwindigkeit und mitwanderndem Positions-Pin abspielen.
- 💾 **Offline-Kartennutzung**: Einmal aufgerufene Kartenausschnitte werden im Hintergrund gespeichert und bleiben auch ohne Internetverbindung abrufbar.

### Spots und Touren

- 🚍 **Ausflüge mit Teilstrecken**: Mehrteilige Routen unterstützen individuelle Verkehrsmittel, Zwischenstopps, Abfahrtszeiten, Sitzplätze und Ticketkosten.
- 〰️ **Geschwungene Routenführung**: Mehrteilige Touren werden mit geschwungenen Verbindungslinien und Richtungspfeilen auf der Karte dargestellt.
- 🔎 **Ortssuche und Maps-Links**: Die Suche findet POIs, Cafés und Adressen blitzschnell oder übernimmt kopierte Links aus Google Maps, Apple Maps und OpenStreetMap.
- 📸 **Bildergalerie und Polaroid-Vorschau**: Gefundene Orte erhalten automatische Fotovorschläge per Bildersuche, inklusive Durchblättern alternativer Bilder.
- ☑️ **Besuchs-Status für Reisetage**: Stationen mit mehreren geplanten Terminen oder Touren können gezielt pro Reisetag als besucht abgehakt werden.
- 🏠 **Reiseziel oder Heimatort**: Spots lassen sich flexibel dem Urlaubsort oder der Heimatseite (wie dem Abflughafen oder Bahnhof) zuordnen.
- ⚠️ **Klarer Standort-Status**: Orte ohne hinterlegte Koordinaten signalisieren dies mit einem Warnhinweis und erlauben die sofortige Verortung per Klick.
- 📋 **Schnelles Kopieren**: Adressen, Buchungsdaten und Telefonnummern von Orten lassen sich mit einem Klick in die Zwischenablage kopieren.

### Budget und Kasse

- 💼 **Flexible Budget-Töpfe**: Mehrere Töpfe für unterschiedliche Kategorien mit Zielbetrag, konfigurierbarer Sichtbarkeit (privat vs. geteilt) und nachträglicher Bearbeitung.
- 💰 **Einnahmen und Zuschüsse**: Neben Ausgaben können nun auch Einnahmen oder Urlaubskassenzuschüsse erfasst und verrechnet werden.
- 🤝 **Gemeinsame Reisekasse**: Ausgaben können direkt aus der gemeinsamen Barkasse bezahlt werden, ohne falsche Schulden untereinander zu erzeugen.
- 📉 **Restbudget-Anzeige**: Intuitive Budgetbalken mit Ampelfarben zeigen auf einen Blick das noch verbleibende Restbudget an.
- 💸 **Überweisungen bearbeiten**: Eingetragene Überweisungen und Ausgleichszahlungen lassen sich nachträglich anpassen oder als beglichen verbuchen.

### Kalender und Planung

- 📅 **Endloses Kalenderblättern**: In Wochen-, Doppelwochen- und Monatsansicht lässt sich nun unbegrenzt in die Zukunft und Vergangenheit navigieren.
- 🧭 **Direkte Termin-Verknüpfung**: Klick auf Termine oder Unterkünfte im Kalender öffnet die Stationen zielsicher in der passenden Detailansicht.
- 🗓️ **Sanfte Blätter-Animation**: Beim Vor- und Zurückblättern zwischen Wochen und Monaten gleiten die Kalendertage flüssig zur Seite.

### Listen und Notizen

- 👁️ **Erledigte Einträge ausblenden**: In Pack-, Einkaufs- und Aufgabenlisten können abgehakte Elemente verborgen werden, um den Blick frei zu halten.
- 📊 **Fortschrittsanzeige für Packlisten**: Ein dynamischer Prozentbalken visualisiert den aktuellen Packfortschritt auf einen Blick.
- ⚡ **Schnelleingabe in Listen**: Neue Einträge lassen sich direkt in Untergruppen erfassen, inklusive flexibler Zusatzfelder für Kategorien und Daten.

### Wetter

- 🌤️ **Stündlicher Wetterverlauf**: Klick auf einen Reisetag öffnet den stündlichen Vorhersageverlauf mit Temperatur, Niederschlagswahrscheinlichkeit und Unwetterwarnungen.
- 📡 **Passende Wettermodelle**: Pro Reise kann das optimale Vorhersagemodell (z. B. DWD ICON für Mitteleuropa) ausgewählt werden.
- 📍 **Klarer Ortsbezug**: Schneller Vergleich zwischen Reiseziel und Heimatort sowie automatische Umschaltung nach Urlaubsende.

### Verwaltung und Benutzerkonten

- ⚙️ **Zentraler Administrationsbereich**: Verwaltung von Benutzerkonten, Server-Einstellungen (Mailserver, Geodienste, Web-Push) und Systemdiagnose direkt im Browser.
- ✉️ **E-Mail-Registrierung und Verifikation**: Double-Opt-In bei der Registrierung sowie sicheres Zurücksetzen vergessener Passwörter per E-Mail.
- 🛡️ **Rollen und Kontostufen**: Klare Rollenverteilung (Admin, Plus, Basis) mit transparenter Rechteübersicht.

### Design und Bedienung

- 🫧 **Schwebende Navigationsleiste**: Die Navigation schwebt am oberen Bildschirmrand und blendet beim Scrollen einen sanften Weichzeichner ein.
- 📱 **Randlose Ansichten auf Mobilgeräten**: Die Karten- und Inhaltsansichten nutzen den Bildschirm auf Smartphones vollflächig bis unter die Statusleiste.
- 🧭 **Flexible Navigation**: Menüpunkte lassen sich für Smartphones und Desktop getrennt sortieren und anpassen.
- 🤖 **Reisotor-Roboter**: Ein animiertes Maskottchen begleitet dich beim Login, Passwort-Ändern und bei App-Updates.
- 🌐 **Interaktive Produktvorstellung**: Die öffentliche Landingpage stellt zentrale Funktionen wie Routenplanung, Ortssuche und Reisekasse anschaulich beim Scrollen vor.

### Datenschutz und Sicherheit

- 🔒 **Geschützte Bilder und Anhänge**: Hochgeladene Urlaubsfotos und Dokumente sind nur noch für angemeldete Teilnehmer des jeweiligen Urlaubs zugänglich.
- 🖼️ **Datenschutz bei externen Bildern**: Aus der Bildersuche ausgewählte Titelbilder werden auf dem eigenen Server zwischengespeichert, damit keine IP-Adressen an Drittanbieter übertragen werden.
- ⚖️ **Datenschutzerklärung und Impressum**: Öffentliche, anpassbare Rechtstexte sind direkt in der App und auf der Startseite integriert.

### Einstellungen und Synchronisation

- ⚙️ **Konto-Synchronisation**: Persönliche Farbakzente, Darstellungsmodi und Navigationseinstellungen werden am Benutzerkonto gespeichert und geräteübergreifend synchronisiert.
- 🌈 **Farbakzente zur Auswahl**: Wähle aus 24 vorbereiteten Farbtönen deinen persönlichen Farbakzent für die Benutzeroberfläche.
- 🔄 **Erweiterte Offline-Synchronisation**: Ausstehende Änderungen sind detailliert einsehbar, werden parallel übertragen und bei Versionsupdates automatisch migriert.
- ↩️ **Auf Standard zurücksetzen**: Alle Darstellungs- und Layout-Optionen lassen sich mit einem Klick auf die Standardwerte zurücksetzen.

### Demo und Feedback

- 📬 **Integriertes Feedback-System**: Fehlermeldungen und Vorschläge können direkt aus der App an GitHub übermittelt werden – auch von selbst gehosteten Instanzen ohne eigenen API-Token.
- 🧪 **Aktuelle Online-Demo**: Die öffentliche Demo startet automatisch mit aktuellen Reisedaten in der nahen Zukunft zum unverbindlichen Ausprobieren.

### Weitere Verbesserungen und Fehlerbehebungen

- 🛡️ **Schutz vor Datenverlust**: Dialoge mit ungespeicherten Änderungen warnen vor dem Schließen; Entwürfe können gezielt weiterbearbeitet oder verworfen werden.
- ⏳ **Datei-Uploads**: Das Hochladen von Fotos und Dokumenten zeigt einen Fortschrittsbalken und lässt sich bei Bedarf abbrechen.
- 🗑️ **Wiederherstellen per Benachrichtigung**: Nach dem Löschen von Einträgen erlaubt ein direkter Button in der Erfolgsmeldung das sofortige Rückgängigmachen.
- 🔗 **Direktlinks zu Reisen**: Urlaube können direkt über eindeutige URLs aufgerufen und geteilt werden.
- ♿ **Barrierefreiheit**: Verbesserte semantische Überschriftenstruktur und optimierte Tastaturbedienung in Auswahllisten.
- 🌊 **Flüssige Animationen**: Sanftes Ein- und Ausklappen von Kärtchen und geschmeidige Listenübergänge.
- 🚨 **Transparente Fehlerdiagnose**: Verständliche Hinweise bei Verbindungsproblemen mit technischer Diagnoseansicht und 1-Klick-Fehlermeldung.

## [1.3.0] - 2026-08-22

- Interne Verbesserungen.

## [1.2.3] - 2026-08-22

- Interne Verbesserungen.

## [1.2.2] - 2026-08-22

- Interne Verbesserungen.

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
