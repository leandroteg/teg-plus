/**
 * Sanitize text returned by AI services (via n8n webhooks).
 *
 * Common problems:
 * 1. Double-encoded unicode: literal "\u00e7" instead of "c" → fix with JSON.parse trick
 * 2. Escaped newlines: literal "\n" instead of actual newline
 * 3. HTML entities: &amp; &lt; &gt; &quot; &#39;
 * 4. Curly/smart quotes that broke during encoding
 * 5. Double-stringified JSON strings (leading/trailing quotes)
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&hellip;': '\u2026',
  '&laquo;': '\u00AB',
  '&raquo;': '\u00BB',
  '&ccedil;': '\u00E7',
  '&Ccedil;': '\u00C7',
  '&atilde;': '\u00E3',
  '&Atilde;': '\u00C3',
  '&otilde;': '\u00F5',
  '&Otilde;': '\u00D5',
  '&aacute;': '\u00E1',
  '&eacute;': '\u00E9',
  '&iacute;': '\u00ED',
  '&oacute;': '\u00F3',
  '&uacute;': '\u00FA',
}

/**
 * Decode escaped unicode sequences like \u00e7 → c-cedilla.
 * Only acts when the string actually contains such sequences.
 */
function decodeUnicodeEscapes(text: string): string {
  if (!/\\u[0-9a-fA-F]{4}/.test(text)) return text
  try {
    // Wrap in quotes and parse as JSON string to let the engine decode
    return JSON.parse(`"${text.replace(/"/g, '\\"')}"`)
  } catch {
    // Fallback: manual replace
    return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  }
}

/**
 * Decode HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text
  let result = text
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, char)
  }
  // Handle numeric entities: &#123; and &#x1F;
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  )
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  )
  return result
}

/**
 * Strip wrapping quotes from double-stringified text.
 */
function stripDoubleStringified(text: string): string {
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    const inner = text.slice(1, -1)
    // Only strip if the result looks like normal text
    if (!inner.startsWith('{') && !inner.startsWith('[')) {
      return inner
    }
  }
  return text
}

/**
 * Main sanitizer: clean up AI-generated text for display.
 */
export function sanitizeAiText(text: string | null | undefined): string {
  if (!text) return ''
  let result = text.trim()
  result = stripDoubleStringified(result)
  result = decodeUnicodeEscapes(result)
  result = decodeHtmlEntities(result)
  // Normalize escaped newlines/tabs that came as literal strings
  result = result.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  // Collapse excessive whitespace (more than 2 consecutive newlines)
  result = result.replace(/\n{3,}/g, '\n\n')
  return result
}

/**
 * Sanitize all string fields in an AI-generated object (shallow, 1-level deep).
 */
export function sanitizeAiObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  for (const key of Object.keys(result)) {
    const val = result[key]
    if (typeof val === 'string') {
      ;(result as Record<string, unknown>)[key] = sanitizeAiText(val)
    }
  }
  return result
}
