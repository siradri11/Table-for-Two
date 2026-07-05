import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function findRecipeNodes(data: unknown): Record<string, unknown>[] {
  if (!data) return []
  if (Array.isArray(data)) return data.flatMap(findRecipeNodes)
  if (typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  const type = obj['@type']
  const types = Array.isArray(type) ? type : type ? [type] : []
  if (types.some((t) => String(t).toLowerCase() === 'recipe')) return [obj]
  if (obj['@graph']) return findRecipeNodes(obj['@graph'])
  return []
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&([a-zA-Z]+);/g, (_, name) => {
      const map: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        ndash: '–',
        mdash: '—',
      }
      return map[name.toLowerCase()] ?? `&${name};`
    })
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function asText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return decodeHtmlEntities(value.trim())
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ')
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return asText((value as { text?: unknown }).text)
  }
  return ''
}

function extractImageUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const url = value.trim()
    return url.startsWith('http') ? url : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractImageUrl(item)
      if (url) return url
    }
    return null
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (typeof obj.url === 'string' && obj.url.startsWith('http')) return obj.url.trim()
    if (typeof obj['@id'] === 'string' && obj['@id'].startsWith('http')) return obj['@id'].trim()
    if (typeof obj.contentUrl === 'string' && obj.contentUrl.startsWith('http')) return obj.contentUrl.trim()
  }
  return null
}

function formatIngredient(ing: unknown): string {
  if (typeof ing === 'string') return ing
  if (typeof ing === 'object' && ing !== null) {
    const o = ing as Record<string, unknown>
    return asText(o.name) || asText(o)
  }
  return asText(ing)
}

function formatInstructions(steps: unknown): string {
  if (!steps) return ''
  const list = Array.isArray(steps) ? steps : [steps]
  return list
    .map((step, i) => {
      if (typeof step === 'string') return `${i + 1}. ${step}`
      if (typeof step === 'object' && step !== null) {
        const s = step as Record<string, unknown>
        const text = asText(s.text) || asText(s.name) || asText(s)
        return text ? `${i + 1}. ${text}` : ''
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function formatRecipe(recipe: Record<string, unknown>): string {
  const parts: string[] = []
  const name = asText(recipe.name)
  if (name) parts.push(`# ${name}`)

  const description = asText(recipe.description)
  if (description) parts.push(description)

  const meta: string[] = []
  const prep = asText(recipe.prepTime)
  const cook = asText(recipe.cookTime)
  const total = asText(recipe.totalTime)
  const yieldVal = asText(recipe.recipeYield)
  if (prep) meta.push(`Prep: ${prep}`)
  if (cook) meta.push(`Cook: ${cook}`)
  if (total) meta.push(`Total: ${total}`)
  if (yieldVal) meta.push(`Yield: ${yieldVal}`)
  if (meta.length) parts.push(meta.join(' · '))

  const ingredients = recipe.recipeIngredient
  if (ingredients) {
    const list = Array.isArray(ingredients) ? ingredients : [ingredients]
    parts.push('\n## Ingredients\n' + list.map((ing) => `- ${formatIngredient(ing)}`).join('\n'))
  }

  const instructions = formatInstructions(recipe.recipeInstructions)
  if (instructions) parts.push('\n## Instructions\n' + instructions)

  return parts.join('\n\n').trim()
}

function extractRecipeFromHtml(html: string): Record<string, unknown> | null {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      const recipes = findRecipeNodes(parsed)
      if (recipes.length) return recipes[0]
    } catch {
      // try next script block
    }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim())
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Only http(s) URLs are supported' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'TableForTwo/1.0 (recipe scanner)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Could not fetch page (${res.status})` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = await res.text()
    const recipe = extractRecipeFromHtml(html)

    if (!recipe) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formatted = formatRecipe(recipe)
    const title = asText(recipe.name)
    const imageUrl = extractImageUrl(recipe.image)

    return new Response(JSON.stringify({ found: true, title, formatted, imageUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Scan failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
