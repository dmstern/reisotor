<script setup lang="ts">
import { computed } from 'vue';
import type { LegalConfig } from '../../api/types';

const props = withDefaults(
  defineProps<{
    config: LegalConfig;
    activeTab?: 'privacy' | 'imprint';
    isLandingPage?: boolean;
    showTabs?: boolean;
  }>(),
  {
    activeTab: 'privacy',
    isLandingPage: false,
    showTabs: true,
  }
);

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'privacy' | 'imprint'): void;
}>();

const operator = computed(() => props.config.operator);
const services = computed(() => props.config.services);
const hasOperatorInfo = computed(() => props.config.hasOperatorInfo);
</script>

<template>
  <div class="legal-content">
    <nav v-if="showTabs" class="legal-tabs" aria-label="Rechtliche Navigation">
      <button
        type="button"
        class="legal-tab-btn"
        :class="{ active: activeTab === 'privacy' }"
        :aria-selected="activeTab === 'privacy'"
        @click="emit('update:activeTab', 'privacy')"
      >
        Datenschutzerklärung
      </button>
      <button
        type="button"
        class="legal-tab-btn"
        :class="{ active: activeTab === 'imprint' }"
        :aria-selected="activeTab === 'imprint'"
        @click="emit('update:activeTab', 'imprint')"
      >
        Impressum
      </button>
    </nav>

    <!-- ========================================== -->
    <!-- IMPRESSUM (§ 5 DDG)                        -->
    <!-- ========================================== -->
    <article v-if="activeTab === 'imprint'" class="legal-article legal-imprint">
      <header class="legal-header">
        <h1>Impressum</h1>
        <p class="legal-subtitle">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>
      </header>

      <!-- Betreiberangaben / Verantwortlicher -->
      <section class="legal-section">
        <h2>Dienstanbieter &amp; Verantwortliche Stelle</h2>

        <div v-if="!hasOperatorInfo && !isLandingPage" class="legal-alert legal-alert-warning">
          <div class="legal-alert-icon" aria-hidden="true">⚠️</div>
          <div class="legal-alert-body">
            <strong>Betreiberangaben nicht konfiguriert</strong>
            <p>
              In dieser selbst gehosteten Reisotor-Instanz wurden bisher keine rechtlichen
              Betreiberangaben hinterlegt. Als Betreiber:in kannst du diese Angaben über die
              folgenden Server-Umgebungsvariablen konfigurieren:
            </p>
            <ul>
              <li><code>LEGAL_OPERATOR_NAME</code> – Name oder Firmenbezeichnung</li>
              <li><code>LEGAL_OPERATOR_ADDRESS</code> – Ladungsfähige postalische Anschrift</li>
              <li><code>LEGAL_CONTACT_EMAIL</code> – Kontakt- und Datenschutz-E-Mail-Adresse</li>
              <li><code>LEGAL_CONTACT_PHONE</code> – (Optional) Telefonnummer</li>
            </ul>
          </div>
        </div>

        <div v-else-if="isLandingPage" class="legal-card-info">
          <p>
            <strong>Projekt- &amp; Webseiten-Verantwortlicher:</strong><br />
            {{ operator.name || 'Daniel Morgenstern' }}<br />
            E-Mail:
            <a :href="`mailto:${operator.email || 'reisotor@ruebenherz.de'}`">
              {{ operator.email || 'reisotor@ruebenherz.de' }}
            </a>
          </p>
          <p class="legal-muted">
            Reisotor ist ein privates, nicht-kommerzielles Open-Source-Projekt. Die Landing Page
            dient ausschließlich der allgemeinen Vorstellung und Dokumentation der Software.
          </p>
        </div>

        <div v-else class="legal-card-info">
          <p>
            <strong>Betreiber der Instanz:</strong><br />
            {{ operator.name }}
          </p>
          <p v-if="operator.address" class="legal-address">
            <strong>Postanschrift:</strong><br />
            <span class="multiline-text">{{ operator.address }}</span>
          </p>
          <p>
            <strong>Kontakt:</strong><br />
            E-Mail: <a :href="`mailto:${operator.email}`">{{ operator.email }}</a>
            <template v-if="operator.phone"><br />Telefon: {{ operator.phone }}</template>
          </p>
        </div>
      </section>

      <!-- Hosting-Hinweis -->
      <section class="legal-section">
        <h2>Hosting &amp; Betrieb</h2>
        <template v-if="isLandingPage">
          <p>
            Diese Landing Page wird als statische Webpräsenz über <strong>GitHub Pages</strong>
            bereitgestellt:
          </p>
          <p class="legal-address">
            GitHub Inc.<br />
            88 Colin P Kelly Jr St<br />
            San Francisco, CA 94107, USA
          </p>
        </template>
        <template v-else>
          <p>
            Diese Instanz von Reisotor wird eigenverantwortlich durch den oben genannten Betreiber
            betrieben.
            <template v-if="config.hostingLocation">
              Hosting-Standort des Servers: <strong>{{ config.hostingLocation }}</strong
              >.
            </template>
          </p>
        </template>
      </section>

      <!-- Open Source & Haftungsausschluss -->
      <section class="legal-section">
        <h2>Open-Source-Software &amp; Abgrenzung</h2>
        <p>
          Reisotor ist eine freie, quelloffene Reiseplanungs-Software (veröffentlicht auf
          <a href="https://github.com/dmstern/reisotor" target="_blank" rel="noopener noreferrer"
            >GitHub</a
          >
          unter MIT-Lizenz). Die Entwickler:innen und Urheber:innen des Reisotor-Quellcodes stellen
          lediglich die Software bereit und sind nicht verantwortlich für den Betrieb von
          Fremd-Instanzen, deren rechtliche Ausgestaltung oder dort verarbeitete Inhalte.
        </p>
      </section>

      <section class="legal-section">
        <h2>Haftung für Inhalte und Links</h2>
        <p>
          Als Dienstanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder
          gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf
          eine rechtswidrige Tätigkeit hinweisen.
        </p>
        <p>
          Diese Anwendung enthält Verknüpfungen zu Websites Dritter. Auf deren Inhalte haben wir
          keinen Einfluss; für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
          oder Betreiber verantwortlich.
        </p>
      </section>

      <section class="legal-section">
        <h2>Urheberrecht &amp; Lizenzen Dritter</h2>
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
          dem deutschen Urheberrecht. Verwendete externe Ressourcen und Bibliotheken:
        </p>
        <ul>
          <li>
            <strong>Kartendaten:</strong> &copy;
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              >OpenStreetMap-Mitwirkende</a
            >
            (Open Database License, ODbL).
          </li>
          <li>
            <strong>Symbole &amp; Icons:</strong>
            <a href="https://tabler.io/icons" target="_blank" rel="noopener noreferrer"
              >Tabler Icons</a
            >
            (MIT-Lizenz).
          </li>
          <li>
            <strong>Schriften:</strong> Fira Sans (SIL Open Font License 1.1), lokal ausgeliefert.
          </li>
        </ul>
      </section>

      <footer class="legal-disclaimer-note">
        <p>
          <em>
            Hinweis: Diese Vorlage dient der rechtlichen Transparenz und ersetzt keine
            Rechtsberatung. Instanzbetreiber:innen müssen ihre Angaben eigenverantwortlich prüfen
            und anpassen.
          </em>
        </p>
      </footer>
    </article>

    <!-- ========================================== -->
    <!-- DATENSCHUTZERKLÄRUNG (Art. 13 DSGVO)       -->
    <!-- ========================================== -->
    <article v-else class="legal-article legal-privacy">
      <header class="legal-header">
        <h1>Datenschutzerklärung</h1>
        <p class="legal-subtitle">
          Informationen über die Verarbeitung personenbezogener Daten nach Art. 13 und 14 der
          Datenschutz-Grundverordnung (DSGVO)
        </p>
      </header>

      <!-- 1. Grundsätze & Privacy by Design -->
      <section class="legal-section">
        <h2>1. Überblick und Grundsätze</h2>
        <p>
          Wir legen höchsten Wert auf den Schutz deiner persönlichen Daten und handeln streng nach
          den Prinzipien der <strong>Datensparsamkeit</strong> (Art. 5 Abs. 1 lit. c DSGVO) sowie
          <strong>„Privacy by Design and by Default“</strong> (Art. 25 DSGVO).
        </p>
        <p>
          Reisotor ist bewusst so gebaut, dass dein Reiseverhalten und deine Notizen privat bleiben:
        </p>
        <ul>
          <li>
            <strong>Kein Werbetracking:</strong> Keine Werbebanner, keine Marketing-Pixel und kein
            Nutzer-Tracking.
          </li>
          <li>
            <strong>Keine externen Web-Analytics:</strong> Kein Google Analytics, kein Matomo oder
            ähnliche Werkzeuge.
          </li>
          <li>
            <strong>Lokale Schriften &amp; Bibliotheken:</strong> Alle Schriftarten (Fira Sans) und
            Skripte werden direkt von diesem Server bereitgestellt. Keine Drittanbieter-CDNs.
          </li>
          <li>
            <strong>Isolierte Urlaube:</strong> Reisedaten sind strikt privat und nur für die
            explizit eingeladenen Mitglieder des jeweiligen Urlaubs einsehbar.
          </li>
        </ul>
      </section>

      <!-- 2. Verantwortliche Stelle -->
      <section class="legal-section">
        <h2>2. Verantwortliche Stelle</h2>
        <p>
          Verantwortlich für die Datenverarbeitung im Sinne der DSGVO und anderer nationaler
          Datenschutzgesetze ist:
        </p>

        <div v-if="!hasOperatorInfo && !isLandingPage" class="legal-alert legal-alert-warning">
          <div class="legal-alert-icon" aria-hidden="true">⚠️</div>
          <div class="legal-alert-body">
            <strong>Betreiberangaben noch nicht konfiguriert</strong>
            <p>
              In dieser Instanz wurden noch keine Kontaktdaten hinterlegt. Der jeweilige Betreiber
              der Instanz ist verpflichtet, hier Name, Anschrift und Kontakt-E-Mail über
              <code>LEGAL_OPERATOR_NAME</code>, <code>LEGAL_OPERATOR_ADDRESS</code> und
              <code>LEGAL_CONTACT_EMAIL</code> einzurichten.
            </p>
          </div>
        </div>

        <div v-else-if="isLandingPage" class="legal-card-info">
          <p>
            <strong>Projekt- &amp; Webseiten-Verantwortlicher:</strong><br />
            {{ operator.name || 'Daniel Morgenstern' }}<br />
            E-Mail:
            <a :href="`mailto:${operator.email || 'reisotor@ruebenherz.de'}`">
              {{ operator.email || 'reisotor@ruebenherz.de' }}
            </a>
          </p>
        </div>

        <div v-else class="legal-card-info">
          <p>
            <strong>Name:</strong> {{ operator.name }}<br />
            <template v-if="operator.address">
              <strong>Anschrift:</strong><br />
              <span class="multiline-text">{{ operator.address }}</span
              ><br />
            </template>
            <strong>E-Mail:</strong>
            <a :href="`mailto:${operator.email}`">{{ operator.email }}</a>
            <template v-if="operator.phone"
              ><br /><strong>Telefon:</strong> {{ operator.phone }}</template
            >
          </p>
        </div>
      </section>

      <!-- 3. Server-Betrieb & Hosting-Logs -->
      <section class="legal-section">
        <h2>3. Server-Betrieb &amp; Protokolldateien (Logfiles)</h2>
        <p>
          Beim Aufrufen der Anwendung verarbeitet der Webserver automatisiert technische Daten, die
          dein Browser übermittelt:
        </p>
        <ul>
          <li>IP-Adresse des anfragenden Geräts</li>
          <li>Datum und Uhrzeit des Zugriffs</li>
          <li>Aufgerufene Seite / Pfad / Ressource</li>
          <li>HTTP-Statuscode und übertragene Datenmenge</li>
          <li>Browsertyp, Version und Betriebssystem (User-Agent)</li>
        </ul>
        <p>
          <strong>Zweck:</strong> Bereitstellung der Seiteninhalte, Gewährleistung der
          IT-Systemsicherheit, Fehlerdiagnose sowie Abwehr von Überlastungs- oder Cyberangriffen.
        </p>
        <p>
          <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
          einem stabilen, performanten und sicheren Betrieb).
        </p>
        <p>
          <strong>Speicherdauer:</strong> Protokolldateien werden flüchtig für Fehler- und
          Sicherheitsanalysen vorgehalten (in der Regel 7 bis 14 Tage) und danach gelöscht oder
          vollständig anonymisiert.
        </p>

        <div v-if="isLandingPage" class="legal-card-info">
          <strong>Besonderer Hinweis zum Hosting dieser Landing Page (GitHub Pages):</strong>
          <p>
            Diese Landing Page wird als statische Website über <em>GitHub Pages</em> gehostet
            (GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, USA). Beim Besuch der
            Seite erfasst GitHub technische Verbindungsdaten in Server-Logs. Die Übermittlung in die
            USA erfolgt auf Grundlage des EU-US Data Privacy Frameworks bzw.
            Standardvertragsklauseln der Europäischen Kommission.
          </p>
        </div>
      </section>

      <!-- 4. Benutzerkonto & Authentifizierung -->
      <section v-if="!isLandingPage" class="legal-section">
        <h2>4. Benutzerkonto, Registrierung &amp; Reisedaten</h2>
        <p>
          Für die Nutzung von Reisotor ist ein Benutzerkonto erforderlich (sofern die Registrierung
          oder Kontoeinrichtung durch einen Admin aktiviert ist):
        </p>
        <ul>
          <li>
            <strong>Verarbeitete Daten:</strong> Benutzername, E-Mail-Adresse, kryptografischer
            Passwort-Hash (erzeugt mit bcrypt und individueller Salt-Verschlüsselung; dein
            Klartext-Passwort ist für niemanden lesbar).
          </li>
          <li>
            <strong>Reiseinhalte:</strong> Urlaube, Termine, Notizen, Packlisten, Einkaufslisten,
            Ausflugsziele (Spots), Reiserouten, Budgeteinträge und Tagebücher, die du und deine
            Mitreisenden eingeben.
          </li>
          <li>
            <strong>Zweck:</strong> Ermöglichung der gemeinsamen Urlaubs- und Reiseorganisation,
            Rechteverwaltung und Zugriffsschutz für private Urlaube.
          </li>
          <li>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
            Nutzungsverhältnisses).
          </li>
        </ul>
      </section>

      <!-- 5. Cookies & Lokaler Speicher (§ 25 TDDDG) -->
      <section class="legal-section">
        <h2>5. Cookies &amp; lokaler Speicher im Browser (§ 25 TDDDG)</h2>
        <p>
          Reisotor nutzt weder Werbe-Cookies noch Tracking-Technologien. Alle im Browser
          gespeicherten Daten dienen ausschließlich der Bereitstellung der gewünschten Funktionen:
        </p>

        <h3>Session-Cookie (<code>sessionId</code>)</h3>
        <p>Bei der Anmeldung wird ein einziges technisch notwendiges Cookie gesetzt:</p>
        <ul>
          <li><strong>Name:</strong> <code>sessionId</code></li>
          <li>
            <strong>Zweck:</strong> Hält deine sichere Anmeldung aufrecht, damit du bei jedem
            Seitenwechsel authentifiziert bleibst.
          </li>
          <li>
            <strong>Schutzmerkmale:</strong> <code>HttpOnly</code> (nicht durch Skripte lesbar,
            Schutz vor XSS), <code>SameSite=Lax</code> (Schutz vor Cross-Site-Request-Forgery),
            <code>Secure</code> (bei HTTPS-Verbindungen).
          </li>
          <li>
            <strong>Gültigkeit:</strong> 30 Tage („angemeldet bleiben“) oder bis zum manuellen
            Abmelden.
          </li>
          <li>
            <strong>Rechtsgrundlage:</strong> § 25 Abs. 2 Nr. 2 TDDDG (technisch unbedingt
            erforderlich) und Art. 6 Abs. 1 lit. b DSGVO. Keine Einwilligung erforderlich.
          </li>
        </ul>

        <h3>Lokaler Browser-Speicher (localStorage, IndexedDB &amp; Service Worker)</h3>
        <p>
          Als moderne Progressive Web App (PWA) nutzt Reisotor lokalen Speicher auf deinem Endgerät:
        </p>
        <ul>
          <li>
            <strong>App-Shell &amp; Offline-Verfügbarkeit:</strong> Der Service Worker speichert die
            Oberfläche (HTML, CSS, App-Code, lokale Schriften und Icons) lokal zwischen, damit die
            App auch ohne Internetverbindung blitzschnell startet und bedienbar bleibt.
          </li>
          <li>
            <strong>Persönliche Einstellungen:</strong> Farbschema (Hell/Dunkel), Ansichtsmodi und
            Sortierungen.
          </li>
          <li>
            <strong>Formular-Entwürfe (Drafts):</strong> Unvollendete Texteingaben werden lokal
            gespeichert, damit bei versehentlichem Schließen oder Funklöchern keine Eingaben
            verloren gehen.
          </li>
          <li>
            <strong>Reisedaten- &amp; Kachel-Cache:</strong> Bereits abgerufene Urlaubsdaten und
            angesehene Kartenkacheln werden lokal gespeichert, um erneuten Datenverbrauch zu
            verhindern und Offline-Planung zu ermöglichen.
          </li>
        </ul>
        <p>
          <strong>Rechtsgrundlage:</strong> § 25 Abs. 2 Nr. 2 TDDDG (technisch unbedingt
          erforderlich für den vom Nutzer ausdrücklich angeforderten Offline- und PWA-Betrieb).
        </p>
      </section>

      <!-- 6. Externe Dienste & Schnittstellen (Reisotor APIs) -->
      <section v-if="!isLandingPage" class="legal-section">
        <h2>6. Externe Dienste, Schnittstellen &amp; Drittlandtransfers</h2>
        <p>
          Reisotor greift auf externe Dienste zurück, um dir Karten, Wetter und Ortsinformationen
          bereitzustellen. Dabei setzen wir auf maximale Datensparsamkeit und schirmen deine
          IP-Adresse ab, wo immer es technisch möglich ist:
        </p>

        <!-- 6.1 Kartenanzeige (OpenStreetMap) -->
        <div class="legal-subsection">
          <h3>6.1 Kartendarstellung &amp; Kacheln (OpenStreetMap Foundation)</h3>
          <p>
            Karten werden mithilfe der Open-Source-Bibliothek <em>Leaflet</em> dargestellt. Die
            visuellen Kartenkacheln werden direkt vom Browser von den Kachelservern der
            <strong>OpenStreetMap Foundation</strong> (St John’s Innovation Centre, Cowley Road,
            Cambridge, CB4 0WS, Vereinigtes Königreich / UK) geladen
            (<code>tile.openstreetmap.org</code>).
          </p>
          <ul>
            <li>
              <strong>Datenübermittlung:</strong> Beim Laden einer Karte übermittelt dein Browser
              technisch bedingt deine IP-Adresse sowie die Koordinaten des angeforderten
              Kartenausschnitts an die Server der OpenStreetMap Foundation.
            </li>
            <li>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (die Kartendarstellung
              ist eine vertragliche Haupt- und Kernfunktion einer Reiseplanungsanwendung) und Art. 6
              Abs. 1 lit. f DSGVO.
            </li>
            <li>
              <strong>Keine Cookies:</strong> Die OpenStreetMap-Kachelserver setzen keine Cookies (§
              25 TDDDG ist nicht berührt).
            </li>
            <li>
              <strong>Standard-Spotbilder:</strong> Für neu angelegte Orte ohne eigenes Foto erzeugt
              Reisotor eine Kachel-Vorschau (<code>tilePreviewUrl</code>), die auf demselben Weg
              geladen wird.
            </li>
            <li>
              <strong>Lokales Caching:</strong> Einmal betrachtete Kacheln werden durch den Service
              Worker lokal auf deinem Gerät zwischengespeichert, um unnötigen Datenverkehr zu
              vermeiden.
            </li>
          </ul>
        </div>

        <!-- 6.2 Wetter (Open-Meteo über Backend-Proxy) -->
        <div class="legal-subsection">
          <h3>6.2 Wetterdaten &amp; Vorhersagen (Open-Meteo Backend-Proxy)</h3>
          <p>
            Wetterdaten, Regenwahrscheinlichkeiten und Unwetterwarnungen werden über
            <strong>Open-Meteo</strong> bezogen.
          </p>
          <ul>
            <li>
              <strong>Proxy-Schutz für deine IP:</strong> Das Frontend bzw. dein Browser ruft
              Open-Meteo niemals direkt auf. Sämtliche Wetterabfragen laufen über einen
              authentifizierten Backend-Proxy auf unserem Reisotor-Server (<code
                >GET /api/weather</code
              >). Open-Meteo sieht zu keinem Zeitpunkt deine persönliche IP-Adresse.
            </li>
            <li>
              <strong>Koordinaten-Rundung:</strong> Zur Wahrung der Privatsphäre rundet unser Server
              geografische Koordinaten vor der Weitergabe an Open-Meteo auf zwei Nachkommastellen
              (ca. 1 km Unschärfe).
            </li>
            <li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.</li>
          </ul>
        </div>

        <!-- 6.3 Ortssuche & Geocoding (Photon & Nominatim) -->
        <div class="legal-subsection">
          <h3>6.3 Ortssuche, Autovervollständigung &amp; Geocoding (Photon &amp; Nominatim)</h3>
          <p>
            Bei der Suche nach Orten, Gastronomie, Sehenswürdigkeiten oder Adressen unterstützt dich
            Reisotor mit einer schnellen Autovervollständigung:
          </p>
          <ul>
            <li>
              <strong>Datenfluss:</strong> Eingegebene Suchbegriffe werden vom Browser an das
              Reisotor-Backend gesendet. Der Reisotor-Server leitet die Anfrage serverseitig an den
              Geocoding-Dienst weiter:
              <template v-if="services.isCustomPhoton">
                auf dieser Instanz an eine eigene, selbst gehostete Photon-Instanz (<code>{{
                  services.photonUrl
                }}</code
                >).
              </template>
              <template v-else>
                an den öffentlichen Geocoding-Dienst
                <em>Komoot Photon</em> (<code>photon.komoot.io</code>).
              </template>
              <template v-if="services.nominatimEnabled">
                Bei unvollständigen Ergebnissen wird ergänzend
                <em>OpenStreetMap Nominatim</em> (<code>{{ services.nominatimUrl }}</code
                >) als Fallback abgefragt.
              </template>
            </li>
            <li>
              <strong>Hinweis zu Adressdaten &amp; Heimatorten:</strong> Wenn du deine private
              Heimatadresse oder sensible private Orte im Suchfeld suchst oder auf der Karte als
              Heimatort (<code>is_home</code>) festlegst, wird der entsprechende Suchtext
              serverseitig an den Geocoder übertragen. Deine IP-Adresse wird nicht an den Geocoder
              übermittelt (der Dienst sieht nur die IP-Adresse des Reisotor-Servers).
            </li>
            <li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.</li>
          </ul>
        </div>

        <!-- 6.4 Routenberechnung (OpenRouteService) -->
        <div class="legal-subsection">
          <h3>6.4 Routenberechnung &amp; Fahrzeiten (OpenRouteService)</h3>
          <template v-if="services.orsConfigured">
            <p>
              Zur Ermittlung von Straßenverläufen, Radwegen und Fahrzeiten für Etappen und Touren
              werden Start- und Zielkoordinaten serverseitig an <strong>OpenRouteService</strong>
              (HeiGIT gGmbH, Heidelberg, Deutschland) übermittelt.
            </p>
            <p>
              Die Abfrage erfolgt ausschließlich durch unseren Server; deine Browser-IP wird nicht
              weitergegeben. Berechnete Strecken werden im lokalen Cache dauerhaft gespeichert.
            </p>
          </template>
          <template v-else>
            <p>
              Auf dieser Instanz ist kein externer Routing-Dienst (OpenRouteService) angebunden.
              Reiserouten werden rein mathematisch als geschwungene Luftlinien im Browser
              gezeichnet; es werden hierfür keine Streckendaten an externe Server übermittelt.
            </p>
          </template>
          <p><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.</p>
        </div>

        <!-- 6.5 Bildersuche & Vorschaufotos -->
        <div class="legal-subsection">
          <h3>6.5 Bildersuche &amp; Bildschutz (Wikimedia Commons &amp; Websuche)</h3>
          <p>
            Beim Anlegen von Ausflugszielen und Spots sucht Reisotor serverseitig nach passenden
            Vorschaubildern:
          </p>
          <ul>
            <li>
              <strong>Suchanfrage:</strong> Der Suchbegriff (z. B. Name der Sehenswürdigkeit) wird
              vom Reisotor-Server an Wikipedia / Wikimedia Commons sowie an Bildindizes (Bing,
              Yahoo) übermittelt.
            </li>
            <li>
              <strong>Drittlandtransfer:</strong> Microsoft Corporation (Bing) und Yahoo Inc. haben
              ihren Hauptsitz in den USA. Die Übermittlung von Suchbegriffen erfolgt serverseitig
              auf Basis des Angemessenheitsbeschlusses (EU-US Data Privacy Framework). Es werden
              keine Nutzer-IPs, Nutzerkontodaten oder Cookies an Bing oder Yahoo übertragen.
            </li>
            <li>
              <strong>Schutz beim Betrachten von Bildern:</strong> Ausgewählte Titelbilder werden
              entweder direkt auf dem Reisotor-Server gespeichert oder über einen serverseitigen
              Bild-Proxy (<code>/api/images/proxy</code>) ausgeliefert. Dadurch baut dein Browser
              beim Anschauen von Spots <strong>keine Verbindung zu externen Drittservern</strong>
              auf. Deine IP-Adresse verbleibt geschützt bei deinem Reisotor-Server.
            </li>
            <li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.</li>
          </ul>
        </div>

        <!-- 6.6 Länderinfos & Währungskurse -->
        <div class="legal-subsection">
          <h3>6.6 Länderinformationen &amp; Wechselkurse</h3>
          <p>
            Zur Anzeige von Landeswährung, Landessprachen und aktuellen Wechselkursen ruft der
            Reisotor-Server tagesaktuelle Kurse von <em>open.er-api.com</em> und
            <em>REST Countries</em> ab. Diese Abfragen erfolgen rein serverseitig und enthalten
            keine personenbezogenen Daten.
          </p>
        </div>

        <!-- 6.7 Geteilte Karten-Links -->
        <div class="legal-subsection">
          <h3>6.7 Auflösen geteilter Karten-Links (Unshortener)</h3>
          <p>
            Fügst du einen geteilten Kurzlink (z. B. von Google Maps oder Apple Maps) ein, löst
            unser Server die Zielkoordinaten auf. Dein Browser verbindet sich dabei nicht mit Google
            oder Apple.
          </p>
        </div>

        <!-- 6.8 Push-Nachrichten -->
        <div v-if="services.pushConfigured" class="legal-subsection">
          <h3>6.8 Web-Push-Benachrichtigungen (Optional)</h3>
          <p>
            Du kannst in den Einstellungen freiwillig Erinnerungen für anstehende Reisen aktivieren.
            Hierbei wird eine anonyme Empfängeradresse (Push-Subscription) generiert und über den
            Push-Dienst deines Betriebssystems (Apple, Google, Mozilla) verschlüsselt zugestellt.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Du kannst
            die Benachrichtigungen jederzeit in den App-Einstellungen oder den
            Browser-Berechtigungen widerrufen.
          </p>
        </div>

        <!-- 6.9 Feedback -->
        <div v-if="services.githubFeedbackConfigured" class="legal-subsection">
          <h3>6.9 Feedback &amp; Fehlerberichte (Optional)</h3>
          <p>
            Wenn du das Feedback-Formular in den Einstellungen nutzt, wird deine Nachricht (zusammen
            mit einem optionalen Bildschirmfoto) über die GitHub API als Issue im
            Reisotor-Repository eingereicht.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Bitte achte
            darauf, in Feedbacktexten oder Screenshots keine privaten Adressen oder vertraulichen
            Notizen mitzusenden.
          </p>
        </div>
      </section>

      <!-- 7. Speicherdauer & Datenlöschung -->
      <section class="legal-section">
        <h2>7. Speicherdauer &amp; Datenlöschung</h2>
        <p>
          Wir verarbeiten und speichern deine Daten nur so lange, wie es für die Zwecke dieser
          Reiseplanung erforderlich ist:
        </p>
        <ul>
          <li>
            <strong>Reisedaten:</strong> Bleiben gespeichert, solange dein Konto und der jeweilige
            Urlaub bestehen.
          </li>
          <li>
            <strong>Papierkorb:</strong> Gelöschte Einträge verbleiben bis zu 30 Tage im
            Urlaubs-Papierkorb, damit sie bei versehentlichem Löschen wiederhergestellt werden
            können, und werden danach unwiderruflich gelöscht.
          </li>
          <li>
            <strong>Kontolöschung:</strong> Wird ein Benutzerkonto oder ein Urlaub gelöscht, werden
            alle zugehörigen Daten unmittelbar und vollständig aus der Datenbank entfernt.
          </li>
        </ul>
      </section>

      <!-- 8. Betroffenenrechte (Art. 15-21 DSGVO) -->
      <section class="legal-section">
        <h2>8. Deine Rechte als betroffene Person</h2>
        <p>
          Nach der Datenschutz-Grundverordnung stehen dir folgende gesetzliche Rechte gegenüber dem
          Verantwortlichen zu:
        </p>
        <ul>
          <li>
            <strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Du hast das Recht, eine Bestätigung
            darüber zu verlangen, ob und welche deiner Daten verarbeitet werden.
          </li>
          <li>
            <strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong> Du kannst unvollständige oder
            unrichtige Daten jederzeit selbst in der App korrigieren oder korrigieren lassen.
          </li>
          <li>
            <strong>Recht auf Löschung (Art. 17 DSGVO):</strong> Du kannst die unverzügliche
            Löschung deiner personenbezogenen Daten verlangen.
          </li>
          <li>
            <strong>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> Du hast das
            Recht, die Einschränkung der Verarbeitung deiner Daten zu verlangen.
          </li>
          <li>
            <strong>Recht auf Datenübertragbarkeit (Art. 20 DSGVO):</strong> Du hast das Recht,
            deine Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten
            (z. B. über den vollständigen SQLite-Backup-Export).
          </li>
          <li>
            <strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Du kannst der Verarbeitung deiner
            Daten, die auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO erfolgt, jederzeit
            widersprechen.
          </li>
          <li>
            <strong>Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO):</strong> Du hast das
            Recht, dich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung deiner
            personenbezogenen Daten zu beschweren.
          </li>
        </ul>
      </section>

      <!-- 9. Rechtlicher Hinweis für Betreiber -->
      <footer class="legal-disclaimer-note">
        <p>
          <em>
            Hinweis für Instanzbetreiber:innen: Diese Datenschutzerklärung ist eine vorbereitete
            Mustervorlage. Betreiber:innen einer Reisotor-Instanz müssen eigenverantwortlich prüfen,
            ob alle Angaben auf ihre tatsächliche Server- und Hostingumgebung zutreffen. Sie stellt
            keine Rechtsberatung dar.
          </em>
        </p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.legal-content {
  color: var(--color-text);
  line-height: 1.65;
}

