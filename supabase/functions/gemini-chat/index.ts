import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { messages, pantrySnapshot } = await req.json()
    const systemPrompt = `You are a helpful home cooking assistant for a couple's kitchen app "Table for Two".
Be warm and concise. When suggesting recipes, prefer ingredients from their pantry when provided.
Format recipes clearly with ingredients and brief steps.`

    const contents = [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nCurrent pantry:\n${pantrySnapshot || '(empty)'}` }],
      },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    ]

    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    })

    const data = await res.json()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Gemini API error' }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I could not generate a response.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
