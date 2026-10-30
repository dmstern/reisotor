<script setup lang="ts">
import { computed } from 'vue';
import { IconAlertTriangle, IconScale, IconShieldLock } from '@tabler/icons-vue';
import type { LegalConfig } from '../../api/types';

const props = withDefaults(
  defineProps<{
    config: LegalConfig;
    activeTab?: 'privacy' | 'imprint';
    isLandingPage?: boolean;
    showTabs?: boolean;
    loading?: boolean;
  }>(),
  {
    activeTab: 'privacy',
    isLandingPage: false,
    showTabs: true,
    loading: false,
  }
);

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'privacy' | 'imprint'): void;
}>();

const operator = computed(() => props.config.operator);
const services = computed(() => props.config.services);
const hasOperatorInfo = computed(() => props.config.hasOperatorInfo);
const isGitHubPagesHosted = computed(
  () => props.isLandingPage || props.config.hostingLocation.includes('GitHub Pages')
);
const isFeedbackActive = computed(() =>
  Boolean(services.value.githubFeedbackConfigured || services.value.feedbackRelayEnabled)
);
</script>

<template>
  <div class="legal-content">
    <nav v-if="showTabs" class="legal-tabs" aria-label="Rechtliche Informationen">
      <div class="legal-tabs-list">
        <button
          type="button"
          class="legal-tab-btn"
          :class="{ active: activeTab === 'privacy' }"
          :aria-current="activeTab === 'privacy' ? 'page' : undefined"
          @click="emit('update:activeTab', 'privacy')"
        >
          <IconShieldLock :size="18" aria-hidden="true" />
          <span>Datenschutzerklärung</span>
        </button>
        <button
          type="button"
          class="legal-tab-btn"
          :class="{ active: activeTab === 'imprint' }"
          :aria-current="activeTab === 'imprint' ? 'page' : undefined"
          @click="emit('update:activeTab', 'imprint')"
        >
          <IconScale :size="18" aria-hidden="true" />
          <span>Impressum</span>
        </button>
      </div>
      <div v-if="$slots['tabs-end']" class="legal-tabs-end">
        <slot name="tabs-end" />
      </div>
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

        <div v-if="loading" class="legal-card-info">
          <p class="legal-muted">Lade Betreiberangaben…</p>
        </div>

        <div
          v-else-if="!hasOperatorInfo && !isGitHubPagesHosted"
          class="legal-alert legal-alert-warning"
        >
          <div class="legal-alert-icon" aria-hidden="true">
            <IconAlertTriangle :size="18" />
          </div>
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

        <div v-else-if="isGitHubPagesHosted" class="legal-card-info">
          <p>
            <strong>Projekt- &amp; Webseiten-Verantwortlicher:</strong><br />
            {{ operator.name || 'Daniel Morgenstern' }}
            <template v-if="operator.address">
              <br /><span class="multiline-text">{{ operator.address }}</span>
            </template>
            <br />
            E-Mail:
            <a :href="`mailto:${operator.email || 'reisotor@ruebenherz.de'}`">
              {{ operator.email || 'reisotor@ruebenherz.de' }}
            </a>
            <template v-if="operator.phone"><br />Telefon: {{ operator.phone }}</template>
          </p>
          <p class="legal-muted">
            Reisotor ist ein privates, nicht-kommerzielles Open-Source-Projekt. Die Landing Page und
            die Live-Demo dienen ausschließlich der allgemeinen Vorstellung und Dokumentation der
            Software.
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
        <template v-if="isGitHubPagesHosted">
          <p>
            Diese Webpräsenz wird als statische Seite über <strong>GitHub Pages</strong>
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
          unter der
          <a
            href="https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12"
            target="_blank"
            rel="noopener noreferrer"
            >European Union Public Licence v. 1.2 (EUPL-1.2)</a
          >). Die Entwickler:innen und Urheber:innen des Reisotor-Quellcodes stellen lediglich die
          Software bereit und sind nicht verantwortlich für den Betrieb von Fremd-Instanzen, deren
          rechtliche Ausgestaltung oder dort verarbeitete Inhalte.
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
            <strong>Kartenbibliothek:</strong>{{ ' '
            }}<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>
            (BSD-2-Clause-Lizenz).
          </li>
          <li>
            <strong>Symbole &amp; Icons:</strong>{{ ' '
            }}<a href="https://tabler.io/icons" target="_blank" rel="noopener noreferrer"
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

        <div v-if="loading" class="legal-card-info">
          <p class="legal-muted">Lade Betreiberangaben…</p>
        </div>

        <div
          v-else-if="!hasOperatorInfo && !isGitHubPagesHosted"
          class="legal-alert legal-alert-warning"
        >
          <div class="legal-alert-icon" aria-hidden="true">
            <IconAlertTriangle :size="18" />
          </div>
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

        <div v-else-if="isGitHubPagesHosted" class="legal-card-info">
          <p>
            <strong>Projekt- &amp; Webseiten-Verantwortlicher:</strong><br />
            {{ operator.name || 'Daniel Morgenstern' }}
            <template v-if="operator.address">
              <br /><span class="multiline-text">{{ operator.address }}</span>
            </template>
            <br />
            E-Mail:
            <a :href="`mailto:${operator.email || 'reisotor@ruebenherz.de'}`">
              {{ operator.email || 'reisotor@ruebenherz.de' }}
            </a>
            <template v-if="operator.phone"><br />Telefon: {{ operator.phone }}</template>
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
            <strong>E-Mail:</strong>{{ ' '
            }}<a :href="`mailto:${operator.email}`">{{ operator.email }}</a>
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

        <div v-if="isGitHubPagesHosted" class="legal-card-info">
          <strong>Besonderer Hinweis zum Hosting über GitHub Pages:</strong>
          <p>
            Diese Webpräsenz wird als statische Website über <em>GitHub Pages</em> gehostet (GitHub
            Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, USA). Beim Besuch der Seite
            erfasst GitHub technische Verbindungsdaten in Server-Logs. Die Übermittlung in die USA
            erfolgt auf Grundlage des EU-US Data Privacy Frameworks bzw. Standardvertragsklauseln
            der Europäischen Kommission.
          </p>
        </div>
      </section>

      <!-- 4. Benutzerkonto, Registrierung, Reisedaten & Standortfunktionen (nur App) -->
      <section v-if="!isLandingPage" class="legal-section">
        <h2>4. Benutzerkonto, Registrierung, Reisedaten &amp; Standortfunktionen</h2>

        <div v-if="isGitHubPagesHosted" class="legal-card-info">
          <strong>Hinweis zum statischen Demo-Modus:</strong>
          <p>
            In der öffentlichen Live-Demo auf GitHub Pages existiert kein Backend-Server und keine
            Datenbank. Alle angezeigten oder von dir eingegebenen Beispieldaten existieren rein
            flüchtig im Arbeitsspeicher deines Browsers und werden beim Schließen oder Zurücksetzen
            der Demo verworfen.
          </p>
        </div>

        <p>
          Für die Nutzung einer selbst gehosteten Reisotor-Instanz ist ein Benutzerkonto
          erforderlich (sofern die Registrierung oder Kontoeinrichtung durch Administrator:innen
          aktiviert ist):
        </p>
        <ul>
          <li>
            <strong>Kontodaten:</strong> Benutzername, E-Mail-Adresse, Profil-Avatar sowie ein
            kryptografischer Passwort-Hash (erzeugt mit <code>bcrypt</code> und individuellem Salt;
            dein Klartext-Passwort ist für niemanden lesbar).
          </li>
          <li>
            <strong>Auffindbarkeit innerhalb der Instanz:</strong> Angemeldete Nutzer:innen
            derselben Reisotor-Instanz können andere registrierte Konten über Benutzername oder
            E-Mail-Adresse suchen (<code>GET /api/users/search</code>), um sie als Mitreisende zu
            einem gemeinsamen Urlaub einzuladen.
          </li>
          <li>
            <strong>Reiseinhalte &amp; Dateianhänge:</strong> Urlaube, Termine, Notizen, Pack-,
            Einkaufs- und ToDo-Listen, Ausflugsziele (Spots), Reiserouten, Budgeteinträge,
            Tagebücher sowie hochgeladene Bilder und Dateianhänge (z. B. Tickets,
            Buchungsbestätigungen). Diese Inhalte sind strikt auf die eingeladenen Mitglieder
            (<code>trip_members</code>) des jeweiligen Urlaubs beschränkt.
          </li>
          <li>
            <strong>Formular-Entwürfe (Drafts):</strong> Noch nicht gespeicherte Formulareingaben
            werden zur Vermeidung von Datenverlust sowohl lokal im Browser
            (<code>localStorage</code>) als auch persönlich zugeordnet auf dem Reisotor-Server
            (<code>drafts</code>-Tabelle, ausschließlich für dein eigenes Konto einsehbar)
            zwischengespeichert und beim Speichern oder Verwerfen automatisch gelöscht.
          </li>
          <li>
            <strong>Optionale Standortfunktionen (GPS-Tracks &amp; Live-Standort):</strong> Nur wenn
            du die Funktion aktiv startest und im Browser die Standortberechtigung erteilst
            (<code>navigator.geolocation</code>), verarbeitet Reisotor deinen Gerätestandort –
            entweder zur Aufzeichnung von GPS-Routen (<code>location_tracks</code>, standardmäßig
            privat, optional für Urlaubsmitglieder freigebbar) oder zur flüchtigen
            Echtzeit-Standortanzeige auf der Karte (wird nur im Arbeitsspeicher über den
            Echtzeit-Stream an aktive Urlaubsmitglieder übertragen und nicht in der Datenbank
            gespeichert).
          </li>
          <li>
            <strong>Zweck &amp; Rechtsgrundlage:</strong> Ermöglichung der gemeinsamen Reiseplanung,
            Rechteverwaltung und Zugriffsschutz für private Urlaube (Art. 6 Abs. 1 lit. b DSGVO)
            sowie Einwilligung bei optionaler Browser-Standortfreigabe (Art. 6 Abs. 1 lit. a DSGVO).
          </li>
        </ul>
      </section>

      <!-- 4./5. Cookies & Lokaler Speicher (§ 25 TDDDG) -->
      <section class="legal-section">
        <h2>
          {{ isLandingPage ? '4.' : '5.' }} Cookies &amp; lokaler Speicher im Browser (§ 25 TDDDG)
        </h2>
        <p>
          Reisotor nutzt weder Werbe-Cookies noch Tracking-Technologien. Alle im Browser
          gespeicherten Daten dienen ausschließlich der Bereitstellung der gewünschten Funktionen:
        </p>

        <template v-if="isLandingPage">
          <ul>
            <li>
              <strong>Keine Cookies:</strong> Beim Besuch dieser statischen Vorstellungsseite werden
              keinerlei Cookies auf deinem Endgerät gesetzt.
            </li>
            <li>
              <strong>Darstellungseinstellungen (<code>localStorage</code>):</strong> Wenn du das
              Farbschema (Hell-/Dunkelmodus) umschaltetest, wird diese Auswahl lokal in deinem
              Browser (<code>reisotor-theme-mode</code>) gespeichert. Rechtsgrundlage: § 25 Abs. 2
              Nr. 2 TDDDG (technisch erforderlich für die ausdrücklich gewünschte Darstellung).
            </li>
          </ul>
        </template>

        <template v-else>
          <div class="legal-subsection">
            <h3>5.1 Session-Cookie (<code>sessionId</code>)</h3>
            <p>
              Bei der Anmeldung an einer Reisotor-Serverinstanz wird ein einziges technisch
              notwendiges Cookie gesetzt (im statischen Demo-Modus auf GitHub Pages wird kein
              Session-Cookie gesetzt):
            </p>
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
          </div>

          <div class="legal-subsection">
            <h3>5.2 Lokaler Browser-Speicher (localStorage, Cache-Storage &amp; Service Worker)</h3>
            <p>
              Als moderne Progressive Web App (PWA) nutzt Reisotor lokalen Speicher auf deinem
              Endgerät:
            </p>
            <ul>
              <li>
                <strong>App-Shell &amp; Offline-Verfügbarkeit:</strong> Der Service Worker speichert
                die Oberfläche (HTML, CSS, App-Code, lokale Schriften und Icons) lokal zwischen,
                damit die App auch ohne Internetverbindung blitzschnell startet und bedienbar
                bleibt.
              </li>
              <li>
                <strong>Persönliche Einstellungen:</strong> Farbschema (Hell/Dunkel), Ansichtsmodi,
                Kalender-Wochenanfang und Sortierungen.
              </li>
              <li>
                <strong>Formular-Entwürfe (Drafts):</strong> Unvollendete Texteingaben werden lokal
                gespeichert, damit bei versehentlichem Schließen oder Funklöchern keine Eingaben
                verloren gehen.
              </li>
              <li>
                <strong>Reisedaten- &amp; Kachel-Cache:</strong> Bereits abgerufene Urlaubsdaten
                (inkl. Offline-Warteschlange für Änderungen ohne Netz) und angesehene Kartenkacheln
                werden lokal gespeichert, um erneuten Datenverbrauch zu verhindern und
                Offline-Planung zu ermöglichen.
              </li>
            </ul>
            <p>
              <strong>Rechtsgrundlage:</strong> § 25 Abs. 2 Nr. 2 TDDDG (technisch unbedingt
              erforderlich für den vom Nutzer ausdrücklich angeforderten Offline- und PWA-Betrieb).
            </p>
          </div>
        </template>
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
              <strong>Datenübermittlung &amp; Drittlandtransfer (UK):</strong> Beim Laden einer
              Karte übermittelt dein Browser technisch bedingt deine IP-Adresse sowie die
              Koordinaten des angeforderten Kartenausschnitts an die Server der OpenStreetMap
              Foundation. Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der
              Europäischen Kommission gemäß Art. 45 DSGVO.
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
              Open-Meteo niemals direkt auf. Sämtliche Wetterabfragen (sowie die täglichen
              serverseitigen Wetter-Snapshots zur Trendanalyse) laufen über einen authentifizierten
              Backend-Proxy auf unserem Reisotor-Server (<code>GET /api/weather</code>). Open-Meteo
              sieht zu keinem Zeitpunkt deine persönliche IP-Adresse.
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
            Bei der Suche nach Orten, Gastronomie, Sehenswürdigkeiten oder Adressen sowie bei der
            Adressermittlung aus Kartenkoordinaten (Reverse-Geocoding) unterstützt dich Reisotor mit
            einer schnellen Ortssuche:
          </p>
          <ul>
            <li>
              <strong>Datenfluss:</strong> Eingegebene Suchbegriffe und Koordinaten werden vom
              Browser an das Reisotor-Backend gesendet. Der Reisotor-Server leitet die Anfrage
              serverseitig an den Geocoding-Dienst weiter:
              <template v-if="services.isCustomPhoton">
                auf dieser Instanz an eine eigene, selbst gehostete Photon-Instanz (<code>{{
                  services.photonUrl
                }}</code
                >).
              </template>
              <template v-else>
                an den öffentlichen Geocoding-Dienst
                <em>Komoot Photon</em> (<code>photon.komoot.io</code>, betrieben von der komoot
                GmbH, Potsdam, Deutschland).
              </template>
              <template v-if="services.nominatimEnabled">
                Bei Phrasen- und Kategoriesuchen oder unvollständigen Ergebnissen wird ergänzend
                <template v-if="services.isCustomNominatim">
                  eine eigene Nominatim-Instanz (<code>{{ services.nominatimUrl }}</code
                  >)
                </template>
                <template v-else>
                  <em>OpenStreetMap Nominatim</em> (<code>{{ services.nominatimUrl }}</code
                  >)
                </template>
                als Fallback abgefragt.
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
              weitergegeben. Berechnete Strecken werden im lokalen Server-Cache dauerhaft
              gespeichert.
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
              <strong>Suchanfrage:</strong> Der sachliche Suchbegriff (z. B. Name der
              Sehenswürdigkeit, ergänzt um Ortsnamen und Kategorie) sowie bei der
              Wikipedia-Umkreissuche (<code>geosearch</code>) die Spot-Koordinaten werden vom
              Reisotor-Server an <strong>Wikipedia / Wikimedia Commons</strong> (Wikimedia
              Foundation, Inc., USA) sowie an die Web-Bildindizes von
              <strong>Bing</strong> (Microsoft Corporation, USA) und als Fallback
              <strong>DuckDuckGo</strong> (Duck Duck Go, Inc., USA) übermittelt.
            </li>
            <li>
              <strong>Kein Personenbezug bei der Suche:</strong> Sämtliche Suchabfragen erfolgen
              ausschließlich serverseitig durch das Reisotor-Backend. Es werden zu keinem Zeitpunkt
              Nutzer-IP-Adressen, Kontodaten oder Browser-Cookies an Wikimedia, Bing oder DuckDuckGo
              übertragen.
            </li>
            <li>
              <strong>Schutz beim Speichern &amp; Betrachten von Bildern:</strong> Ausgewählte
              Titelbilder werden beim Speichern durch den Server heruntergeladen und lokal abgelegt
              bzw. bei der Anzeige und Vorschau über einen serverseitigen Bild-Proxy
              (<code>/api/images/proxy</code>) ausgeliefert. Dadurch baut dein Browser beim
              Anschauen von Spots <strong>keine Verbindung zu externen Drittservern</strong> auf.
              Deine IP-Adresse verbleibt geschützt bei deinem Reisotor-Server.
            </li>
            <li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.</li>
          </ul>
        </div>

        <!-- 6.6 Länderinfos & Währungskurse -->
        <div class="legal-subsection">
          <h3>6.6 Länderinformationen &amp; Wechselkurse</h3>
          <p>
            Zur Anzeige von Landeswährung, Landessprachen und aktuellen Wechselkursen im
            Reise-Dashboard bestimmt der Reisotor-Server einmalig das Zielland anhand der
            Urlaubskoordinaten über
            <em>OpenStreetMap Nominatim</em> (<code>nominatim.openstreetmap.org/reverse</code>) und
            ruft anschließend die Eckdaten von
            <em>REST Countries</em> (<code>restcountries.com</code>) sowie
            <em>open.er-api.com</em> ab. Diese Abfragen erfolgen rein serverseitig, werden
            zwischengespeichert und übermitteln keine Nutzer-IP.
          </p>
        </div>

        <!-- 6.7 Geteilte Karten-Links -->
        <div class="legal-subsection">
          <h3>6.7 Auflösen geteilter Karten-Links (Unshortener)</h3>
          <p>
            Fügst du einen geteilten Kurzlink (z. B. von Google Maps, Apple Maps oder OpenStreetMap)
            ein, löst unser Server die Weiterleitungen und Zielkoordinaten serverseitig auf. Dein
            Browser verbindet sich dabei nicht mit Google oder Apple.
          </p>
        </div>

        <!-- 6.8 Push-Nachrichten -->
        <div v-if="services.pushConfigured" class="legal-subsection">
          <h3>6.8 Web-Push-Benachrichtigungen (Optional)</h3>
          <p>
            Du kannst in den Einstellungen freiwillig Erinnerungen für anstehende Reisen aktivieren.
            Hierbei wird eine kryptografische Empfängeradresse (Push-Subscription) generiert und
            über den Push-Dienst deines Browsers bzw. Betriebssystems (Mozilla, Apple, Google) nach
            dem W3C-Web-Push-Standard (VAPID) verschlüsselt zugestellt.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Du kannst
            die Benachrichtigungen jederzeit mit Wirkung für die Zukunft in den App-Einstellungen
            oder den Browser-Berechtigungen deaktivieren.
          </p>
        </div>

        <!-- 6.9 Feedback -->
        <div v-if="isFeedbackActive" class="legal-subsection">
          <h3>6.9 Feedback &amp; Fehlerberichte (Optional)</h3>
          <p>
            Wenn du das Feedback-Formular in der Anwendung nutzt, werden deine Angaben (Titel,
            Beschreibung, App-Version, optionaler Screenshot sowie dein Benutzername bzw. eine
            angegebene oder im Konto hinterlegte Kontakt-E-Mail-Adresse)
            <template v-if="services.githubFeedbackConfigured">
              direkt über die <strong>GitHub API</strong>
            </template>
            <template v-else>
              über den konfigurierten <strong>Reisotor-Feedback-Relay</strong> an die
              <strong>GitHub API</strong>
            </template>
            übermittelt und als <strong>öffentliches Issue</strong> im GitHub-Repository des
            Projekts (GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, USA;
            zertifiziert unter dem EU-US Data Privacy Framework) veröffentlicht.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch aktives
            Absenden des Formulars). Bitte achte darauf, in Feedbacktexten oder Screenshots keine
            privaten Adressen oder vertraulichen Reisedaten mitzusenden, da GitHub-Issues öffentlich
            einsehbar sind.
          </p>
        </div>
      </section>

      <!-- 7. Speicherdauer & Datenlöschung (nur App) -->
      <section v-if="!isLandingPage" class="legal-section">
        <h2>7. Speicherdauer &amp; Datenlöschung</h2>
        <p>
          Wir verarbeiten und speichern deine Daten nur so lange, wie es für die Zwecke dieser
          Reiseplanung erforderlich ist:
        </p>
        <ul>
          <li>
            <strong>Reisedaten:</strong> Bleiben gespeichert, solange der jeweilige Urlaub auf der
            Instanz besteht.
          </li>
          <li>
            <strong>Papierkorb:</strong> Gelöschte Einträge verbleiben bis zu 30 Tage im
            Urlaubs-Papierkorb, damit sie bei versehentlichem Löschen wiederhergestellt werden
            können (oder jederzeit manuell endgültig geleert werden können), und werden danach
            automatisch unwiderruflich gelöscht.
          </li>
          <li>
            <strong>Urlaubs- &amp; Kontolöschung:</strong> Wird ein Urlaub gelöscht, werden alle
            zugehörigen Reiseeinträge und Dateianhänge vollständig gelöscht. Wird ein Benutzerkonto
            gelöscht, werden die Kontodaten, Sitzungen, Entwürfe, Push-Abonnements, persönlichen
            Standort-Tracks, Tagebucheinträge, Kommentare und Likes unmittelbar aus der Datenbank
            entfernt; in gemeinsam genutzten Urlauben bleiben kollaborative Planungseinträge (z. B.
            Spots, Ausflüge, Listenpunkte, Ausgaben) für die Mitreisenden erhalten, wobei der
            Personenbezug zum gelöschten Konto anonymisiert (<code>NULL</code>) wird.
          </li>
        </ul>
      </section>

      <!-- 5./8. Betroffenenrechte (Art. 15-21, 7, 77 DSGVO) -->
      <section class="legal-section">
        <h2>{{ isLandingPage ? '5.' : '8.' }} Deine Rechte als betroffene Person</h2>
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
            (z. B. durch Bereitstellung über die Administrator:innen bzw. Betreiber:innen der
            Instanz).
          </li>
          <li>
            <strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Du kannst der Verarbeitung deiner
            Daten, die auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO erfolgt, jederzeit
            widersprechen.
          </li>
          <li>
            <strong>Recht auf Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO):</strong> Soweit
            eine Verarbeitung auf deiner Einwilligung beruht (z. B. optionale Standortfreigabe,
            Web-Push-Benachrichtigungen oder Feedback-Übermittlung), kannst du diese Einwilligung
            jederzeit mit Wirkung für die Zukunft widerrufen.
          </li>
          <li>
            <strong>Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO):</strong> Du hast das
            Recht, dich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung deiner
            personenbezogenen Daten zu beschweren.
          </li>
        </ul>
      </section>

      <!-- Rechtlicher Hinweis für Betreiber -->
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
  overflow-wrap: break-word;
}