.legal-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  border-bottom: 2px solid var(--color-border);
  padding-bottom: var(--space-1);
}

.legal-tab-btn {
  background: transparent;
  border: none;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
  position: relative;
  transition: color 0.15s ease;
}

.legal-tab-btn:hover {
  color: var(--color-text);
}

.legal-tab-btn.active {
  color: var(--color-primary);
}

.legal-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: calc(-1 * var(--space-1) - 2px);
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

.legal-article {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.legal-header h1 {
  margin: 0 0 var(--space-1) 0;
  font-size: clamp(1.5rem, 3.5vw, 2.1rem);
  color: var(--color-primary-dark);
}

.legal-subtitle {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.95rem;
}

.legal-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legal-section h2 {
  font-size: 1.25rem;
  margin: var(--space-2) 0 0 0;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-1);
}

.legal-subsection {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle, 10px);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legal-subsection h3 {
  font-size: 1.05rem;
  margin: 0;
  color: var(--color-primary-dark);
}

.legal-section p,
.legal-subsection p {
  margin: 0;
}

.legal-section ul,
.legal-subsection ul {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.legal-section li {
  line-height: 1.55;
}

.legal-card-info {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle, 10px);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legal-card-info p {
  margin: 0;
}

.multiline-text {
  white-space: pre-line;
}

.legal-muted {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.legal-alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md-squircle, 10px);
  font-size: 0.95rem;
}

.legal-alert-warning {
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.4);
  color: var(--color-text);
}

.legal-alert-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  line-height: 1;
}

.legal-alert-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.legal-alert-body ul {
  margin: var(--space-1) 0 0 0;
  padding-left: var(--space-4);
}

.legal-disclaimer-note {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.legal-disclaimer-note p {
  margin: 0;
}

a {
  color: var(--color-primary);
  text-decoration: underline;
}

a:hover {
  text-decoration: none;
}
</style>
