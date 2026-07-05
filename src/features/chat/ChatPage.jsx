import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { useHousehold } from '../../hooks/useHousehold'
import { fetchPantry } from '../../lib/pantry'
import { formatQuantity } from '../../lib/units'
import { supabase } from '../../supabaseClient'
import './ChatPage.css'

export function ChatPage() {
  const { householdId } = useHousehold()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! Ask me for recipe ideas based on your pantry, or tell me what you\'re in the mood for.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pantry, setPantry] = useState([])
  const bottomRef = useRef(null)

  const loadPantry = useCallback(async () => {
    if (!householdId) return
    setPantry(await fetchPantry(householdId))
  }, [householdId])

  useEffect(() => {
    loadPantry()
  }, [loadPantry])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const pantrySnapshot = pantry.map((p) => `${p.name}: ${formatQuantity(p.quantity, p.unit)}`).join('\n')

  const send = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')
    const nextMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          messages: nextMessages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
          pantrySnapshot,
        },
      })
      if (error) throw error
      const reply = data?.reply ?? data?.text ?? 'No response.'
      setMessages([...nextMessages, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: `Sorry, I couldn't connect. Make sure the gemini-chat Edge Function is deployed and GEMINI_API_KEY is set. (${err.message})`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const suggestFromPantry = () => {
    send('Suggest 2-3 recipes we can cook with what we have in the pantry. List ingredients we would use from our pantry for each.')
  }

  return (
    <div className="chat-page">
      <div className="chat-page__messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-bubble chat-bubble--assistant">Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-page__quick">
        <Button variant="secondary" onClick={suggestFromPantry} disabled={loading || !pantry.length}>
          Suggest from my pantry
        </Button>
      </div>
      <form
        className="chat-page__input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for recipe ideas…"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