.legal-tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-6) 0;
  background: color-mix(in srgb, var(--color-primary-tint) 45%, var(--color-surface));
  border-bottom: 1px solid var(--color-border);
}

.legal-tabs-list {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
  margin-left: calc(-1 * var(--space-3));
}

.legal-tabs-list::-webkit-scrollbar {
  display: none;
}

.legal-tabs-end {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-bottom: var(--space-2);
}

.legal-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  box-shadow: none;
  font-size: var(--font-size-md, 1rem);
  font-weight: 600;
  color: var(--color-text-muted);
  padding: var(--space-2) var(--space-3);
  min-block-size: 44px;
  cursor: pointer;
  border-radius: var(--radius-sm-squircle) var(--radius-sm-squircle) 0 0;
  corner-shape: squircle;
  position: relative;
  white-space: nowrap;
  transition:
    color var(--transition-fast, 0.15s ease),
    background-color var(--transition-fast, 0.15s ease);
}

.legal-tab-btn:hover {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.legal-tab-btn.active {
  color: var(--color-primary-dark);
}

.legal-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: var(--space-3);
  right: var(--space-3);
  height: 3px;
  border-radius: var(--radius-pill, 9999px);
  background: var(--color-primary);
}

.legal-article {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
}

@media (max-width: 799px) {
  .legal-tabs {
    padding: var(--space-2) var(--space-4) 0;
  }

  .legal-article {
    padding: var(--space-4);
  }
}

