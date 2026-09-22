/**
 * STRESS TESTING FIXTURES FÜR STORYBOOK
 *
 * Einheitliche Daten und Wrapper, um Komponenten auf der Mikro-Ebene gegen
 * Layout-Brüche, Text-Overflows und extreme Container-Größen abzutesten.
 */

export const STRESS_STRINGS = {
  /**
   * Extrem langes Einzelwort ohne Leerzeichen.
   * Prüft: word-break, overflow-wrap, hyphens, text-overflow: ellipsis.
   */
  longWord: 'Donaudampfschifffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft',

  /**
   * Extrem langer Pfad / URL / Identifikator ohne Trennzeichen.
   */
  longUrl:
    'https://reisotor.local/trips/1/very-long-path-slug-without-natural-word-breaks-for-adversarial-testing',

  /**
   * Mehrzeiliger Fließtext zur Verifikation des Zeilenumbruchs und Zeilenabstands.
   */
  longSentence:
    'Dies ist ein außergewöhnlich langer Fließtext, der über mehrere Zeilen umbrechen muss, um sicherzustellen, dass die Container-Höhe dynamisch mitwächst und keine Geschwister-Elemente überlagert oder abgeschnitten werden.',

  /**
   * Sonderzeichen, Skripte, Emojis und RTL-Text (BiDi).
   */
  specialChars:
    '✨ <script>alert("xss")</script> & "Anführungszeichen" / 日本語 / 12.345,67 € 🏔️ ✈️',

  /**
   * Leerer Text / Minimalwert.
   */
  empty: '',
};

/**
 * Inline-Styles für enge Stress-Container mit visueller Begrenzung (rote gestrichelte Linie).
 * So sieht man in Storybook sofort, wenn ein Element seitlich ausbricht.
 */
export const STRESS_CONTAINERS = {
  /**
   * Enge Spalte (240px) – typisch für Cards in schmalen Grids oder bei geöffneter Schublade.
   */
  narrow: {
    maxWidth: '240px',
    border: '1.5px dashed var(--color-danger, #e53e3e)',
    borderRadius: 'var(--radius-md-squircle, 8px)',
    padding: '8px',
    boxSizing: 'border-box' as const,
  },

  /**
   * Extrem enge Spalte (160px) – Mobile Sidebar, schmale Chips, kompakte Tabellen.
   */
  ultraNarrow: {
    maxWidth: '160px',
    border: '1.5px dashed var(--color-danger, #e53e3e)',
    borderRadius: 'var(--radius-md-squircle, 8px)',
    padding: '6px',
    boxSizing: 'border-box' as const,
  },
};
