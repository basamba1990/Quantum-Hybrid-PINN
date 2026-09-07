'use client'

import { useMemo, useState } from 'react'
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from 'lucide-react'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const suggestedQuestions = [
  'Que fait réellement Quantum-Hybrid PINN ?',
  'Quelles preuves existent pour le pilote LH₂ ?',
  'Quelle différence entre une démonstration et une validation ?'
]

const functionUrl = () => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base.replace(/\/$/, '')}/functions/v1/kelly-chat` : ''
}

export function KellyWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endpoint = useMemo(functionUrl, [])

  async function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || loading) return
    const nextMessages = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setLoading(true)

    try {
      if (!endpoint || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Le widget est en attente de configuration Supabase.')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ question: trimmed, history: nextMessages.slice(-8) }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Kelly ne peut pas répondre pour le moment.')
      setMessages([...nextMessages, { role: 'assistant', content: payload.answer }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3 font-sans">
      {open && (
        <section className="w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950/95 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 to-cyan-950/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300"><Bot size={19} /></div>
              <div><p className="text-sm font-semibold">Kelly · professeur IA</p><p className="text-[11px] text-slate-400">Réponses basées sur les preuves du projet</p></div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer Kelly" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={17} /></button>
          </div>

          <div className="max-h-[430px] min-h-[280px] space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && <div className="space-y-4 py-3"><div className="flex gap-3"><Sparkles className="mt-1 shrink-0 text-cyan-300" size={18} /><p className="text-sm leading-6 text-slate-300">Bonjour. Je peux expliquer le projet, les études de cas, les limites scientifiques et les façons de collaborer. Je signalerai clairement ce qui est démontré, inconclusif ou encore à vérifier.</p></div><div className="space-y-2">{suggestedQuestions.map((question) => <button key={question} onClick={() => ask(question)} className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-400/10">{question}</button>)}</div></div>}
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === 'user' ? 'bg-cyan-500 text-slate-950' : 'bg-white/8 text-slate-200'}`}><p className="whitespace-pre-wrap">{message.content}</p></div></div>)}
            {loading && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={15} className="animate-spin text-cyan-300" /> Kelly vérifie le contexte…</div>}
            {error && <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">{error}</p>}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void ask(input) }} className="flex gap-2 border-t border-white/10 p-3"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Posez une question technique…" aria-label="Question à Kelly" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60" /><button disabled={!input.trim() || loading} aria-label="Envoyer la question" className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"><Send size={17} /></button></form>
        </section>
      )}
      <button onClick={() => setOpen(!open)} className="group flex items-center gap-3 rounded-full border border-cyan-300/40 bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-cyan-950/30 transition hover:-translate-y-1 hover:border-cyan-200" aria-expanded={open} aria-label={open ? 'Fermer Kelly' : 'Ouvrir Kelly'}><span className="grid size-8 place-items-center rounded-full bg-cyan-400 text-slate-950"><Bot size={17} /></span><span>{open ? 'Fermer Kelly' : 'Demander à Kelly'}</span>{open ? <ChevronDown size={15} /> : <Sparkles size={15} className="text-cyan-300" />}</button>
    </div>
  )
}