@media (max-width: 600px) {
  .legal-tabs {
    padding: var(--space-2) var(--space-3) 0;
  }

  .legal-tabs-list {
    margin-left: calc(-1 * var(--space-2));
  }

  .legal-tab-btn {
    padding: var(--space-2);
    font-size: 0.95rem;
  }

  .legal-tab-btn.active::after {
    left: var(--space-2);
    right: var(--space-2);
  }

  .legal-article {
    padding: var(--space-4) var(--space-3);
  }
}

.legal-header {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.legal-header h1 {
  margin: 0 0 var(--space-2) 0;
  font-size: clamp(1.5rem, 1.1rem + 2vw, 2rem);
  line-height: 1.2;
  letter-spacing: -0.015em;
  color: var(--color-primary-dark);
  text-wrap: balance;
}

.legal-subtitle {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  text-wrap: pretty;
}

.legal-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.legal-section + .legal-section {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.legal-section h2 {
  font-size: var(--font-size-lg, 1.15rem);
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
  color: var(--color-text);
  text-wrap: balance;
}

.legal-subsection,
.legal-card-info {
  background: var(--color-surface-sunken, var(--color-bg));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 600px) {
  .legal-subsection,
  .legal-card-info {
    padding: var(--space-3);
  }
}

.legal-section h3,
.legal-subsection h3 {
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
  color: var(--color-primary-dark);
  text-wrap: balance;
}

.legal-section p,
.legal-subsection p,
.legal-card-info p {
  margin: 0;
  color: color-mix(in srgb, var(--color-text) 88%, var(--color-text-muted));
  text-wrap: pretty;
}

.legal-article strong {
  color: var(--color-text);
  font-weight: 600;
}

.legal-section ul,
.legal-subsection ul {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legal-section li,
.legal-subsection li {
  line-height: 1.6;
  color: color-mix(in srgb, var(--color-text) 88%, var(--color-text-muted));
  text-wrap: pretty;
}

.legal-section li::marker,
.legal-subsection li::marker,
.legal-alert-body li::marker {
  color: var(--color-primary);
}

.multiline-text {
  white-space: pre-line;
}

.legal-muted,
.legal-section p.legal-muted,
.legal-card-info p.legal-muted {
  font-size: var(--font-size-sm, 0.85rem);
  color: var(--color-text-muted);
}

.legal-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .legal-alert {
    padding: var(--space-3);
  }
}

.legal-alert-warning {
  background: var(--color-warning-tint);
  border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
  color: var(--color-text);
}

.legal-alert-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
  flex-shrink: 0;
  margin-top: 2px;
}

.legal-alert-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.legal-alert-body p {
  margin: 0;
  color: color-mix(in srgb, var(--color-text) 90%, var(--color-text-muted));
}

.legal-alert-body ul {
  margin: var(--space-1) 0 0 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.legal-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.84em;
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
  padding: 0.1em 0.42em;
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  color: var(--color-text);
  overflow-wrap: break-word;
}

.legal-disclaimer-note {
  margin-top: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px dashed var(--color-border-strong, var(--color-border));
  font-size: var(--font-size-sm, 0.85rem);
  color: var(--color-text-muted);
}

.legal-disclaimer-note p {
  margin: 0;
  color: var(--color-text-muted);
}

.legal-content a {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
  transition:
    color var(--transition-fast, 0.15s ease),
    text-decoration-color var(--transition-fast, 0.15s ease);
}

.legal-content a:hover {
  color: var(--color-primary-dark);
  text-decoration-color: currentColor;
}
</style>
