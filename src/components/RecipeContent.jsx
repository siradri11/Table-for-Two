import { decodeHtmlEntities } from '../lib/text'
import './RecipeContent.css'

function parseRecipeContent(raw) {
  const text = decodeHtmlEntities(raw || '').trim()
  if (!text) return []

  const blocks = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }

    if (line.startsWith('# ')) {
      i += 1
      continue
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', text: line.slice(3).trim() })
      i += 1
      continue
    }

    if (line.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2).trim())
        i += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s*/, ''))
        i += 1
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const paraLines = [line]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next || next.startsWith('#') || next.startsWith('- ') || /^\d+\.\s/.test(next)) break
      paraLines.push(next)
      i += 1
    }
    blocks.push({ type: 'p', text: paraLines.join(' ') })
  }

  return blocks
}

export function RecipeContent({ content, className = '' }) {
  const blocks = parseRecipeContent(content)
  if (!blocks.length) return null

  return (
    <div className={`recipe-content ${className}`.trim()}>
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return <h3 key={idx} className="recipe-content__heading">{block.text}</h3>
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="recipe-content__list">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={idx} className="recipe-content__list recipe-content__list--ordered">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          )
        }
        return <p key={idx} className="recipe-content__para">{block.text}</p>
      })}
    </div>
  )
}
