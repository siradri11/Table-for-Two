const NAMED_ENTITIES = {
  nbsp: '\u00A0',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
}

export function decodeHtmlEntities(text) {
  if (!text) return ''
  return text
    .replace(/&([a-zA-Z]+);/g, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? `&${name};`)
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
