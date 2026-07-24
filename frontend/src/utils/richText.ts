function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;

function formatInline(text: string): string {
  let result = text;
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  result = result.replace(URL_PATTERN, (match) => {
    const href = match.startsWith('http') ? match : `https://${match}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });
  return result;
}

/** Rendert einen kleinen Markdown-Ausschnitt (fett, kursiv, Aufzählungen, Auto-Links) zu
 *  sicherem HTML – im Stil von WhatsApp: die Rohsyntax wird eingegeben, formatiert erst
 *  bei der Anzeige. Escaped zuerst alle HTML-Zeichen, damit v-html gefahrlos ist. */
export function renderRichText(raw: string): string {
  const lines = escapeHtml(raw).split('\n');
  const parts: string[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length) {
      parts.push(`<ul>${listBuffer.map((item) => `<li>${formatInline(item)}</li>`).join('')}</ul>`);
      listBuffer = [];
    }
  }

  for (const line of lines) {
    const bulletMatch = /^[*-]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
    } else {
      flushList();
      parts.push(`${formatInline(line)}<br>`);
    }
  }
  flushList();

  return parts.join('');
}
